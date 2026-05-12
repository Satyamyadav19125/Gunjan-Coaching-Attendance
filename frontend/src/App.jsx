import React, { useState, useEffect } from 'react';
import {
  GraduationCap, LogIn, LogOut, User, Users, UserPlus,
  Calendar, CalendarOff, Clock, Phone, Mail, MapPin,
  Plus, Trash2, Edit2, Save, X, Search,
  ChevronRight, ArrowLeft, CheckCircle, XCircle,
  AlertTriangle, Info, BarChart3, MessageSquare, Send,
  Megaphone, Eye, EyeOff, BookOpen, Settings
} from 'lucide-react';
import axios from 'axios';
import './index.css';

// ============================
// AXIOS SETUP
// ============================
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ============================
// MAIN APP
// ============================
export default function App() {
  const [view, setView] = useState('landing');
  const [info, setInfo] = useState({});
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(
    JSON.parse(localStorage.getItem('selectedStudent') || 'null')
  );

  useEffect(() => {
    // Load public coaching info
    api.get('/public/info').then(r => setInfo(r.data)).catch(() => {});

    // Resume session
    const savedRole = localStorage.getItem('role');
    const savedStudent = JSON.parse(localStorage.getItem('selectedStudent') || 'null');
    if (savedRole === 'teacher') setView('teacher');
    else if (savedRole === 'student' && savedStudent) setView('student');
    else if (savedRole === 'parent' && savedStudent) setView('parent');
  }, []);

  const handleSignOut = () => {
    localStorage.clear();
    setRole(null);
    setSelectedStudent(null);
    setView('landing');
  };

  if (view === 'landing') return <Landing info={info} onSignIn={() => setView('login')} onRegister={() => setView('register')} />;
  if (view === 'register') return <Register info={info} onBack={() => setView('landing')} onDone={() => setView('login')} />;
  if (view === 'login') return <Login info={info} onBack={() => setView('landing')} onLogin={(r, s) => {
    setRole(r);
    if (r === 'teacher') { setView('teacher'); }
    else { setStudents(s); setView('pick-student'); }
  }} />;
  if (view === 'pick-student') return <PickStudent students={students} role={role} onPick={(s) => {
    setSelectedStudent(s);
    localStorage.setItem('selectedStudent', JSON.stringify(s));
    setView(role === 'student' ? 'student' : 'parent');
  }} onBack={handleSignOut} />;
  if (view === 'teacher') return <TeacherDashboard info={info} onSignOut={handleSignOut} />;
  if (view === 'student') return <StudentDashboard student={selectedStudent} info={info} onSignOut={handleSignOut} />;
  if (view === 'parent') return <ParentDashboard student={selectedStudent} info={info} onSignOut={handleSignOut} />;
  return null;
}

// ============================
// LANDING
// ============================
function Landing({ info, onSignIn, onRegister }) {
  return (
    <div className="page">
      <header className="header">
        <div className="logo">
          <GraduationCap size={28} />
          <div>
            <h1>{info.classroomName || 'Coaching Center'}</h1>
            <p className="muted">Attendance Tracking</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={onSignIn}>
          <LogIn size={16} /> Sign In
        </button>
      </header>

      <section className="hero">
        <h1 className="display">Smart Attendance Tracking for {info.classroomName || 'Your Coaching Center'}</h1>
        <p>Students check in with one tap. Parents see real-time updates. Teachers manage everything from one dashboard.</p>
        <div className="hero-buttons">
          <button className="btn btn-primary btn-lg" onClick={onSignIn}>
            <LogIn size={18} /> Sign In
          </button>
          <button className="btn btn-secondary btn-lg" onClick={onRegister}>
            <UserPlus size={18} /> Register as New Student
          </button>
        </div>
      </section>

      <section className="features">
        <h2 className="display">How It Works</h2>
        <div className="feature-grid">
          <div className="card">
            <CheckCircle size={32} color="#16a34a" />
            <h3>Students Check In</h3>
            <p>One tap to mark arrival. Check-in and check-out times recorded automatically.</p>
          </div>
          <div className="card">
            <BarChart3 size={32} color="#d97706" />
            <h3>Parents Track Progress</h3>
            <p>See attendance history, percentage, and reasons for absence.</p>
          </div>
          <div className="card">
            <Settings size={32} color="#dc2626" />
            <h3>Teacher Controls Everything</h3>
            <p>Manage students, send announcements, and view reports.</p>
          </div>
        </div>
      </section>

      <section className="info-section">
        <h2 className="display">About Us</h2>
        <div className="info-grid">
          {info.teacherName && (
            <div className="info-row">
              <User size={18} /><span>{info.teacherName}</span>
            </div>
          )}
          {info.phone && (
            <div className="info-row">
              <Phone size={18} /><a href={`tel:${info.phone}`}>{info.phone}</a>
            </div>
          )}
          {info.email && (
            <div className="info-row">
              <Mail size={18} /><a href={`mailto:${info.email}`}>{info.email}</a>
            </div>
          )}
          {info.mapUrl && (
            <div className="info-row">
              <MapPin size={18} /><a href={info.mapUrl} target="_blank" rel="noreferrer">View Location</a>
            </div>
          )}
          {info.classStart && info.classEnd && (
            <div className="info-row">
              <Clock size={18} /><span>Class hours: {info.classStart} - {info.classEnd}</span>
            </div>
          )}
        </div>
      </section>

      <footer className="footer">
        <p>© {new Date().getFullYear()} {info.classroomName || 'Coaching Center'} · Attendance System</p>
      </footer>
    </div>
  );
}

// ============================
// LOGIN
// ============================
function Login({ info, onBack, onLogin }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', res.data.role);
      onLogin(res.data.role, res.data.students || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className="container-narrow">
        <button className="btn-back" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="auth-grid">
          <div>
            <h1 className="display">{info.classroomName || 'Coaching Center'}</h1>
            <p className="muted">One password. Three roles.</p>
            <div className="role-card role-teacher">
              <h3>🎓 Teacher?</h3>
              <p>Use your teacher password to manage everything.</p>
            </div>
            <div className="role-card role-student">
              <h3>📚 Student?</h3>
              <p>Use the student password your teacher gave you.</p>
            </div>
            <div className="role-card role-parent">
              <h3>👨‍👩‍👧 Parent?</h3>
              <p>Use the parent password to see your child's attendance.</p>
            </div>
          </div>
          <div className="auth-form">
            <h2 className="display">Sign In</h2>
            <p className="muted">Enter your password below</p>
            <form onSubmit={submit}>
              <label>PASSWORD</label>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                />
                <button type="button" className="icon-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <div className="error-box">{error}</div>}
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
            <hr />
            <p className="text-center">
              <strong>No password yet?</strong><br />
              Ask your teacher for the password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================
// REGISTER (public)
// ============================
function Register({ info, onBack, onDone }) {
  const [form, setForm] = useState({
    name: '', phone: '', parentName: '', parentPhone: '',
    aadhar: '', subjects: [], notes: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const toggleSubject = (s) => {
    setForm(f => ({
      ...f,
      subjects: f.subjects.includes(s) ? f.subjects.filter(x => x !== s) : [...f.subjects, s]
    }));
  };

  const validateAadhar = (a) => !a || /^\d{12}$/.test(a.replace(/\s/g, ''));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.phone) {
      setError('Name and phone are required');
      return;
    }
    if (!validateAadhar(form.aadhar)) {
      setError('Aadhar must be 12 digits');
      return;
    }
    setLoading(true);
    try {
      await api.post('/public/register', form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page-center">
        <div className="container-narrow">
          <div className="success-box">
            <CheckCircle size={48} color="#16a34a" />
            <h2 className="display">Registration Successful!</h2>
            <p>Welcome to {info.classroomName || 'our coaching center'}, {form.name}!</p>
            <p className="muted">Ask your teacher for the student password to log in.</p>
            <button className="btn btn-primary btn-lg" onClick={onDone}>Go to Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  const availableSubjects = info.subjects && info.subjects.length ? info.subjects : ['Mathematics', 'Science', 'English'];

  return (
    <div className="page-center">
      <div className="container-narrow">
        <button className="btn-back" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="auth-form">
          <h1 className="display">Register as New Student</h1>
          <p className="muted">Fill in your details to join {info.classroomName || 'our coaching center'}</p>
          <form onSubmit={submit}>
            <label>Student Name *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your full name" required />

            <label>Phone Number *</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="10-digit phone number" required />

            <label>Parent / Guardian Name</label>
            <input value={form.parentName} onChange={e => setForm({...form, parentName: e.target.value})} placeholder="Parent's name" />

            <label>Parent / Guardian Phone</label>
            <input value={form.parentPhone} onChange={e => setForm({...form, parentPhone: e.target.value})} placeholder="Parent's phone number" />

            <label>Aadhar Number (optional)</label>
            <input value={form.aadhar} onChange={e => setForm({...form, aadhar: e.target.value})} placeholder="12-digit Aadhar number" maxLength={12} />

            <label>Subjects (select what you want to learn)</label>
            <div className="checkbox-group">
              {availableSubjects.map(s => (
                <label key={s} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.subjects.includes(s)}
                    onChange={() => toggleSubject(s)}
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>

            <label>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Anything you want to tell us" rows={3} />

            {error && <div className="error-box">{error}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================
// PICK STUDENT (after student/parent login)
// ============================
function PickStudent({ students, role, onPick, onBack }) {
  const [search, setSearch] = useState('');
  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.rollNumber || '').includes(search)
  );
  return (
    <div className="page-center">
      <div className="container-narrow">
        <button className="btn-back" onClick={onBack}>
          <ArrowLeft size={16} /> Sign out
        </button>
        <h1 className="display">{role === 'parent' ? 'Find Your Child' : 'Who Are You?'}</h1>
        <p className="muted">{role === 'parent' ? 'Select your child to see their attendance' : 'Tap your name to continue'}</p>
        <div className="search-bar">
          <Search size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or roll number"
            autoFocus
          />
        </div>
        <div className="list">
          {filtered.length === 0 && <p className="muted text-center">No students found.</p>}
          {filtered.map(s => (
            <button key={s._id} className="list-item" onClick={() => onPick(s)}>
              <div>
                <strong>{s.name}</strong>
                <p className="muted small">Roll #{s.rollNumber}</p>
              </div>
              <ChevronRight size={20} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================
// TEACHER DASHBOARD
// ============================
function TeacherDashboard({ info, onSignOut }) {
  const [tab, setTab] = useState('today');
  return (
    <div className="page">
      <header className="dashboard-header">
        <div>
          <h1 className="display">Teacher Dashboard</h1>
          <p className="muted">Welcome back, {info.teacherName || 'Teacher'}</p>
        </div>
        <button className="btn btn-outline" onClick={onSignOut}>
          <LogOut size={16} /> Sign out
        </button>
      </header>

      <nav className="tabs">
        <button className={tab === 'today' ? 'tab active' : 'tab'} onClick={() => setTab('today')}>
          <Calendar size={16} /> Today
        </button>
        <button className={tab === 'students' ? 'tab active' : 'tab'} onClick={() => setTab('students')}>
          <Users size={16} /> Students
        </button>
        <button className={tab === 'summary' ? 'tab active' : 'tab'} onClick={() => setTab('summary')}>
          <BarChart3 size={16} /> Summary
        </button>
        <button className={tab === 'announcements' ? 'tab active' : 'tab'} onClick={() => setTab('announcements')}>
          <Megaphone size={16} /> Announcements
        </button>
        <button className={tab === 'settings' ? 'tab active' : 'tab'} onClick={() => setTab('settings')}>
          <Settings size={16} /> Settings
        </button>
      </nav>

      <main className="tab-content">
        {tab === 'today' && <TodayTab info={info} />}
        {tab === 'students' && <StudentsTab info={info} />}
        {tab === 'summary' && <SummaryTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
        {tab === 'settings' && <SettingsTab info={info} />}
      </main>
    </div>
  );
}

function TodayTab({ info }) {
  const [students, setStudents] = useState([]);
  const [todayAtt, setTodayAtt] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingStudent, setMarkingStudent] = useState(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        api.get('/students'),
        api.get('/attendance/today'),
      ]);
      setStudents(s.data);
      setTodayAtt(a.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getAtt = (id) => todayAtt.find(a => a.studentId === id);

  const markPresent = async (id) => {
    try {
      await api.post('/attendance/teacher-mark', { studentId: id, status: 'present' });
      load();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const markAbsent = async () => {
    try {
      await api.post('/attendance/teacher-mark', {
        studentId: markingStudent._id,
        status: 'absent',
        reason: reason || 'No reason given'
      });
      setMarkingStudent(null);
      setReason('');
      load();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  if (loading) return <p className="muted">Loading...</p>;
  if (students.length === 0) return (
    <div className="empty">
      <Users size={48} color="#999" />
      <h3>No students yet</h3>
      <p className="muted">Go to the Students tab to add your first student.</p>
    </div>
  );

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          <strong>{today}</strong>
        </div>
        <div className="stat green">
          <CheckCircle size={20} /> {todayAtt.filter(a => a.status === 'present').length} Present
        </div>
        <div className="stat red">
          <XCircle size={20} /> {todayAtt.filter(a => a.status === 'absent').length} Absent
        </div>
        <div className="stat muted">
          <Info size={20} /> {students.length - todayAtt.length} Not marked
        </div>
      </div>

      <div className="list">
        {students.map(s => {
          const att = getAtt(s._id);
          return (
            <div key={s._id} className="attendance-card">
              <div>
                <strong>{s.name}</strong>
                <p className="muted small">Roll #{s.rollNumber}</p>
              </div>
              <div className="attendance-status">
                {att ? (
                  <>
                    {att.status === 'present' ? (
                      <span className="badge green">
                        <CheckCircle size={14} /> Present
                        {att.inTime && ` ${att.inTime}`}
                        {att.outTime && ` - ${att.outTime}`}
                      </span>
                    ) : (
                      <span className="badge red">
                        <XCircle size={14} /> Absent {att.reason && `(${att.reason})`}
                      </span>
                    )}
                    {att.markedBy === 'teacher' && (
                      <span className="badge gray" title="Teacher marked">
                        <Info size={12} /> Marked by you
                      </span>
                    )}
                    {att.markedBy === 'self' && (
                      <span className="badge blue" title="Self marked">
                        <Info size={12} /> Self-marked
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <button className="btn-mini btn-green" onClick={() => markPresent(s._id)}>
                      <CheckCircle size={14} /> Mark Present
                    </button>
                    <button className="btn-mini btn-red" onClick={() => setMarkingStudent(s)}>
                      <XCircle size={14} /> Mark Absent
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {markingStudent && (
        <Modal onClose={() => setMarkingStudent(null)} title={`Mark ${markingStudent.name} Absent`}>
          <label>Reason for absence (optional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Sick, family event" autoFocus />
          <div className="modal-buttons">
            <button className="btn btn-outline" onClick={() => setMarkingStudent(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={markAbsent}>Mark Absent</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StudentsTab({ info }) {
  const [students, setStudents] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/students');
      setStudents(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!confirm('Delete this student? All their attendance records will also be deleted.')) return;
    await api.delete('/students/' + id);
    load();
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.rollNumber || '').includes(search) ||
    (s.phone || '').includes(search)
  );

  if (loading) return <p className="muted">Loading...</p>;

  return (
    <div>
      <div className="toolbar">
        <div className="search-bar">
          <Search size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students" />
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add Student
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="empty">
          <Users size={48} color="#999" />
          <h3>{students.length === 0 ? 'No students yet' : 'No matching students'}</h3>
          <p className="muted">{students.length === 0 ? 'Click "Add Student" to add your first one.' : 'Try a different search.'}</p>
        </div>
      )}

      <div className="list">
        {filtered.map(s => (
          <div key={s._id} className="student-card">
            <div>
              <strong>{s.name}</strong>
              <p className="muted small">Roll #{s.rollNumber} · {s.phone || 'No phone'}</p>
              {s.subjects && s.subjects.length > 0 && (
                <p className="small">Subjects: {s.subjects.join(', ')}</p>
              )}
              {s.registeredVia === 'self' && (
                <span className="badge blue small">Self-registered</span>
              )}
            </div>
            <div className="row-buttons">
              <button className="icon-btn" onClick={() => setEditing(s)} title="Edit">
                <Edit2 size={16} />
              </button>
              <button className="icon-btn icon-btn-danger" onClick={() => del(s._id)} title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <StudentForm
          info={info}
          student={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function StudentForm({ info, student, onClose, onSaved }) {
  const [form, setForm] = useState(student || {
    name: '', phone: '', parentName: '', parentPhone: '',
    aadhar: '', subjects: [], notes: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleSubject = (s) => {
    setForm(f => ({
      ...f,
      subjects: (f.subjects || []).includes(s)
        ? f.subjects.filter(x => x !== s)
        : [...(f.subjects || []), s]
    }));
  };

  const save = async () => {
    setError('');
    if (!form.name) { setError('Name is required'); return; }
    if (form.aadhar && !/^\d{12}$/.test(form.aadhar.replace(/\s/g, ''))) {
      setError('Aadhar must be 12 digits'); return;
    }
    setSaving(true);
    try {
      if (student) {
        await api.put('/students/' + student._id, form);
      } else {
        await api.post('/students', form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const availableSubjects = info.subjects && info.subjects.length ? info.subjects : ['Mathematics', 'Science', 'English'];

  return (
    <Modal onClose={onClose} title={student ? 'Edit Student' : 'Add New Student'}>
      <label>Name *</label>
      <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus />
      <label>Phone</label>
      <input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />
      <label>Parent Name</label>
      <input value={form.parentName || ''} onChange={e => setForm({...form, parentName: e.target.value})} />
      <label>Parent Phone</label>
      <input value={form.parentPhone || ''} onChange={e => setForm({...form, parentPhone: e.target.value})} />
      <label>Aadhar (12 digits)</label>
      <input value={form.aadhar || ''} onChange={e => setForm({...form, aadhar: e.target.value})} maxLength={12} />
      <label>Subjects</label>
      <div className="checkbox-group">
        {availableSubjects.map(s => (
          <label key={s} className="checkbox-label">
            <input
              type="checkbox"
              checked={(form.subjects || []).includes(s)}
              onChange={() => toggleSubject(s)}
            />
            <span>{s}</span>
          </label>
        ))}
      </div>
      <label>Notes</label>
      <textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} rows={3} />
      {error && <div className="error-box">{error}</div>}
      <div className="modal-buttons">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

function SummaryTab() {
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/students').then(r => {
      setStudents(r.data);
      setLoading(false);
    });
  }, []);

  const loadStudent = async (s) => {
    setSelected(s);
    const [summ, hist] = await Promise.all([
      api.get('/attendance/summary/' + s._id),
      api.get('/attendance/student/' + s._id),
    ]);
    setSummary(summ.data);
    setHistory(hist.data);
  };

  if (loading) return <p className="muted">Loading...</p>;
  if (students.length === 0) return (
    <div className="empty">
      <BarChart3 size={48} color="#999" />
      <h3>No students yet</h3>
      <p className="muted">Add students first to see summaries.</p>
    </div>
  );

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="summary-grid">
      <div>
        <div className="search-bar">
          <Search size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students" />
        </div>
        <div className="list">
          {filtered.map(s => (
            <button
              key={s._id}
              className={'list-item' + (selected?._id === s._id ? ' active' : '')}
              onClick={() => loadStudent(s)}
            >
              <div>
                <strong>{s.name}</strong>
                <p className="muted small">Roll #{s.rollNumber}</p>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </div>
      <div>
        {!selected ? (
          <div className="empty">
            <Search size={48} color="#999" />
            <h3>Select a student</h3>
            <p className="muted">Tap a student to see their attendance summary.</p>
          </div>
        ) : (
          <>
            <h2 className="display">{selected.name}</h2>
            <p className="muted">Roll #{selected.rollNumber}</p>
            {summary && (
              <div className="summary-stats">
                <div className="stat-big green">
                  <strong>{summary.present}</strong>
                  <span>Present</span>
                </div>
                <div className="stat-big red">
                  <strong>{summary.absent}</strong>
                  <span>Absent</span>
                </div>
                <div className="stat-big blue">
                  <strong>{summary.percentage}%</strong>
                  <span>Attendance</span>
                </div>
              </div>
            )}
            <h3>Attendance History</h3>
            <div className="list">
              {history.length === 0 && <p className="muted">No records yet.</p>}
              {history.map(h => (
                <div key={h._id} className="history-row">
                  <div>
                    <strong>{h.date}</strong>
                    {h.status === 'present' ? (
                      <span className="badge green small">
                        <CheckCircle size={12} /> Present {h.inTime && `· ${h.inTime} - ${h.outTime || '?'}`}
                      </span>
                    ) : (
                      <span className="badge red small">
                        <XCircle size={12} /> Absent {h.reason && `· ${h.reason}`}
                      </span>
                    )}
                  </div>
                  {h.markedBy === 'teacher' && <span className="small muted">Marked by you</span>}
                  {h.markedBy === 'self' && <span className="small muted">Self-marked</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AnnouncementsTab() {
  const [list, setList] = useState([]);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('general');
  const [message, setMessage] = useState('');
  const [dates, setDates] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await api.get('/announcements');
    setList(r.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!message) return;
    await api.post('/announcements', {
      message, type,
      dates: type === 'off-day' ? dates.split(',').map(d => d.trim()).filter(Boolean) : []
    });
    setMessage(''); setDates(''); setAdding(false);
    load();
  };

  const del = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    await api.delete('/announcements/' + id);
    load();
  };

  if (loading) return <p className="muted">Loading...</p>;

  return (
    <div>
      <div className="toolbar">
        <h2 className="display">Announcements</h2>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} /> New Announcement
        </button>
      </div>

      {list.length === 0 && (
        <div className="empty">
          <Megaphone size={48} color="#999" />
          <h3>No announcements yet</h3>
          <p className="muted">Send updates to all your students and parents.</p>
        </div>
      )}

      <div className="list">
        {list.map(a => (
          <div key={a._id} className="announcement-card">
            <div>
              {a.type === 'off-day' ? (
                <span className="badge red"><CalendarOff size={12} /> Off Day</span>
              ) : (
                <span className="badge blue"><MessageSquare size={12} /> General</span>
              )}
              <p>{a.message}</p>
              {a.dates && a.dates.length > 0 && (
                <p className="small muted">Dates: {a.dates.join(', ')}</p>
              )}
              <p className="small muted">{new Date(a.createdAt).toLocaleString()}</p>
            </div>
            <button className="icon-btn icon-btn-danger" onClick={() => del(a._id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <Modal onClose={() => setAdding(false)} title="Send Announcement">
          <label>Type</label>
          <div className="radio-group">
            <label className="radio-label">
              <input type="radio" value="general" checked={type === 'general'} onChange={e => setType(e.target.value)} />
              <span>General Message</span>
            </label>
            <label className="radio-label">
              <input type="radio" value="off-day" checked={type === 'off-day'} onChange={e => setType(e.target.value)} />
              <span>Off-day (Holiday)</span>
            </label>
          </div>
          <label>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Your message to students and parents" />
          {type === 'off-day' && (
            <>
              <label>Dates (comma-separated, format: YYYY-MM-DD)</label>
              <input value={dates} onChange={e => setDates(e.target.value)} placeholder="2026-01-26, 2026-08-15" />
            </>
          )}
          <div className="modal-buttons">
            <button className="btn btn-outline" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={send}>
              <Send size={14} /> Send to All
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SettingsTab({ info }) {
  const [form, setForm] = useState(info);
  const [subjectInput, setSubjectInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [pwds, setPwds] = useState({ teacherPassword: '', studentPassword: '', parentPassword: '' });

  useEffect(() => { setForm(info); }, [info]);

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (showPwd) {
        if (pwds.teacherPassword) body.teacherPassword = pwds.teacherPassword;
        if (pwds.studentPassword) body.studentPassword = pwds.studentPassword;
        if (pwds.parentPassword) body.parentPassword = pwds.parentPassword;
      }
      await api.put('/config', body);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setPwds({ teacherPassword: '', studentPassword: '', parentPassword: '' });
      setShowPwd(false);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    } finally { setSaving(false); }
  };

  const addSubject = () => {
    if (!subjectInput.trim()) return;
    setForm(f => ({ ...f, subjects: [...(f.subjects || []), subjectInput.trim()] }));
    setSubjectInput('');
  };

  const removeSubject = (s) => {
    setForm(f => ({ ...f, subjects: (f.subjects || []).filter(x => x !== s) }));
  };

  return (
    <div className="container-narrow">
      <h2 className="display">Coaching Center Settings</h2>
      <label>Coaching Name</label>
      <input value={form.classroomName || ''} onChange={e => setForm({...form, classroomName: e.target.value})} />
      <label>Teacher Name</label>
      <input value={form.teacherName || ''} onChange={e => setForm({...form, teacherName: e.target.value})} />
      <label>Phone</label>
      <input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />
      <label>Email</label>
      <input value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} />
      <label>Map URL (Google Maps link)</label>
      <input value={form.mapUrl || ''} onChange={e => setForm({...form, mapUrl: e.target.value})} />
      <label>Class Start Time</label>
      <input type="time" value={form.classStart || ''} onChange={e => setForm({...form, classStart: e.target.value})} />
      <label>Class End Time</label>
      <input type="time" value={form.classEnd || ''} onChange={e => setForm({...form, classEnd: e.target.value})} />

      <label>Subjects Taught</label>
      <div className="chip-group">
        {(form.subjects || []).map(s => (
          <span key={s} className="chip">
            {s} <button onClick={() => removeSubject(s)}><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="row">
        <input value={subjectInput} onChange={e => setSubjectInput(e.target.value)} placeholder="Add a subject" onKeyDown={e => e.key === 'Enter' && addSubject()} />
        <button className="btn btn-outline" onClick={addSubject}>
          <Plus size={14} /> Add
        </button>
      </div>

      <hr />

      <div className="row">
        <h3>Change Passwords</h3>
        <button className="btn-link" onClick={() => setShowPwd(!showPwd)}>
          {showPwd ? 'Cancel' : 'Change passwords'}
        </button>
      </div>
      {showPwd && (
        <>
          <label>New Teacher Password</label>
          <input type="text" value={pwds.teacherPassword} onChange={e => setPwds({...pwds, teacherPassword: e.target.value})} placeholder="Leave blank to keep current" />
          <label>New Student Password</label>
          <input type="text" value={pwds.studentPassword} onChange={e => setPwds({...pwds, studentPassword: e.target.value})} placeholder="Leave blank to keep current" />
          <label>New Parent Password</label>
          <input type="text" value={pwds.parentPassword} onChange={e => setPwds({...pwds, parentPassword: e.target.value})} placeholder="Leave blank to keep current" />
        </>
      )}

      <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>
        <Save size={14} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}

// ============================
// STUDENT DASHBOARD
// ============================
function StudentDashboard({ student, info, onSignOut }) {
  const [tab, setTab] = useState('today');
  const [todayAtt, setTodayAtt] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [announcements, setAnnouncements] = useState([]);

  const load = async () => {
    if (!student) return;
    try {
      const [hist, summ, anns] = await Promise.all([
        api.get('/attendance/student/' + student._id),
        api.get('/attendance/summary/' + student._id),
        api.get('/announcements'),
      ]);
      setHistory(hist.data);
      setSummary(summ.data);
      setAnnouncements(anns.data);
      const today = new Date().toISOString().split('T')[0];
      setTodayAtt(hist.data.find(h => h.date === today));
    } catch (err) { console.error(err); }
  };

  useEffect(() => { load(); }, [student]);

  const checkIn = async () => {
    try {
      await api.post('/attendance/check', { studentId: student._id, action: 'in' });
      load();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const checkOut = async () => {
    try {
      await api.post('/attendance/check', { studentId: student._id, action: 'out' });
      load();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  return (
    <div className="page">
      <header className="dashboard-header">
        <div>
          <h1 className="display">Hi, {student?.name}</h1>
          <p className="muted">Roll #{student?.rollNumber}</p>
        </div>
        <button className="btn btn-outline" onClick={onSignOut}>
          <LogOut size={16} /> Sign out
        </button>
      </header>

      <nav className="tabs">
        <button className={tab === 'today' ? 'tab active' : 'tab'} onClick={() => setTab('today')}>
          <Calendar size={16} /> Today
        </button>
        <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
          <BarChart3 size={16} /> My Attendance
        </button>
        <button className={tab === 'announcements' ? 'tab active' : 'tab'} onClick={() => setTab('announcements')}>
          <Megaphone size={16} /> Updates
        </button>
        <button className={tab === 'info' ? 'tab active' : 'tab'} onClick={() => setTab('info')}>
          <Info size={16} /> Class Info
        </button>
      </nav>

      <main className="tab-content">
        {tab === 'today' && (
          <div className="center-content">
            <h2 className="display">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            {todayAtt ? (
              <div className="big-card green">
                <CheckCircle size={48} />
                <h3>You're marked Present!</h3>
                {todayAtt.inTime && <p>Checked in at: <strong>{todayAtt.inTime}</strong></p>}
                {todayAtt.outTime && <p>Checked out at: <strong>{todayAtt.outTime}</strong></p>}
                {todayAtt.markedBy === 'teacher' && <p className="small">Marked by your teacher</p>}
                <div className="row-center">
                  {!todayAtt.outTime && (
                    <button className="btn btn-primary btn-lg" onClick={checkOut}>
                      <Clock size={18} /> Check Out
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="big-card">
                <Clock size={48} />
                <h3>Ready to mark your attendance?</h3>
                <p className="muted">Tap below when you arrive at class</p>
                <button className="btn btn-primary btn-lg" onClick={checkIn}>
                  <CheckCircle size={18} /> Check In Now
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && summary && (
          <div>
            <div className="summary-stats">
              <div className="stat-big green">
                <strong>{summary.present}</strong>
                <span>Days Present</span>
              </div>
              <div className="stat-big red">
                <strong>{summary.absent}</strong>
                <span>Days Absent</span>
              </div>
              <div className="stat-big blue">
                <strong>{summary.percentage}%</strong>
                <span>Attendance</span>
              </div>
            </div>
            <h3>Recent History</h3>
            <div className="list">
              {history.length === 0 && <p className="muted">No records yet.</p>}
              {history.map(h => (
                <div key={h._id} className="history-row">
                  <strong>{h.date}</strong>
                  {h.status === 'present' ? (
                    <span className="badge green small">
                      <CheckCircle size={12} /> Present {h.inTime && `· ${h.inTime} - ${h.outTime || '?'}`}
                    </span>
                  ) : (
                    <span className="badge red small">
                      <XCircle size={12} /> Absent {h.reason && `· ${h.reason}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'announcements' && (
          <div>
            <h2 className="display">Updates from your teacher</h2>
            {announcements.length === 0 && (
              <div className="empty">
                <Megaphone size={48} color="#999" />
                <p className="muted">No announcements yet.</p>
              </div>
            )}
            <div className="list">
              {announcements.map(a => (
                <div key={a._id} className="announcement-card">
                  <div>
                    {a.type === 'off-day' ? (
                      <span className="badge red"><CalendarOff size={12} /> Holiday</span>
                    ) : (
                      <span className="badge blue"><MessageSquare size={12} /> Update</span>
                    )}
                    <p>{a.message}</p>
                    {a.dates && a.dates.length > 0 && <p className="small muted">Dates: {a.dates.join(', ')}</p>}
                    <p className="small muted">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'info' && <ClassInfo info={info} />}
      </main>
    </div>
  );
}

// ============================
// PARENT DASHBOARD
// ============================
function ParentDashboard({ student, info, onSignOut }) {
  const [tab, setTab] = useState('summary');
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [announcements, setAnnouncements] = useState([]);

  const load = async () => {
    if (!student) return;
    try {
      const [hist, summ, anns] = await Promise.all([
        api.get('/attendance/student/' + student._id),
        api.get('/attendance/summary/' + student._id),
        api.get('/announcements'),
      ]);
      setHistory(hist.data);
      setSummary(summ.data);
      setAnnouncements(anns.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { load(); }, [student]);

  const today = new Date().toISOString().split('T')[0];
  const todayAtt = history.find(h => h.date === today);

  return (
    <div className="page">
      <header className="dashboard-header">
        <div>
          <h1 className="display">{student?.name}'s Attendance</h1>
          <p className="muted">Roll #{student?.rollNumber}</p>
        </div>
        <button className="btn btn-outline" onClick={onSignOut}>
          <LogOut size={16} /> Sign out
        </button>
      </header>

      <nav className="tabs">
        <button className={tab === 'summary' ? 'tab active' : 'tab'} onClick={() => setTab('summary')}>
          <BarChart3 size={16} /> Summary
        </button>
        <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
          <Calendar size={16} /> History
        </button>
        <button className={tab === 'announcements' ? 'tab active' : 'tab'} onClick={() => setTab('announcements')}>
          <Megaphone size={16} /> Updates
        </button>
        <button className={tab === 'info' ? 'tab active' : 'tab'} onClick={() => setTab('info')}>
          <Info size={16} /> Class Info
        </button>
      </nav>

      <main className="tab-content">
        {tab === 'summary' && summary && (
          <div>
            <div className="today-status">
              {todayAtt ? (
                <div className={'big-card ' + (todayAtt.status === 'present' ? 'green' : 'red')}>
                  {todayAtt.status === 'present' ? <CheckCircle size={48} /> : <XCircle size={48} />}
                  <h3>Today: {todayAtt.status === 'present' ? 'Present' : 'Absent'}</h3>
                  {todayAtt.inTime && <p>Checked in at: <strong>{todayAtt.inTime}</strong></p>}
                  {todayAtt.outTime && <p>Checked out at: <strong>{todayAtt.outTime}</strong></p>}
                  {todayAtt.reason && <p>Reason: <strong>{todayAtt.reason}</strong></p>}
                  {todayAtt.markedBy === 'teacher' && <p className="small">Marked by teacher</p>}
                  {todayAtt.markedBy === 'self' && <p className="small">Marked by student</p>}
                </div>
              ) : (
                <div className="big-card muted-card">
                  <Clock size={48} />
                  <h3>Not marked yet today</h3>
                  <p className="muted">{student?.name} hasn't checked in yet.</p>
                </div>
              )}
            </div>

            <div className="summary-stats">
              <div className="stat-big green">
                <strong>{summary.present}</strong>
                <span>Days Present</span>
              </div>
              <div className="stat-big red">
                <strong>{summary.absent}</strong>
                <span>Days Absent</span>
              </div>
              <div className="stat-big blue">
                <strong>{summary.percentage}%</strong>
                <span>Attendance</span>
              </div>
            </div>

            {summary.absentDays && summary.absentDays.length > 0 && (
              <>
                <h3>Recent Absences</h3>
                <div className="list">
                  {summary.absentDays.slice(0, 5).map((a, i) => (
                    <div key={i} className="history-row">
                      <strong>{a.date}</strong>
                      <span className="small muted">{a.reason}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div>
            <h3>Full Attendance Record</h3>
            <div className="list">
              {history.length === 0 && <p className="muted">No records yet.</p>}
              {history.map(h => (
                <div key={h._id} className="history-row">
                  <div>
                    <strong>{h.date}</strong>
                    {h.status === 'present' ? (
                      <span className="badge green small">
                        <CheckCircle size={12} /> Present {h.inTime && `· ${h.inTime} - ${h.outTime || '?'}`}
                      </span>
                    ) : (
                      <span className="badge red small">
                        <XCircle size={12} /> Absent {h.reason && `· ${h.reason}`}
                      </span>
                    )}
                  </div>
                  {h.markedBy === 'teacher' && <span className="small muted">Marked by teacher</span>}
                  {h.markedBy === 'self' && <span className="small muted">Self-marked</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'announcements' && (
          <div>
            <h2 className="display">Updates from the teacher</h2>
            {announcements.length === 0 && (
              <div className="empty">
                <Megaphone size={48} color="#999" />
                <p className="muted">No announcements yet.</p>
              </div>
            )}
            <div className="list">
              {announcements.map(a => (
                <div key={a._id} className="announcement-card">
                  <div>
                    {a.type === 'off-day' ? (
                      <span className="badge red"><CalendarOff size={12} /> Holiday</span>
                    ) : (
                      <span className="badge blue"><MessageSquare size={12} /> Update</span>
                    )}
                    <p>{a.message}</p>
                    {a.dates && a.dates.length > 0 && <p className="small muted">Dates: {a.dates.join(', ')}</p>}
                    <p className="small muted">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'info' && <ClassInfo info={info} />}
      </main>
    </div>
  );
}

// ============================
// SHARED: CLASS INFO
// ============================
function ClassInfo({ info }) {
  return (
    <div className="container-narrow">
      <h2 className="display">{info.classroomName || 'Coaching Center'}</h2>
      <div className="info-grid">
        {info.teacherName && (
          <div className="info-row">
            <User size={18} /><span>Teacher: {info.teacherName}</span>
          </div>
        )}
        {info.phone && (
          <div className="info-row">
            <Phone size={18} /><a href={`tel:${info.phone}`}>{info.phone}</a>
          </div>
        )}
        {info.email && (
          <div className="info-row">
            <Mail size={18} /><a href={`mailto:${info.email}`}>{info.email}</a>
          </div>
        )}
        {info.mapUrl && (
          <div className="info-row">
            <MapPin size={18} /><a href={info.mapUrl} target="_blank" rel="noreferrer">View Location on Map</a>
          </div>
        )}
        {info.classStart && info.classEnd && (
          <div className="info-row">
            <Clock size={18} /><span>Class: {info.classStart} - {info.classEnd}</span>
          </div>
        )}
        {info.subjects && info.subjects.length > 0 && (
          <div className="info-row">
            <BookOpen size={18} /><span>Subjects: {info.subjects.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================
// SHARED: MODAL
// ============================
function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
