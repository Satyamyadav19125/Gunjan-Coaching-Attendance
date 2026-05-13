import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-env';

app.use(cors());
app.use(express.json());

// ===========================
// TIMEZONE HELPERS (fix wrong check-in/out times)
// ===========================
const istDateISO = () => {
  // Returns YYYY-MM-DD in the configured timezone
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
};

const istTimeHM = () => {
  // Returns HH:MM in the configured timezone (24h)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date());
};

// ===========================
// MongoDB
// ===========================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/coaching')
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// ===========================
// SCHEMAS
// ===========================

// Subjects now carry a monthly fee.
const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  monthlyFee: { type: Number, default: 0 },
}, { _id: false });

// A batch is a group of students that meets at a specific time.
// weeklyOffDays is an array of weekday numbers (0=Sun, 1=Mon, ... 6=Sat).
const BatchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startTime: { type: String, default: '09:00' },
  endTime:   { type: String, default: '11:00' },
  weeklyOffDays: { type: [Number], default: [0] }, // Sunday only by default
});

const ConfigSchema = new mongoose.Schema({
  teacherPassword: String,
  studentPassword: String,
  parentPassword: String, // legacy / fallback - parents now use unique codes
  teacherName: String,
  phone: String,
  email: String,
  classroomName: String,
  mapUrl: String,
  classStart: String,
  classEnd: String,
  // Old format was [String]; new format is [{name, monthlyFee}].
  // Mongoose will store whatever we put; we'll always read+write the new format.
  subjects: { type: [SubjectSchema], default: [] },
  batches:  { type: [BatchSchema],   default: [] },
});

const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: String,
  phone: String,
  parentName: String,
  parentPhone: String,
  aadhar: String,
  birthday: String,
  subjects: { type: [String], default: [] }, // subject names; fees live on Config
  batchId: { type: String, default: '' },     // _id of a Config.batches entry, or '' for none
  parentCode: { type: String, index: true },  // unique code for parent login (no other password needed)
  notes: String,
  joinDate: { type: Date, default: Date.now },
  enrollmentDate: { type: String, default: () => istDateISO() }, // YYYY-MM-DD, used for fees
  registeredVia: { type: String, enum: ['teacher', 'self'], default: 'teacher' },
});

const AttendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['present', 'absent'], default: 'present' },
  inTime: String,
  outTime: String,
  markedBy: { type: String, enum: ['self', 'teacher'], default: 'self' },
  reason: String,
});
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

const AnnouncementSchema = new mongoose.Schema({
  message: String,
  type: { type: String, enum: ['general', 'off-day'], default: 'general' },
  dates: { type: [String], default: [] },
  batchId: { type: String, default: '' }, // '' = applies to all batches
  createdAt: { type: Date, default: Date.now },
});

const Config = mongoose.model('Config', ConfigSchema);
const Student = mongoose.model('Student', StudentSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);
const Announcement = mongoose.model('Announcement', AnnouncementSchema);

// ===========================
// ID + CODE HELPERS
// ===========================
const generateParentCode = () => {
  // 6-char uppercase alphanumeric, no confusable chars (no 0/O/1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return out;
};

const ensureUniqueParentCode = async () => {
  for (let i = 0; i < 12; i++) {
    const code = generateParentCode();
    const exists = await Student.findOne({ parentCode: code });
    if (!exists) return code;
  }
  // Extremely unlikely fallback
  return generateParentCode() + Date.now().toString(36).slice(-2).toUpperCase();
};

// ===========================
// MIDDLEWARE
// ===========================
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const teacherOnly = (req, res, next) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teacher only' });
  next();
};

// A "parent" token is scoped to a single studentId. They can only read that student.
const parentScopeCheck = (req, studentId) => {
  if (req.user.role === 'parent') {
    if (!req.user.studentId || String(req.user.studentId) !== String(studentId)) {
      return false;
    }
  }
  return true;
};

// ===========================
// AUTH ROUTES
// ===========================

app.get('/api/auth/check-setup', async (req, res) => {
  try {
    const config = await Config.findOne();
    res.json({ setupDone: !!config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/setup', async (req, res) => {
  try {
    const existing = await Config.findOne();
    if (existing) return res.status(400).json({ error: 'Already set up' });
    const { teacherPassword, studentPassword, parentPassword, subjects, ...rest } = req.body;
    // Normalize subjects: accept [String] or [{name, monthlyFee}]
    const normSubjects = (subjects || []).map(s =>
      typeof s === 'string' ? { name: s, monthlyFee: 0 } : { name: s.name, monthlyFee: Number(s.monthlyFee) || 0 }
    );
    const config = new Config({
      teacherPassword: await bcrypt.hash(teacherPassword, 10),
      studentPassword: await bcrypt.hash(studentPassword, 10),
      parentPassword: await bcrypt.hash(parentPassword || teacherPassword, 10),
      subjects: normSubjects,
      ...rest,
    });
    await config.save();
    const token = jwt.sign({ role: 'teacher' }, JWT_SECRET);
    res.json({ token, role: 'teacher' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Password login: for teacher and student roles (parents now use code).
app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(401).json({ error: 'Password required' });
    const config = await Config.findOne();
    if (!config) return res.status(401).json({ error: 'System not set up' });
    const isT = await bcrypt.compare(password, config.teacherPassword);
    const isS = await bcrypt.compare(password, config.studentPassword);
    if (!isT && !isS) return res.status(401).json({ error: 'Wrong password' });
    const role = isT ? 'teacher' : 'student';
    const token = jwt.sign({ role }, JWT_SECRET);
    if (role === 'student') {
      const students = await Student.find().select('_id name rollNumber subjects batchId').sort({ name: 1 });
      return res.json({ token, role, students });
    }
    res.json({ token, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parent login by unique code. Bypasses any password.
app.post('/api/auth/parent-login', async (req, res) => {
  try {
    const code = (req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(401).json({ error: 'Code required' });
    const student = await Student.findOne({ parentCode: code });
    if (!student) return res.status(401).json({ error: 'Invalid code' });
    const token = jwt.sign({ role: 'parent', studentId: String(student._id) }, JWT_SECRET);
    res.json({ token, role: 'parent', student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// PUBLIC ROUTES
// ===========================

app.get('/api/public/info', async (req, res) => {
  try {
    const config = await Config.findOne().select('-teacherPassword -studentPassword -parentPassword');
    res.json(config || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/public/register', async (req, res) => {
  try {
    const { name, phone, parentName, parentPhone, aadhar, birthday, subjects, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
    const count = await Student.countDocuments();
    const rollNumber = String(count + 1).padStart(3, '0');
    const parentCode = await ensureUniqueParentCode();
    const student = new Student({
      name, phone, parentName, parentPhone, aadhar, birthday,
      subjects: subjects || [],
      notes,
      rollNumber,
      parentCode,
      enrollmentDate: istDateISO(),
      joinDate: new Date(),
      registeredVia: 'self',
    });
    await student.save();
    res.json({ ok: true, message: 'Registered successfully! Login with the student password.', student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// STUDENT ROUTES
// ===========================

app.get('/api/students', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'parent') {
      const s = await Student.findById(req.user.studentId);
      return res.json(s ? [s] : []);
    }
    const students = await Student.find().sort({ name: 1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:id', authenticate, async (req, res) => {
  try {
    if (!parentScopeCheck(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', authenticate, teacherOnly, async (req, res) => {
  try {
    const count = await Student.countDocuments();
    const rollNumber = req.body.rollNumber || String(count + 1).padStart(3, '0');
    const parentCode = req.body.parentCode || await ensureUniqueParentCode();
    const student = new Student({
      ...req.body,
      rollNumber,
      parentCode,
      enrollmentDate: req.body.enrollmentDate || istDateISO(),
      joinDate: new Date(),
      registeredVia: 'teacher',
    });
    await student.save();
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id', authenticate, teacherOnly, async (req, res) => {
  try {
    const update = { ...req.body };
    // Don't allow changing parentCode unless explicitly regenerating
    delete update.parentCode;
    const student = await Student.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Regenerate a student's parent code
app.post('/api/students/:id/regenerate-code', authenticate, teacherOnly, async (req, res) => {
  try {
    const code = await ensureUniqueParentCode();
    const student = await Student.findByIdAndUpdate(req.params.id, { parentCode: code }, { new: true });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/students/:id', authenticate, teacherOnly, async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    await Attendance.deleteMany({ studentId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// ATTENDANCE ROUTES
// ===========================

app.get('/api/attendance/today', authenticate, teacherOnly, async (req, res) => {
  try {
    const today = istDateISO();
    const attendance = await Attendance.find({ date: today });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/student/:studentId', authenticate, async (req, res) => {
  try {
    if (!parentScopeCheck(req, req.params.studentId)) return res.status(403).json({ error: 'Forbidden' });
    const attendance = await Attendance.find({ studentId: req.params.studentId }).sort({ date: -1 });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/summary/:studentId', authenticate, async (req, res) => {
  try {
    if (!parentScopeCheck(req, req.params.studentId)) return res.status(403).json({ error: 'Forbidden' });
    const records = await Attendance.find({ studentId: req.params.studentId });
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const total = present + absent;
    const percentage = total ? Math.round((present / total) * 100) : 0;
    const absentDays = records
      .filter(r => r.status === 'absent')
      .map(r => ({ date: r.date, reason: r.reason || 'No reason given' }))
      .sort((a, b) => b.date.localeCompare(a.date));
    res.json({ present, absent, total, percentage, absentDays });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student or teacher check-in/check-out.
app.post('/api/attendance/check', authenticate, async (req, res) => {
  try {
    const { studentId, action } = req.body;
    const today = istDateISO();
    const timeStr = istTimeHM();
    let attendance = await Attendance.findOne({ studentId, date: today });
    if (!attendance) {
      attendance = new Attendance({
        studentId, date: today, status: 'present',
        markedBy: req.user.role === 'teacher' ? 'teacher' : 'self',
      });
    }
    if (action === 'in')  attendance.inTime  = timeStr;
    if (action === 'out') attendance.outTime = timeStr;
    attendance.status = 'present';
    await attendance.save();
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/teacher-mark', authenticate, teacherOnly, async (req, res) => {
  try {
    const { studentId, status, reason, date } = req.body;
    const day = date || istDateISO();
    const config = await Config.findOne();
    const student = await Student.findById(studentId);
    let attendance = await Attendance.findOne({ studentId, date: day });
    if (!attendance) {
      attendance = new Attendance({ studentId, date: day });
    }
    attendance.status = status;
    attendance.markedBy = 'teacher';
    attendance.reason = reason || '';
    if (status === 'present') {
      // Prefer batch-specific timings; fall back to classroom default.
      let inT = config?.classStart || '09:00';
      let outT = config?.classEnd || '17:00';
      if (student?.batchId && config?.batches?.length) {
        const batch = config.batches.id(student.batchId);
        if (batch) {
          inT = batch.startTime || inT;
          outT = batch.endTime || outT;
        }
      }
      attendance.inTime = inT;
      attendance.outTime = outT;
    } else {
      attendance.inTime = '';
      attendance.outTime = '';
    }
    await attendance.save();
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/mark-all-present', authenticate, teacherOnly, async (req, res) => {
  try {
    const today = istDateISO();
    const { batchId } = req.body || {};
    const config = await Config.findOne();
    const filter = {};
    if (batchId) filter.batchId = batchId;
    const students = await Student.find(filter);
    let marked = 0;
    for (const s of students) {
      let att = await Attendance.findOne({ studentId: s._id, date: today });
      if (att && att.status === 'present') continue;
      if (!att) {
        att = new Attendance({ studentId: s._id, date: today });
      }
      let inT = config?.classStart || '09:00';
      let outT = config?.classEnd || '17:00';
      if (s.batchId && config?.batches?.length) {
        const batch = config.batches.id(s.batchId);
        if (batch) { inT = batch.startTime || inT; outT = batch.endTime || outT; }
      }
      att.status = 'present';
      att.markedBy = 'teacher';
      att.inTime = inT;
      att.outTime = outT;
      att.reason = '';
      await att.save();
      marked++;
    }
    res.json({ ok: true, marked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- UNDO / UNMARK -----------------------------------------------------------
// Student can undo their own self check-in for today (rule: only same day, only self-marked).
app.post('/api/attendance/undo-self', authenticate, async (req, res) => {
  try {
    const { studentId } = req.body;
    if (req.user.role !== 'student' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const today = istDateISO();
    const att = await Attendance.findOne({ studentId, date: today });
    if (!att) return res.json({ ok: true, message: 'Nothing to undo' });
    // Students may only undo their own self-marked records
    if (req.user.role === 'student' && att.markedBy !== 'self') {
      return res.status(403).json({ error: 'This was marked by your teacher; ask them to fix it.' });
    }
    await Attendance.deleteOne({ _id: att._id });
    res.json({ ok: true, deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher can unmark any attendance record for any date (rolls it back to "not marked").
app.delete('/api/attendance/unmark', authenticate, teacherOnly, async (req, res) => {
  try {
    const { studentId, date } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });
    const day = date || istDateISO();
    await Attendance.deleteOne({ studentId, date: day });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/attendance/:id', authenticate, teacherOnly, async (req, res) => {
  try {
    const att = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(att);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// ANNOUNCEMENT ROUTES
// ===========================

app.get('/api/announcements', authenticate, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'parent') {
      const student = await Student.findById(req.user.studentId);
      if (student) {
        filter = { $or: [{ batchId: '' }, { batchId: student.batchId || '' }] };
      }
    }
    const announcements = await Announcement.find(filter).sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/announcements', authenticate, teacherOnly, async (req, res) => {
  try {
    const { message, type, dates, batchId } = req.body;
    const announcement = new Announcement({
      message,
      type,
      dates: type === 'off-day' ? (dates || []) : [],
      batchId: batchId || '',
    });
    await announcement.save();
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/announcements/:id', authenticate, teacherOnly, async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// FEES ROUTES
// ===========================

// Working days in a month = total days - count of weekly off days (Sunday by default).
// Per requirement 11: announced holidays do NOT reduce working days.
const workingDaysInMonth = (year, month1to12, weeklyOffDays = [0]) => {
  const daysInMonth = new Date(year, month1to12, 0).getDate(); // month1to12 here is 1-based
  let working = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month1to12 - 1, d).getDay();
    if (!weeklyOffDays.includes(dow)) working++;
  }
  return { working, total: daysInMonth };
};

// Count of days from 1..maxDay (inclusive) that are weekly-off days.
const countOffDaysUpTo = (year, month1to12, upToDay, weeklyOffDays = [0]) => {
  let off = 0;
  for (let d = 1; d <= upToDay; d++) {
    const dow = new Date(year, month1to12 - 1, d).getDay();
    if (weeklyOffDays.includes(dow)) off++;
  }
  return off;
};

const computeStudentFees = (student, config, yyyymm) => {
  const [yStr, mStr] = yyyymm.split('-');
  const year = Number(yStr);
  const month = Number(mStr); // 1..12
  if (!year || !month) return null;

  // Determine off days from batch (else default to Sunday).
  let offDays = [0];
  if (student.batchId && config?.batches?.length) {
    const batch = config.batches.id ? config.batches.id(student.batchId) :
                  config.batches.find(b => String(b._id) === String(student.batchId));
    if (batch?.weeklyOffDays?.length) offDays = batch.weeklyOffDays;
  }

  const { working, total } = workingDaysInMonth(year, month, offDays);

  // Per-subject monthly fee
  const subjectsBreakdown = (student.subjects || []).map(name => {
    const sub = (config?.subjects || []).find(s => s.name === name);
    const monthly = sub ? Number(sub.monthlyFee) || 0 : 0;
    const perDay = working ? monthly / working : 0;
    return { name, monthlyFee: monthly, perDay };
  });

  const monthlyTotal = subjectsBreakdown.reduce((a, s) => a + s.monthlyFee, 0);
  const perDayTotal  = subjectsBreakdown.reduce((a, s) => a + s.perDay, 0);

  return { year, month, workingDays: working, totalDays: total, offWeekday: offDays, subjects: subjectsBreakdown, monthlyTotal, perDayTotal };
};

app.get('/api/fees/student/:id', authenticate, async (req, res) => {
  try {
    if (!parentScopeCheck(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
    const yyyymm = req.query.month || istDateISO().substring(0, 7);
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Not found' });
    const config = await Config.findOne();
    const fees = computeStudentFees(student, config, yyyymm);
    res.json({ student: { _id: student._id, name: student.name, rollNumber: student.rollNumber, batchId: student.batchId }, fees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fees/summary', authenticate, teacherOnly, async (req, res) => {
  try {
    const yyyymm = req.query.month || istDateISO().substring(0, 7);
    const students = await Student.find().sort({ name: 1 });
    const config = await Config.findOne();
    const rows = students.map(s => {
      const fees = computeStudentFees(s, config, yyyymm);
      return {
        _id: s._id, name: s.name, rollNumber: s.rollNumber,
        batchId: s.batchId || '',
        subjects: s.subjects || [],
        fees,
      };
    });
    const grandMonthly = rows.reduce((a, r) => a + (r.fees?.monthlyTotal || 0), 0);
    const grandDaily   = rows.reduce((a, r) => a + (r.fees?.perDayTotal   || 0), 0);
    res.json({ month: yyyymm, students: rows, grandMonthly, grandDaily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// CONFIG ROUTES
// ===========================

app.get('/api/config', authenticate, async (req, res) => {
  try {
    const config = await Config.findOne().select('-teacherPassword -studentPassword -parentPassword');
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/config', authenticate, teacherOnly, async (req, res) => {
  try {
    const config = await Config.findOne();
    if (!config) return res.status(404).json({ error: 'Not found' });
    const { teacherPassword, studentPassword, parentPassword, subjects, batches, ...rest } = req.body;

    // Normalize subjects to the new format. Accept either ["Math"] or [{name, monthlyFee}].
    if (subjects !== undefined) {
      config.subjects = (subjects || []).map(s =>
        typeof s === 'string'
          ? { name: s, monthlyFee: 0 }
          : { name: s.name, monthlyFee: Number(s.monthlyFee) || 0 }
      );
    }
    if (batches !== undefined) {
      config.batches = (batches || []).map(b => ({
        _id: b._id, // preserve id if present
        name: b.name,
        startTime: b.startTime || '09:00',
        endTime:   b.endTime   || '11:00',
        weeklyOffDays: Array.isArray(b.weeklyOffDays) && b.weeklyOffDays.length ? b.weeklyOffDays : [0],
      }));
    }

    Object.assign(config, rest);
    if (teacherPassword) config.teacherPassword = await bcrypt.hash(teacherPassword, 10);
    if (studentPassword) config.studentPassword = await bcrypt.hash(studentPassword, 10);
    if (parentPassword)  config.parentPassword  = await bcrypt.hash(parentPassword, 10);
    await config.save();
    const safe = await Config.findById(config._id).select('-teacherPassword -studentPassword -parentPassword');
    res.json({ ok: true, config: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// ONE-TIME MIGRATION (runs after connect)
// ===========================
mongoose.connection.once('open', async () => {
  try {
    // 1) Convert legacy string subjects to {name, monthlyFee} in Config
    const cfg = await Config.findOne();
    if (cfg && Array.isArray(cfg.subjects) && cfg.subjects.length) {
      const needs = cfg.subjects.some(s => typeof s === 'string');
      if (needs) {
        cfg.subjects = cfg.subjects.map(s => typeof s === 'string' ? { name: s, monthlyFee: 0 } : s);
        await cfg.save();
        console.log('✓ Migrated subjects to {name, monthlyFee} format');
      }
    }
    // 2) Backfill parentCode for existing students
    const missing = await Student.find({ $or: [{ parentCode: { $exists: false } }, { parentCode: '' }, { parentCode: null }] });
    for (const s of missing) {
      s.parentCode = await ensureUniqueParentCode();
      if (!s.enrollmentDate) s.enrollmentDate = istDateISO();
      await s.save();
    }
    if (missing.length) console.log(`✓ Backfilled parentCode for ${missing.length} student(s)`);
  } catch (err) {
    console.error('Migration warning:', err.message);
  }
});

// ===========================
// SERVE FRONTEND (must be LAST)
// ===========================

app.use(express.static(path.join(__dirname, 'frontend/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Timezone: ${TIMEZONE}`);
  console.log('✓ API ready at /api/*\n');
});
