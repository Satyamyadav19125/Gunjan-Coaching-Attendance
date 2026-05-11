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

// MongoDB Connection
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
});

const StudentSchema = new mongoose.Schema({
  name: String,
  rollNumber: String,
  phone: String,
  parentPhone: String,
  aadhar: String,
  subjects: [String],
  notes: String,
  joinDate: Date,
});

const AttendanceSchema = new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId,
  date: String,
  status: { type: String, enum: ['present', 'absent'], default: 'absent' },
  inTime: String,
  outTime: String,
  markedBy: { type: String, enum: ['self', 'teacher'], default: 'self' },
  reason: String,
});

const AnnouncementSchema = new mongoose.Schema({
  message: String,
  type: { type: String, enum: ['general', 'off-day'], default: 'general' },
  dates: [String],
  createdAt: { type: Date, default: Date.now },
});

const Config = mongoose.model('Config', ConfigSchema);
const Student = mongoose.model('Student', StudentSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);
const Announcement = mongoose.model('Announcement', AnnouncementSchema);

// ===========================
// AUTH MIDDLEWARE
// ===========================

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authorizeTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teacher only' });
  next();
};

// ===========================
// ROUTES: AUTH
// ===========================

app.post('/api/auth/setup', async (req, res) => {
  try {
    const existing = await Config.findOne();
    if (existing) return res.status(400).json({ error: 'Already set up' });

    const { teacherPassword, studentPassword, parentPassword, teacherName, phone, email, classroomName, mapUrl, classStart, classEnd } = req.body;

    const config = new Config({
      teacherPassword: await bcrypt.hash(teacherPassword, 10),
      studentPassword: await bcrypt.hash(studentPassword, 10),
      parentPassword: await bcrypt.hash(parentPassword, 10),
      teacherName, phone, email, classroomName, mapUrl, classStart, classEnd,
    });

    await config.save();
    const token = jwt.sign({ role: 'teacher' }, process.env.JWT_SECRET);
    res.json({ token, role: 'teacher' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/check-setup', async (req, res) => {
  try {
    const config = await Config.findOne().select('-teacherPassword -studentPassword -parentPassword');
    res.json({ setupDone: !!config, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(401).json({ error: 'Password required' });

    const config = await Config.findOne();
    if (!config) return res.status(401).json({ error: 'System not set up yet' });

    const isTeacher = await bcrypt.compare(password, config.teacherPassword);
    const isStudent = await bcrypt.compare(password, config.studentPassword);
    const isParent = await bcrypt.compare(password, config.parentPassword);

    if (!isTeacher && !isStudent && !isParent) {
      return res.status(401).json({ error: 'Wrong password' });
    }

    let role = 'student';
    if (isTeacher) role = 'teacher';
    else if (isParent) role = 'parent';

    const token = jwt.sign({ role }, process.env.JWT_SECRET);

    if (role === 'student' || role === 'parent') {
      const students = await Student.find().select('_id name rollNumber phone subjects');
      return res.json({ token, role, students });
    }

    res.json({ token, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// ROUTES: STUDENTS
// ===========================

app.post('/api/students', authenticate, authorizeTeacher, async (req, res) => {
  try {
    const { name, rollNumber, phone, parentPhone, aadhar, subjects, notes } = req.body;
    const student = new Student({ name, rollNumber, phone, parentPhone, aadhar, subjects, notes, joinDate: new Date().toISOString().split('T')[0] });
    await student.save();
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students', authenticate, async (req, res) => {
  try {
    const students = await Student.find().sort({ rollNumber: 1 });
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

app.put('/api/students/:id', authenticate, authorizeTeacher, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/students/:id', authenticate, authorizeTeacher, async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    await Attendance.deleteMany({ studentId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// ROUTES: ATTENDANCE
// ===========================

app.post('/api/attendance', authenticate, async (req, res) => {
  try {
    const { studentId, date, action } = req.body;
    let attendance = await Attendance.findOne({ studentId, date });
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (!attendance) {
      attendance = new Attendance({ studentId, date, status: 'present', markedBy: req.user.role === 'teacher' ? 'teacher' : 'self' });
    }

    if (action === 'in') attendance.inTime = timeStr;
    if (action === 'out') attendance.outTime = timeStr;
    if (action === 'complete') {
      const config = await Config.findOne();
      attendance.inTime = config.classStart;
      attendance.outTime = config.classEnd;
      attendance.markedBy = 'teacher';
    }

    attendance.status = 'present';
    await attendance.save();
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/:studentId', authenticate, async (req, res) => {
  try {
    const attendance = await Attendance.find({ studentId: req.params.studentId }).sort({ date: -1 });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/attendance/:id', authenticate, authorizeTeacher, async (req, res) => {
  try {
    const att = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(att);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attendance/:id', authenticate, authorizeTeacher, async (req, res) => {
  try {
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// ROUTES: ANNOUNCEMENTS
// ===========================

app.post('/api/announcements', authenticate, authorizeTeacher, async (req, res) => {
  try {
    const { message, type, dates } = req.body;
    const announcement = new Announcement({ message, type, dates: type === 'off-day' ? dates : [] });
    await announcement.save();
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/announcements', authenticate, async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/announcements/:id', authenticate, authorizeTeacher, async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// ROUTES: CONFIG
// ===========================

app.get('/api/config', authenticate, async (req, res) => {
  try {
    const config = await Config.findOne().select('-teacherPassword -studentPassword -parentPassword');
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/config', authenticate, authorizeTeacher, async (req, res) => {
  try {
    const config = await Config.findOne();
    Object.assign(config, req.body);
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// SERVE FRONTEND (must be AFTER all API routes)
// ===========================

app.use(express.static(path.join(__dirname, 'frontend/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// ===========================
// START SERVER
// ===========================

app.listen(PORT, () => {
  console.log(`\n✓ Server running on http://localhost:${PORT}`);
  console.log('✓ API ready at /api/*\n');
});