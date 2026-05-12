import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ===========================
// MongoDB
// ===========================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/coaching')
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// ===========================
// SCHEMAS
// ===========================

const ConfigSchema = new mongoose.Schema({
  teacherPassword: String,
  studentPassword: String,
  parentPassword: String,
  teacherName: String,
  phone: String,
  email: String,
  classroomName: String,
  mapUrl: String,
  classStart: String,
  classEnd: String,
  subjects: { type: [String], default: ['Mathematics', 'Science', 'English'] },
});

const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: String,
  phone: String,
  parentName: String,
  parentPhone: String,
  aadhar: String,
  subjects: { type: [String], default: [] },
  notes: String,
  joinDate: { type: Date, default: Date.now },
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
  createdAt: { type: Date, default: Date.now },
});

const Config = mongoose.model('Config', ConfigSchema);
const Student = mongoose.model('Student', StudentSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);
const Announcement = mongoose.model('Announcement', AnnouncementSchema);

// ===========================
// MIDDLEWARE
// ===========================

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const teacherOnly = (req, res, next) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teacher only' });
  next();
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
    const { teacherPassword, studentPassword, parentPassword, ...rest } = req.body;
    const config = new Config({
      teacherPassword: await bcrypt.hash(teacherPassword, 10),
      studentPassword: await bcrypt.hash(studentPassword, 10),
      parentPassword: await bcrypt.hash(parentPassword, 10),
      ...rest,
    });
    await config.save();
    const token = jwt.sign({ role: 'teacher' }, process.env.JWT_SECRET);
    res.json({ token, role: 'teacher' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(401).json({ error: 'Password required' });
    const config = await Config.findOne();
    if (!config) return res.status(401).json({ error: 'System not set up' });
    const isT = await bcrypt.compare(password, config.teacherPassword);
    const isS = await bcrypt.compare(password, config.studentPassword);
    const isP = await bcrypt.compare(password, config.parentPassword);
    if (!isT && !isS && !isP) return res.status(401).json({ error: 'Wrong password' });
    const role = isT ? 'teacher' : isS ? 'student' : 'parent';
    const token = jwt.sign({ role }, process.env.JWT_SECRET);
    if (role !== 'teacher') {
      const students = await Student.find().select('_id name rollNumber subjects').sort({ name: 1 });
      return res.json({ token, role, students });
    }
    res.json({ token, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// PUBLIC ROUTES (no auth)
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
    const { name, phone, parentName, parentPhone, aadhar, subjects, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
    const count = await Student.countDocuments();
    const rollNumber = String(count + 1).padStart(3, '0');
    const student = new Student({
      name, phone, parentName, parentPhone, aadhar,
      subjects: subjects || [],
      notes,
      rollNumber,
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
    const students = await Student.find().sort({ name: 1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:id', authenticate, async (req, res) => {
  try {
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
    const student = new Student({
      ...req.body,
      rollNumber,
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
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
    const today = new Date().toISOString().split('T')[0];
    const attendance = await Attendance.find({ date: today });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/student/:studentId', authenticate, async (req, res) => {
  try {
    const attendance = await Attendance.find({ studentId: req.params.studentId }).sort({ date: -1 });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/summary/:studentId', authenticate, async (req, res) => {
  try {
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

// Student check in/out (self-marked)
app.post('/api/attendance/check', authenticate, async (req, res) => {
  try {
    const { studentId, action } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let attendance = await Attendance.findOne({ studentId, date: today });
    if (!attendance) {
      attendance = new Attendance({
        studentId, date: today, status: 'present',
        markedBy: req.user.role === 'teacher' ? 'teacher' : 'self',
      });
    }
    if (action === 'in') attendance.inTime = timeStr;
    if (action === 'out') attendance.outTime = timeStr;
    attendance.status = 'present';
    await attendance.save();
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher marks a student manually
app.post('/api/attendance/teacher-mark', authenticate, teacherOnly, async (req, res) => {
  try {
    const { studentId, status, reason, date } = req.body;
    const day = date || new Date().toISOString().split('T')[0];
    const config = await Config.findOne();
    let attendance = await Attendance.findOne({ studentId, date: day });
    if (!attendance) {
      attendance = new Attendance({ studentId, date: day });
    }
    attendance.status = status;
    attendance.markedBy = 'teacher';
    attendance.reason = reason || '';
    if (status === 'present') {
      attendance.inTime = config?.classStart || '09:00';
      attendance.outTime = config?.classEnd || '17:00';
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
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/announcements', authenticate, teacherOnly, async (req, res) => {
  try {
    const { message, type, dates } = req.body;
    const announcement = new Announcement({
      message,
      type,
      dates: type === 'off-day' ? (dates || []) : [],
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
    const { teacherPassword, studentPassword, parentPassword, ...rest } = req.body;
    Object.assign(config, rest);
    if (teacherPassword) config.teacherPassword = await bcrypt.hash(teacherPassword, 10);
    if (studentPassword) config.studentPassword = await bcrypt.hash(studentPassword, 10);
    if (parentPassword) config.parentPassword = await bcrypt.hash(parentPassword, 10);
    await config.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  console.log('✓ API ready at /api/*\n');
});
