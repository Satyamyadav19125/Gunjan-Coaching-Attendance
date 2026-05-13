import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, LogIn, LogOut, User, Users, UserPlus,
  Calendar, CalendarOff, Clock, Phone, Mail, MapPin,
  Plus, Trash2, Edit2, Save, X, Search,
  ChevronRight, ArrowLeft, CheckCircle, XCircle,
  AlertTriangle, Info, BarChart3, MessageSquare, Send,
  Megaphone, Eye, EyeOff, BookOpen, Settings,
  Cake, Share2, MessageCircle, CalendarDays, Copy,
  Wallet, RotateCcw, KeyRound, IndianRupee, Layers
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
// HELPERS
// ============================
const TZ = 'Asia/Kolkata';

const todayISO = () => {
  // Local date in IST as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
};

const thisMonth = () => todayISO().substring(0, 7);

const isOffDayToday = (announcements, batchId) => {
  const today = todayISO();
  return announcements.find(a =>
    a.type === 'off-day' && a.dates && a.dates.includes(today) &&
    (!a.batchId || !batchId || a.batchId === batchId || a.batchId === '')
  );
};

const isBirthdayToday = (birthday) => {
  if (!birthday) return false;
  const today = new Date();
  const parts = birthday.split('-');
  if (parts.length < 3) return false;
  return parseInt(parts[1]) === today.getMonth() + 1 &&
         parseInt(parts[2]) === today.getDate();
};

const cleanPhone = (phone) => (phone || '').replace(/\D/g, '');

const whatsappLink = (phone, text) => {
  let num = cleanPhone(phone);
  if (num && num.length === 10) num = '91' + num;
  const t = encodeURIComponent(text || '');
  return num ? `https://wa.me/${num}?text=${t}` : `https://wa.me/?text=${t}`;
};

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch { return iso; }
};

const formatRupee = (n) => '₹' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const getSubjectName = (s) => typeof s === 'string' ? s : s?.name;

// Find a batch object from its id within an info.batches array
const findBatch = (info, batchId) => (info?.batches || []).find(b => String(b._id) === String(batchId));

// Find a class object by name (classes are keyed by name)
const findClass = (info, name) => (info?.classes || []).find(c => c.name === name);

// ============================
// MAIN APP
// ============================
export default function App() {
  const [view, setView] = useState('landing');
  const [info, setInfo] = useState({});
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [selectedStudent, setSelectedStudent] = useState(
    JSON.parse(localStorage.getItem('selectedStudent') || 'null')
  );
  const [announcements, setAnnouncements] = useState([]);

  const refreshInfo = useCallback(async () => {
    try {
      // Authenticated /config returns the full doc including _id'd batches/subjects;
      // fall back to public/info when not logged in or on error.
      const tok = localStorage.getItem('token');
      if (tok) {
        const r = await api.get('/config');
        if (r.data) { setInfo(r.data); return; }
      }
      const r2 = await api.get('/public/info');
      setInfo(r2.data);
    } catch {
      try { const r2 = await api.get('/public/info'); setInfo(r2.data); } catch {}
    }
  }, []);

  useEffect(() => {
    refreshInfo();
    const savedRole = localStorage.getItem('role');
    const savedStudent = JSON.parse(localStorage.getItem('selectedStudent') || 'null');
    if (savedRole === 'teacher') setView('teacher');
    else if (savedRole === 'parent' && savedStudent) setView('parent');
    // legacy 'student' role: clear it; that flow no longer exists
    else if (savedRole === 'student') { localStorage.clear(); }
  }, [refreshInfo]);

  useEffect(() => {
    if (role) {
      api.get('/announcements').then(r => setAnnouncements(r.data)).catch(() => {});
    }
  }, [role, view]);

  const handleSignOut = () => {
    localStorage.clear();
    setRole(null);
    setSelectedStudent(null);
    setView('landing');
    refreshInfo();
  };

  if (view === 'landing') return <Landing info={info} onSignIn={() => setView('login')} onRegister={() => setView('register')} onParentLogin={() => setView('parent-login')} />;
  if (view === 'register') return <Register info={info} onBack={() => setView('landing')} onDone={() => setView('login')} />;
  if (view === 'login') return <Login info={info} onBack={() => setView('landing')} onLogin={(r) => {
    setRole(r); refreshInfo();
    setView('teacher');
  }} />;
  if (view === 'parent-login') return <ParentLogin info={info} onBack={() => setView('landing')} onLogin={(student) => {
    setRole('parent'); setSelectedStudent(student);
    localStorage.setItem('selectedStudent', JSON.stringify(student));
    refreshInfo();
    setView('parent');
  }} />;
  if (view === 'teacher') return <TeacherDashboard info={info} announcements={announcements} onSignOut={handleSignOut} refreshInfo={refreshInfo} />;
  if (view === 'parent') return <ParentDashboard student={selectedStudent} info={info} announcements={announcements} onSignOut={handleSignOut} />;
  return null;
}

// ============================
// OFF-DAY BANNER (shared)
// ============================
function OffDayBanner({ announcements, batchId }) {
  const off = isOffDayToday(announcements, batchId);
  if (!off) return null;
  return (
    <div className="off-day-banner">
      <CalendarOff size={20} />
      <div>
        <strong>Today is a holiday</strong>
        <p>{off.message}</p>
      </div>
    </div>
  );
}

// ============================
// LANDING
// ============================
function Landing({ info, onSignIn, onRegister, onParentLogin }) {
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
        <h1 className="display">Smart Attendance for {info.classroomName || 'Your Coaching Center'}</h1>
        <p>Students check in with one tap. Parents see real-time updates. Teachers manage everything from one dashboard.</p>
        <div className="hero-buttons">
          <button className="btn btn-primary btn-lg" onClick={onSignIn}>
            <LogIn size={18} /> Teacher Sign In
          </button>
          <button className="btn btn-secondary btn-lg" onClick={onParentLogin}>
            <KeyRound size={18} /> Parent Login with Code
          </button>
          <button className="btn btn-outline btn-lg" onClick={onRegister}>
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
            <p>The teacher hands the device over and the student taps their own name. No password to remember, no way to mark yourself absent.</p>
          </div>
          <div className="card">
            <BarChart3 size={32} color="#d97706" />
            <h3>Parents Track Progress</h3>
            <p>Each parent gets a unique code and sees only their own child's data. Stay logged in until you tap log out.</p>
          </div>
          <div className="card">
            <Settings size={32} color="#dc2626" />
            <h3>Teacher Controls Everything</h3>
            <p>Classes with their own monthly fees, batches with their own timings, holidays, announcements, WhatsApp sharing — all in one place.</p>
          </div>
        </div>
      </section>

      <section className="info-section">
        <h2 className="display">About Us</h2>
        <div className="info-grid">
          {info.teacherName && <div className="info-row"><User size={18} /><span>{info.teacherName}</span></div>}
          {info.phone && <div className="info-row"><Phone size={18} /><a href={`tel:${info.phone}`}>{info.phone}</a></div>}
          {info.email && <div className="info-row"><Mail size={18} /><a href={`mailto:${info.email}`}>{info.email}</a></div>}
          {info.mapUrl && <div className="info-row"><MapPin size={18} /><a href={info.mapUrl} target="_blank" rel="noreferrer">View Location</a></div>}
          {info.classStart && info.classEnd && <div className="info-row"><Clock size={18} /><span>Class: {info.classStart} - {info.classEnd}</span></div>}
        </div>
        <p className="tip muted text-center small">
          <Info size={14} /> Tip: Add this page to your home screen for one-tap access!
        </p>
      </section>

      <footer className="footer">
        <p>© {new Date().getFullYear()} {info.classroomName || 'Coaching Center'} · Attendance System</p>
      </footer>
    </div>
  );
}

// ============================
// LOGIN (teacher only — parents use code, students use teacher's device)
// ============================
function Login({ info, onBack, onLogin }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/login', { password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', res.data.role);
      onLogin(res.data.role, []);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="page-center">
      <div className="container-narrow">
        <button className="btn-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <div className="auth-grid">
          <div>
            <h1 className="display">{info.classroomName || 'Coaching Center'}</h1>
            <p className="muted">Teacher sign-in.</p>
            <div className="role-card role-teacher">
              <h3>🎓 Teacher</h3>
              <p>Use your teacher password to manage everything.</p>
            </div>
            <div className="role-card role-parent">
              <h3>👨‍👩‍👧 Parent?</h3>
              <p>Parents log in with a <strong>unique code</strong> from the teacher. <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>Go back</a> and tap "Parent Login with Code".</p>
            </div>
            <div className="role-card role-student">
              <h3>📚 Student?</h3>
              <p>Students mark themselves present on the teacher's device — no login needed.</p>
            </div>
          </div>
          <div className="auth-form">
            <h2 className="display">Teacher Sign In</h2>
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
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================
// PARENT LOGIN (code only) — feature #13
// ============================
function ParentLogin({ info, onBack, onLogin }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/parent-login', { code: code.toUpperCase().trim() });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', 'parent');
      onLogin(res.data.student);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
    } finally { setLoading(false); }
  };

  return (
    <div className="page-center">
      <div className="container-narrow">
        <button className="btn-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <div className="auth-form" style={{ maxWidth: 480, margin: '0 auto' }}>
          <h1 className="display"><KeyRound size={22} /> Parent Login</h1>
          <p className="muted">Enter the unique code your teacher gave you. You'll see your child's attendance and fees only — no other children.</p>
          <form onSubmit={submit}>
            <label>Parent Code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB23CD"
              maxLength={10}
              autoFocus
              style={{ fontSize: 20, letterSpacing: 4, textAlign: 'center', textTransform: 'uppercase' }}
            />
            {error && <div className="error-box">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || !code}>
              {loading ? 'Checking...' : 'View My Child'}
            </button>
          </form>
          <hr />
          <p className="text-center small muted">
            Don't have a code? Ask {info.teacherName || 'the teacher'} for it.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================
// REGISTER (self-registration form)
// ============================
function Register({ info, onBack, onDone }) {
  const [form, setForm] = useState({
    name: '', phone: '', parentName: '', parentPhone: '',
    aadhar: '', birthday: '', subjects: [], notes: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdStudent, setCreatedStudent] = useState(null);

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
    if (!form.name || !form.phone) { setError('Name and phone are required'); return; }
    if (!validateAadhar(form.aadhar)) { setError('Aadhar must be 12 digits'); return; }
    setLoading(true);
    try {
      const r = await api.post('/public/register', form);
      setCreatedStudent(r.data.student);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <div className="page-center">
        <div className="container-narrow">
          <div className="success-box">
            <CheckCircle size={48} color="#16a34a" />
            <h2 className="display">Welcome, {form.name}!</h2>
            <p>You're now registered at {info.classroomName || 'our coaching center'}.</p>
            <p className="muted">Ask your teacher for the student password to log in.</p>
            {createdStudent?.parentCode && (
              <div className="code-box" style={{ marginTop: 16 }}>
                <span className="muted small">Parent code (give this to your parent):</span>
                <strong>{createdStudent.parentCode}</strong>
              </div>
            )}
            <button className="btn btn-primary btn-lg" onClick={onDone}>Go to Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  const availableSubjects = (info.subjects || []).map(getSubjectName).filter(Boolean);
  const fallback = availableSubjects.length ? availableSubjects : ['Mathematics', 'Science', 'English'];

  return (
    <div className="page-center">
      <div className="container-narrow">
        <button className="btn-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <div className="auth-form">
          <h1 className="display">Register as New Student</h1>
          <p className="muted">Fill in your details to join {info.classroomName || 'our coaching center'}</p>
          <form onSubmit={submit}>
            <label>Student Name *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your full name" required />

            <label>Phone Number *</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="10-digit phone number" required />

            <label>Date of Birth</label>
            <input type="date" value={form.birthday} onChange={e => setForm({...form, birthday: e.target.value})} />

            <label>Parent / Guardian Name</label>
            <input value={form.parentName} onChange={e => setForm({...form, parentName: e.target.value})} placeholder="Parent's name" />

            <label>Parent / Guardian Phone</label>
            <input value={form.parentPhone} onChange={e => setForm({...form, parentPhone: e.target.value})} placeholder="Parent's phone number" />

            <label>Aadhar Number (optional)</label>
            <input value={form.aadhar} onChange={e => setForm({...form, aadhar: e.target.value})} placeholder="12-digit Aadhar" maxLength={12} />

            <label>Subjects you want to learn</label>
            <div className="checkbox-group">
              {fallback.map(s => (
                <label key={s} className="checkbox-label">
                  <input type="checkbox" checked={form.subjects.includes(s)} onChange={() => toggleSubject(s)} />
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
// PICK STUDENT (now only used by 'student' role) — has "Back" if wrong tap (feature #1)
// ============================
function PickStudent({ students, role, onPick, onBack }) {
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(null);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.rollNumber || '').includes(search)
  );
  return (
    <div className="page-center">
      <div className="container-narrow">
        <button className="btn-back" onClick={onBack}><ArrowLeft size={16} /> Sign out</button>
        <h1 className="display">Who Are You?</h1>
        <p className="muted">Tap your name to continue. Tapped wrong? You'll get a chance to go back.</p>
        <div className="search-bar">
          <Search size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or roll number" autoFocus />
        </div>
        <div className="list">
          {filtered.length === 0 && <p className="muted text-center">No students found.</p>}
          {filtered.map(s => (
            <button key={s._id} className="list-item" onClick={() => setConfirming(s)}>
              <div>
                <strong>{s.name}</strong>
                <p className="muted small">Roll #{s.rollNumber}</p>
              </div>
              <ChevronRight size={20} />
            </button>
          ))}
        </div>

        {confirming && (
          <Modal onClose={() => setConfirming(null)} title="Is this you?">
            <div className="text-center" style={{ padding: '12px 0' }}>
              <h2 className="display" style={{ marginBottom: 4 }}>{confirming.name}</h2>
              <p className="muted">Roll #{confirming.rollNumber}</p>
            </div>
            <div className="modal-buttons">
              <button className="btn btn-outline" onClick={() => setConfirming(null)}>
                <ArrowLeft size={14} /> No, go back
              </button>
              <button className="btn btn-primary" onClick={() => { const s = confirming; setConfirming(null); onPick(s); }}>
                Yes, that's me <ChevronRight size={14} />
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

// ============================
// TEACHER DASHBOARD
// ============================
function TeacherDashboard({ info, announcements, onSignOut, refreshInfo }) {
  const [tab, setTab] = useState('today');
  return (
    <div className="page">
      <header className="dashboard-header">
        <div>
          <h1 className="display">Teacher Dashboard</h1>
          <p className="muted">Welcome back, {info.teacherName || 'Teacher'}</p>
        </div>
        <button className="btn btn-outline" onClick={onSignOut}><LogOut size={16} /> Sign out</button>
      </header>

      <OffDayBanner announcements={announcements} />

      <nav className="tabs">
        <button className={tab === 'today' ? 'tab active' : 'tab'} onClick={() => setTab('today')}><Calendar size={16} /> Today</button>
        <button className={tab === 'students' ? 'tab active' : 'tab'} onClick={() => setTab('students')}><Users size={16} /> Students</button>
        <button className={tab === 'summary' ? 'tab active' : 'tab'} onClick={() => setTab('summary')}><BarChart3 size={16} /> Summary</button>
        <button className={tab === 'fees' ? 'tab active' : 'tab'} onClick={() => setTab('fees')}><Wallet size={16} /> Fees</button>
        <button className={tab === 'announcements' ? 'tab active' : 'tab'} onClick={() => setTab('announcements')}><Megaphone size={16} /> Announcements</button>
        <button className={tab === 'settings' ? 'tab active' : 'tab'} onClick={() => setTab('settings')}><Settings size={16} /> Settings</button>
      </nav>

      <main className="tab-content">
        {tab === 'today' && <TodayTab info={info} announcements={announcements} />}
        {tab === 'students' && <StudentsTab info={info} refreshInfo={refreshInfo} />}
        {tab === 'summary' && <SummaryTab info={info} />}
        {tab === 'fees' && <FeesTab info={info} />}
        {tab === 'announcements' && <AnnouncementsTab info={info} />}
        {tab === 'settings' && <SettingsTab info={info} refreshInfo={refreshInfo} />}
      </main>
    </div>
  );
}

// ============================
// STUDENT MODE PICKER — student picks themselves on teacher's device
// ============================
function StudentModePicker({ students, todayAtt, onCancel, onMarked }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const markedIds = new Set(todayAtt.map(a => String(a.studentId)));
  const available = students.filter(s => !markedIds.has(String(s._id)));
  const filtered = available.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    (s.rollNumber || '').includes(q)
  );

  const confirm = async () => {
    if (!picked) return;
    setSubmitting(true);
    try {
      // Student-side check-in (markedBy = 'self')
      await api.post('/attendance/self-mark', { studentId: picked._id });
      onMarked(picked.name);
    } catch (err) {
      alert('Could not mark: ' + (err.response?.data?.error || err.message));
      setSubmitting(false);
    }
  };

  if (picked) {
    return (
      <div className="student-mode">
        <h2 className="display">Is this you?</h2>
        <div className="picked-card">
          <div className="picked-name">{picked.name}</div>
          <div className="muted">Roll #{picked.rollNumber}</div>
        </div>
        <div className="row" style={{ gap: 12, marginTop: 24 }}>
          <button className="btn btn-outline btn-lg" onClick={() => setPicked(null)} disabled={submitting}>Not me</button>
          <button className="btn btn-primary btn-lg" onClick={confirm} disabled={submitting}>
            {submitting ? 'Marking...' : 'Yes, mark me present'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="student-mode">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="display">Tap your name</h2>
        <button className="btn-link" onClick={onCancel}><ArrowLeft size={14} /> Hand back to teacher</button>
      </div>
      <input
        className="search-big"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by name or roll number..."
        autoFocus
      />
      {available.length === 0 ? (
        <p className="muted">Everyone has been marked today. ✨</p>
      ) : (
        <div className="student-mode-list">
          {filtered.map(s => (
            <button key={s._id} className="student-mode-tile" onClick={() => setPicked(s)}>
              <strong>{s.name}</strong>
              <span className="muted small">Roll #{s.rollNumber}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="muted">No matches.</p>}
        </div>
      )}
    </div>
  );
}

// ============================
// TODAY TAB — with "Unmark" undo (feature #9) + Student Mode (feature: hand-to-student)
// ============================
function TodayTab({ info, announcements }) {
  const [students, setStudents] = useState([]);
  const [todayAtt, setTodayAtt] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingStudent, setMarkingStudent] = useState(null);
  const [reason, setReason] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [batchFilter, setBatchFilter] = useState('');
  const [studentMode, setStudentMode] = useState(false);
  const [studentModeDone, setStudentModeDone] = useState(null); // name of who just marked, for confirmation

  const load = async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([api.get('/students'), api.get('/attendance/today')]);
      setStudents(s.data);
      setTodayAtt(a.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const getAtt = (id) => todayAtt.find(a => String(a.studentId) === String(id));

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
      setMarkingStudent(null); setReason(''); load();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  // Feature #9: undo a "marked present by mistake" record
  const unmark = async (studentId) => {
    if (!confirm('Roll back today\'s attendance for this student? It will go back to "not marked".')) return;
    try {
      await api.delete('/attendance/unmark', { data: { studentId } });
      load();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const markAllPresent = async () => {
    if (!confirm(batchFilter ? 'Mark everyone in this batch as present today?' : 'Mark all students as present today?')) return;
    setBulkLoading(true);
    try {
      const res = await api.post('/attendance/mark-all-present', batchFilter ? { batchId: batchFilter } : {});
      load();
      alert(`Marked ${res.data.marked} student(s) as present.`);
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setBulkLoading(false); }
  };

  if (loading) return <p className="muted">Loading...</p>;

  // STUDENT MODE — teacher hands the device over.
  if (studentModeDone) {
    return (
      <div className="student-mode-done">
        <div className="big-check">✓</div>
        <h2>Marked Present</h2>
        <p className="muted">{studentModeDone}, you're checked in for today.</p>
        <p className="small muted">Please hand the device back to the teacher.</p>
        <button className="btn btn-primary btn-lg" onClick={() => { setStudentModeDone(null); setStudentMode(false); load(); }}>
          Back to Teacher
        </button>
      </div>
    );
  }
  if (studentMode) {
    return (
      <StudentModePicker
        students={students}
        todayAtt={todayAtt}
        onCancel={() => setStudentMode(false)}
        onMarked={(name) => setStudentModeDone(name)}
      />
    );
  }

  const visible = batchFilter ? students.filter(s => s.batchId === batchFilter) : students;
  const birthdayStudents = visible.filter(s => isBirthdayToday(s.birthday));
  const offDay = isOffDayToday(announcements);

  if (students.length === 0) return (
    <div className="empty">
      <Users size={48} color="#999" />
      <h3>No students yet</h3>
      <p className="muted">Go to the Students tab to add your first student.</p>
    </div>
  );

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const visibleAtt = todayAtt.filter(a => visible.some(s => String(s._id) === String(a.studentId)));

  return (
    <div>
      {birthdayStudents.length > 0 && (
        <div className="birthday-banner">
          <Cake size={20} />
          <div>
            <strong>🎉 Today's Birthday{birthdayStudents.length > 1 ? 's' : ''}!</strong>
            <p>{birthdayStudents.map(s => s.name).join(', ')} — wish them a happy birthday!</p>
          </div>
        </div>
      )}

      <div className="stat-row">
        <div className="stat"><strong>{today}</strong></div>
        <div className="stat green"><CheckCircle size={20} /> {visibleAtt.filter(a => a.status === 'present').length} Present</div>
        <div className="stat red"><XCircle size={20} /> {visibleAtt.filter(a => a.status === 'absent').length} Absent</div>
        <div className="stat muted"><Info size={20} /> {visible.length - visibleAtt.length} Not marked</div>
      </div>

      <div className="toolbar">
        {(info.batches?.length || 0) > 0 && (
          <select className="sort-select" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {info.batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        )}
        {!offDay && (
          <button className="btn btn-green" onClick={markAllPresent} disabled={bulkLoading}>
            <CheckCircle size={16} /> {bulkLoading ? 'Marking...' : (batchFilter ? 'Mark Batch Present' : 'Mark Everyone Present')}
          </button>
        )}
        <button className="btn btn-outline" onClick={() => setStudentMode(true)} title="Let a student mark themselves on this device">
          <User size={16} /> Hand to Student
        </button>
      </div>

      <div className="list">
        {visible.map(s => {
          const att = getAtt(s._id);
          const batch = findBatch(info, s.batchId);
          return (
            <div key={s._id} className="attendance-card">
              <div>
                <strong>{s.name}</strong>
                {isBirthdayToday(s.birthday) && <span className="bday-pill">🎂 Birthday!</span>}
                <p className="muted small">
                  Roll #{s.rollNumber}
                  {batch ? ` · ${batch.name} (${batch.startTime}-${batch.endTime})` : ''}
                  {s.subjects?.length ? ' · ' + s.subjects.join(', ') : ''}
                </p>
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
                      <span className="badge red"><XCircle size={14} /> Absent {att.reason && `(${att.reason})`}</span>
                    )}
                    {att.markedBy === 'teacher' && (
                      <span className="badge gray small" title="Teacher marked"><Info size={12} /> Marked by you</span>
                    )}
                    {att.markedBy === 'self' && (
                      <span className="badge blue small" title="Self marked"><Info size={12} /> Self-marked</span>
                    )}
                    {/* Feature #9: undo / roll back today's mark */}
                    <button className="btn-mini btn-outline" onClick={() => unmark(s._id)} title="Roll back today's attendance">
                      <RotateCcw size={14} /> Undo
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-mini btn-green" onClick={() => markPresent(s._id)}><CheckCircle size={14} /> Present</button>
                    <button className="btn-mini btn-red" onClick={() => setMarkingStudent(s)}><XCircle size={14} /> Absent</button>
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

// ============================
// STUDENTS TAB — with batch column and parent-code display (features #4, #13)
// ============================
function StudentsTab({ info, refreshInfo }) {
  const [students, setStudents] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name');
  const [batchFilter, setBatchFilter] = useState('');
  const [showCodeFor, setShowCodeFor] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/students');
      setStudents(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!confirm('Delete this student? All their attendance records will be deleted too.')) return;
    await api.delete('/students/' + id);
    load();
  };

  const regenerateCode = async (id) => {
    if (!confirm('Generate a new parent code? The old code will stop working immediately.')) return;
    await api.post('/students/' + id + '/regenerate-code');
    load();
  };

  let filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.rollNumber || '').includes(search) ||
    (s.phone || '').includes(search)
  );
  if (batchFilter) filtered = filtered.filter(s => s.batchId === batchFilter);
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'roll') return (a.rollNumber || '').localeCompare(b.rollNumber || '');
    return 0;
  });

  if (loading) return <p className="muted">Loading...</p>;

  return (
    <div>
      <div className="toolbar">
        <div className="search-bar">
          <Search size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, roll, or phone" />
        </div>
        {(info.batches?.length || 0) > 0 && (
          <select className="sort-select" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {info.batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        )}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="sort-select">
          <option value="name">Sort by Name</option>
          <option value="roll">Sort by Roll #</option>
        </select>
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
        {filtered.map(s => {
          const batch = findBatch(info, s.batchId);
          return (
            <div key={s._id} className="student-card">
              <div>
                <strong>{s.name}</strong>
                {isBirthdayToday(s.birthday) && <span className="bday-pill">🎂</span>}
                <p className="muted small">Roll #{s.rollNumber} · {s.phone || 'No phone'}</p>
                {batch && <p className="small"><Layers size={12} /> Batch: <strong>{batch.name}</strong> ({batch.startTime}-{batch.endTime})</p>}
                {s.subjects?.length > 0 && <p className="small">Subjects: {s.subjects.join(', ')}</p>}
                {s.parentCode && (
                  <p className="small">
                    Parent code: <code className="inline-code">{s.parentCode}</code>{' '}
                    <button className="btn-link" onClick={() => setShowCodeFor(s)}>Show / share</button>
                  </p>
                )}
                {s.parentPhone && (
                  <p className="small">
                    Parent: {s.parentName || ''} ·{' '}
                    <a href={whatsappLink(s.parentPhone, `Hello, this is ${info.teacherName || 'your teacher'} from ${info.classroomName || 'coaching center'} about ${s.name}.`)} target="_blank" rel="noreferrer" className="wa-link">
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                  </p>
                )}
                {s.registeredVia === 'self' && <span className="badge blue small">Self-registered</span>}
              </div>
              <div className="row-buttons">
                <button className="icon-btn" onClick={() => setEditing(s)} title="Edit"><Edit2 size={16} /></button>
                <button className="icon-btn icon-btn-danger" onClick={() => del(s._id)} title="Delete"><Trash2 size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {(adding || editing) && (
        <StudentForm
          info={info}
          student={editing}
          refreshInfo={refreshInfo}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); load(); }}
        />
      )}

      {showCodeFor && (
        <Modal onClose={() => setShowCodeFor(null)} title={`Parent code for ${showCodeFor.name}`}>
          <div className="code-display">
            <div className="muted small">Give this code to the parent. Tapping the WhatsApp button below sends it for you.</div>
            <div className="code-big">{showCodeFor.parentCode}</div>
            <div className="row-buttons" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-outline btn-mini" onClick={() => navigator.clipboard?.writeText(showCodeFor.parentCode)}>
                <Copy size={14} /> Copy code
              </button>
              {showCodeFor.parentPhone && (
                <a
                  className="btn btn-whatsapp btn-mini"
                  href={whatsappLink(
                    showCodeFor.parentPhone,
                    `Hello! This is ${info.teacherName || 'your teacher'} from ${info.classroomName || 'coaching center'}.\n\nUse this code to view ${showCodeFor.name}'s attendance and fees:\n\n*${showCodeFor.parentCode}*\n\nOpen the website, tap "Parent Login with Code", and enter this code.`
                  )}
                  target="_blank" rel="noreferrer"
                >
                  <MessageCircle size={14} /> Send via WhatsApp
                </a>
              )}
              <button className="btn btn-outline btn-mini" onClick={() => { regenerateCode(showCodeFor._id); setShowCodeFor(null); }}>
                <RotateCcw size={14} /> Regenerate
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StudentForm({ info, student, onClose, onSaved, refreshInfo }) {
  // Make sure we always see the latest subjects/batches when this form opens (feature #12).
  useEffect(() => { if (refreshInfo) refreshInfo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState(student || {
    name: '', phone: '', parentName: '', parentPhone: '',
    aadhar: '', birthday: '', subjects: [], notes: '', batchId: '', className: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleSubject = (s) => {
    setForm(f => ({
      ...f,
      subjects: (f.subjects || []).includes(s) ? f.subjects.filter(x => x !== s) : [...(f.subjects || []), s]
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

  // Feature #5 + #12: always pull subjects from the latest info; fall back gracefully.
  const subjectOptions = ((info.subjects && info.subjects.length) ? info.subjects.map(getSubjectName) : ['Mathematics', 'Science', 'English']).filter(Boolean);

  return (
    <Modal onClose={onClose} title={student ? 'Edit Student' : 'Add New Student'}>
      <label>Name *</label>
      <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus />
      <label>Phone</label>
      <input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />
      <label>Date of Birth</label>
      <input type="date" value={form.birthday || ''} onChange={e => setForm({...form, birthday: e.target.value})} />
      <label>Parent Name</label>
      <input value={form.parentName || ''} onChange={e => setForm({...form, parentName: e.target.value})} />
      <label>Parent Phone</label>
      <input value={form.parentPhone || ''} onChange={e => setForm({...form, parentPhone: e.target.value})} />
      <label>Aadhar (12 digits)</label>
      <input value={form.aadhar || ''} onChange={e => setForm({...form, aadhar: e.target.value})} maxLength={12} />

      {/* Class - determines monthly fee */}
      <label>Class</label>
      {(info.classes?.length || 0) === 0 ? (
        <p className="small muted">No classes yet — add some in Settings → Classes.</p>
      ) : (
        <select value={form.className || ''} onChange={e => setForm({ ...form, className: e.target.value })}>
          <option value="">— No class —</option>
          {info.classes.map(c => (
            <option key={c.name} value={c.name}>{c.name} (₹{(c.monthlyFee || 0).toLocaleString('en-IN')}/month)</option>
          ))}
        </select>
      )}

      {/* Batch */}
      <label>Batch</label>
      {(info.batches?.length || 0) === 0 ? (
        <p className="small muted">No batches yet — add some in Settings → Batches.</p>
      ) : (
        <select value={form.batchId || ''} onChange={e => setForm({ ...form, batchId: e.target.value })}>
          <option value="">— No batch —</option>
          {info.batches.map(b => (
            <option key={b._id} value={b._id}>{b.name} ({b.startTime}-{b.endTime})</option>
          ))}
        </select>
      )}

      <label>Subjects</label>
      <div className="checkbox-group">
        {subjectOptions.length === 0 && <p className="small muted">No subjects yet — add some in Settings.</p>}
        {subjectOptions.map(s => (
          <label key={s} className="checkbox-label">
            <input type="checkbox" checked={(form.subjects || []).includes(s)} onChange={() => toggleSubject(s)} />
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

// ============================
// SUMMARY TAB — with batch chart (feature #10)
// ============================
function SummaryTab({ info }) {
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState('');
  const [allSummaries, setAllSummaries] = useState({}); // {studentId: {present, absent, percentage}}

  useEffect(() => {
    api.get('/students').then(async r => {
      setStudents(r.data);
      setLoading(false);
      // pre-fetch summaries for chart
      const map = {};
      await Promise.all(r.data.map(async s => {
        try {
          const sr = await api.get('/attendance/summary/' + s._id);
          map[s._id] = sr.data;
        } catch {}
      }));
      setAllSummaries(map);
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

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const filteredHistory = monthFilter ? history.filter(h => h.date.startsWith(monthFilter)) : history;
  const monthOptions = Array.from(new Set(history.map(h => h.date.substring(0, 7)))).sort().reverse();

  // Feature #10: per-batch attendance chart
  const batchGroups = {};
  const noBatchGroup = { name: 'No batch', percentages: [], students: [] };
  students.forEach(s => {
    const summ = allSummaries[s._id];
    const pct = summ?.percentage ?? 0;
    if (s.batchId) {
      const b = findBatch(info, s.batchId);
      const key = s.batchId;
      if (!batchGroups[key]) batchGroups[key] = { name: b?.name || 'Batch', percentages: [], students: [] };
      batchGroups[key].percentages.push(pct);
      batchGroups[key].students.push(s);
    } else {
      noBatchGroup.percentages.push(pct);
      noBatchGroup.students.push(s);
    }
  });
  const chartGroups = [...Object.values(batchGroups)];
  if (noBatchGroup.percentages.length) chartGroups.push(noBatchGroup);

  const shareWithParent = () => {
    if (!selected || !summary) return;
    const msg = `Hi! Attendance update for ${selected.name} (Roll #${selected.rollNumber}) from ${info.classroomName || 'our coaching center'}:\n\n` +
      `✅ Days Present: ${summary.present}\n` +
      `❌ Days Absent: ${summary.absent}\n` +
      `📊 Attendance: ${summary.percentage}%\n\n` +
      (summary.absentDays.length ? `Recent absences:\n${summary.absentDays.slice(0, 3).map(a => `• ${a.date} - ${a.reason}`).join('\n')}\n\n` : '') +
      `- ${info.teacherName || 'Teacher'}`;
    window.open(whatsappLink(selected.parentPhone, msg), '_blank');
  };

  return (
    <div>
      {/* Chart at the top */}
      <div className="chart-card">
        <h3><BarChart3 size={18} /> Attendance by Batch (average)</h3>
        {chartGroups.length === 0 ? (
          <p className="muted small">Add students to batches to see this chart.</p>
        ) : (
          <BatchChart groups={chartGroups.map(g => ({
            name: g.name,
            value: g.percentages.length ? Math.round(g.percentages.reduce((a, b) => a + b, 0) / g.percentages.length) : 0,
            count: g.students.length
          }))} />
        )}
      </div>

      <div className="summary-grid">
        <div>
          <div className="search-bar">
            <Search size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students" />
          </div>
          <div className="list">
            {filtered.map(s => {
              const sm = allSummaries[s._id];
              return (
                <button key={s._id} className={'list-item' + (selected?._id === s._id ? ' active' : '')} onClick={() => loadStudent(s)}>
                  <div>
                    <strong>{s.name}</strong>
                    <p className="muted small">Roll #{s.rollNumber}{sm ? ` · ${sm.percentage}%` : ''}</p>
                  </div>
                  <ChevronRight size={16} />
                </button>
              );
            })}
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
              <div className="row" style={{justifyContent: 'space-between', flexWrap: 'wrap'}}>
                <div>
                  <h2 className="display">{selected.name}</h2>
                  <p className="muted">Roll #{selected.rollNumber}{selected.subjects?.length ? ' · ' + selected.subjects.join(', ') : ''}</p>
                </div>
                {selected.parentPhone && (
                  <button className="btn btn-whatsapp" onClick={shareWithParent}>
                    <Share2 size={14} /> Share with Parent
                  </button>
                )}
              </div>

              {summary && (
                <div className="summary-stats">
                  <div className="stat-big green"><strong>{summary.present}</strong><span>Present</span></div>
                  <div className="stat-big red"><strong>{summary.absent}</strong><span>Absent</span></div>
                  <div className="stat-big blue"><strong>{summary.percentage}%</strong><span>Attendance</span></div>
                </div>
              )}

              <div className="row" style={{justifyContent: 'space-between'}}>
                <h3>Attendance History</h3>
                {monthOptions.length > 0 && (
                  <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="sort-select">
                    <option value="">All months</option>
                    {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>
              <div className="list">
                {filteredHistory.length === 0 && <p className="muted">No records for this period.</p>}
                {filteredHistory.map(h => (
                  <div key={h._id} className="history-row">
                    <div>
                      <strong>{formatDate(h.date)}</strong>
                      {h.status === 'present' ? (
                        <span className="badge green small">
                          <CheckCircle size={12} /> Present {h.inTime && `· ${h.inTime} - ${h.outTime || '?'}`}
                        </span>
                      ) : (
                        <span className="badge red small"><XCircle size={12} /> Absent {h.reason && `· ${h.reason}`}</span>
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
    </div>
  );
}

// Simple SVG bar chart used by SummaryTab and FeesTab
function BatchChart({ groups }) {
  if (!groups.length) return null;
  const maxV = Math.max(100, ...groups.map(g => g.value));
  const barH = 28;
  const gap = 12;
  const labelW = 140;
  const chartW = 460;
  const h = groups.length * (barH + gap) + gap;
  return (
    <svg viewBox={`0 0 ${labelW + chartW + 60} ${h}`} style={{ width: '100%', maxWidth: 720 }} role="img">
      {groups.map((g, i) => {
        const y = gap + i * (barH + gap);
        const w = (g.value / maxV) * chartW;
        return (
          <g key={i}>
            <text x={0} y={y + barH / 2 + 5} fontSize="13" fill="#444">{g.name}</text>
            <rect x={labelW} y={y} width={chartW} height={barH} fill="#f5f0e9" rx={4} />
            <rect x={labelW} y={y} width={Math.max(2, w)} height={barH} fill="#c2410c" rx={4} />
            <text x={labelW + Math.max(4, w) + 6} y={y + barH / 2 + 5} fontSize="13" fill="#1f1f1f" fontWeight="600">
              {g.value}% {g.count != null ? `(${g.count})` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ============================
// FEES TAB — features #6, #7, #8, #11
// ============================
function FeesTab({ info }) {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [batchFilter, setBatchFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/fees/summary', { params: { month } });
      setData(r.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [month]);

  if (loading) return <p className="muted">Loading fees…</p>;
  if (!data) return <p className="muted">No data.</p>;

  let rows = data.students;
  if (batchFilter) rows = rows.filter(s => s.batchId === batchFilter);
  if (classFilter) rows = rows.filter(s => s.className === classFilter);

  const monthlyTotal = rows.reduce((a, r) => a + (r.fees?.monthlyFee || 0), 0);
  const dailyTotal   = rows.reduce((a, r) => a + (r.fees?.perDay     || 0), 0);

  // Group by class for the chart (cleaner than by batch now that fees attach to class).
  const groups = {};
  rows.forEach(r => {
    const key = r.className || '__none__';
    if (!groups[key]) groups[key] = { name: r.className || 'No class', value: 0, count: 0 };
    groups[key].value += r.fees?.monthlyFee || 0;
    groups[key].count += 1;
  });

  return (
    <div>
      <div className="toolbar">
        <div className="row">
          <label style={{ margin: 0 }}>Month:</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="sort-select" />
        </div>
        {(info.classes?.length || 0) > 0 && (
          <select className="sort-select" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="">All classes</option>
            {info.classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        )}
        {(info.batches?.length || 0) > 0 && (
          <select className="sort-select" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {info.batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="summary-stats">
        <div className="stat-big green"><strong>{formatRupee(monthlyTotal)}</strong><span>Total / month</span></div>
        <div className="stat-big blue"><strong>{formatRupee(Math.round(dailyTotal))}</strong><span>Total / working day</span></div>
        <div className="stat-big"><strong>{rows.length}</strong><span>Students</span></div>
      </div>

      {Object.keys(groups).length > 0 && (
        <div className="chart-card">
          <h3><BarChart3 size={18} /> Monthly fees by class</h3>
          <BatchChart groups={Object.values(groups).map(g => ({ name: g.name, value: Math.round(g.value), count: g.count }))} />
        </div>
      )}

      <h3 style={{ marginTop: 16 }}>Per-student breakdown</h3>
      <div className="list">
        {rows.length === 0 && <p className="muted">No students for this filter.</p>}
        {rows.map(r => {
          const batch = findBatch(info, r.batchId);
          const f = r.fees || {};
          return (
            <div key={r._id} className="fee-row">
              <div className="fee-row-left">
                <div className="fee-row-name">{r.name}</div>
                <div className="fee-row-meta">
                  <span className="fee-pill">Roll #{r.rollNumber}</span>
                  {r.className && <span className="fee-pill fee-pill-class">{r.className}</span>}
                  {batch && <span className="fee-pill">{batch.name}</span>}
                  <span className="fee-pill">{f.workingDays || 0}/{f.totalDays || 0} working days</span>
                </div>
              </div>
              <div className="fee-row-amount">
                <div className="fee-row-month">{formatRupee(f.monthlyFee || 0)}</div>
                <div className="fee-row-day">{formatRupee(Math.round(f.perDay || 0))}/day</div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="small muted" style={{ marginTop: 12 }}>
        <Info size={12} /> Per-day = monthly fee ÷ working days. Working days = total days minus weekly off (Sunday by default). Announced holidays do <strong>not</strong> reduce the working-day count.
      </p>
    </div>
  );
}

// ============================
// ANNOUNCEMENTS TAB — calendar picker + per-batch (feature #3)
// ============================
function AnnouncementsTab({ info }) {
  const [list, setList] = useState([]);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('general');
  const [message, setMessage] = useState('');
  const [datePick, setDatePick] = useState('');
  const [dates, setDates] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await api.get('/announcements');
    setList(r.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addDate = () => {
    if (!datePick) return;
    if (dates.includes(datePick)) return;
    setDates(d => [...d, datePick].sort());
    setDatePick('');
  };

  const removeDate = (d) => setDates(arr => arr.filter(x => x !== d));

  const reset = () => {
    setType('general'); setMessage(''); setDatePick(''); setDates([]); setBatchId('');
  };

  const send = async () => {
    if (!message) return;
    await api.post('/announcements', {
      message, type,
      dates: type === 'off-day' ? dates : [],
      batchId: batchId || ''
    });
    reset();
    setAdding(false);
    load();
  };

  const del = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    await api.delete('/announcements/' + id);
    load();
  };

  const shareViaWhatsApp = (a) => {
    const batch = findBatch(info, a.batchId);
    let text = `📢 *${info.classroomName || 'Coaching Center'}*\n\n`;
    if (a.type === 'off-day') {
      text += `🏖️ *Holiday Notice*${batch ? ` (Batch: ${batch.name})` : ''}\n${a.message}\n\nDates: ${a.dates.join(', ')}\n\n`;
    } else {
      text += `${batch ? `*Batch: ${batch.name}*\n` : ''}${a.message}\n\n`;
    }
    text += `- ${info.teacherName || 'Teacher'}`;
    window.open(whatsappLink(null, text), '_blank');
  };

  if (loading) return <p className="muted">Loading...</p>;

  return (
    <div>
      <div className="toolbar">
        <h2 className="display">Announcements</h2>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> New Announcement</button>
      </div>

      {list.length === 0 && (
        <div className="empty">
          <Megaphone size={48} color="#999" />
          <h3>No announcements yet</h3>
          <p className="muted">Send updates to all your students and parents.</p>
        </div>
      )}

      <div className="list">
        {list.map(a => {
          const batch = findBatch(info, a.batchId);
          return (
            <div key={a._id} className="announcement-card">
              <div style={{flex: 1}}>
                {a.type === 'off-day' ? (
                  <span className="badge red"><CalendarOff size={12} /> Off Day</span>
                ) : (
                  <span className="badge blue"><MessageSquare size={12} /> General</span>
                )}
                {batch && <span className="badge gray small" style={{ marginLeft: 6 }}><Layers size={12} /> {batch.name}</span>}
                {!batch && a.batchId === '' && <span className="badge gray small" style={{ marginLeft: 6 }}>All batches</span>}
                <p>{a.message}</p>
                {a.dates?.length > 0 && <p className="small muted">Dates: {a.dates.map(formatDate).join(', ')}</p>}
                <p className="small muted">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
              <div className="row-buttons">
                <button className="btn btn-whatsapp btn-mini" onClick={() => shareViaWhatsApp(a)} title="Share via WhatsApp">
                  <Share2 size={14} /> Share
                </button>
                <button className="icon-btn icon-btn-danger" onClick={() => del(a._id)}><Trash2 size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <Modal onClose={() => { setAdding(false); reset(); }} title="Send Announcement">
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

          <label>For which batch?</label>
          <select value={batchId} onChange={e => setBatchId(e.target.value)}>
            <option value="">All batches (everyone)</option>
            {(info.batches || []).map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>

          <label>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Your message to students and parents" />

          {type === 'off-day' && (
            <>
              <label><CalendarDays size={14} /> Pick holiday dates</label>
              <div className="row">
                <input type="date" value={datePick} onChange={e => setDatePick(e.target.value)} />
                <button type="button" className="btn btn-outline" onClick={addDate}><Plus size={14} /> Add</button>
              </div>
              {dates.length > 0 ? (
                <div className="chip-group" style={{ marginTop: 8 }}>
                  {dates.map(d => (
                    <span key={d} className="chip">
                      {formatDate(d)} <button onClick={() => removeDate(d)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="small muted">Pick a date above and tap Add. You can add as many as you like.</p>
              )}
              <p className="small muted">When today matches any of these dates, a "Holiday" banner will show for the selected batch.</p>
            </>
          )}

          <div className="modal-buttons">
            <button className="btn btn-outline" onClick={() => { setAdding(false); reset(); }}>Cancel</button>
            <button className="btn btn-primary" onClick={send} disabled={!message || (type === 'off-day' && dates.length === 0)}>
              <Send size={14} /> Save & Send
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================
// SETTINGS TAB — subjects (names only), classes (with fees), batches, teacher password, storage
// ============================
function SettingsTab({ info, refreshInfo }) {
  const [form, setForm] = useState(info);
  const [subjectName, setSubjectName] = useState('');
  const [className, setClassName] = useState('');
  const [classFee, setClassFee] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Normalize anything coming from the server into the shapes the UI expects.
  useEffect(() => {
    setForm({
      ...info,
      subjects: (info.subjects || []).map(s => ({ name: typeof s === 'string' ? s : s.name })),
      classes:  (info.classes  || []).map(c => ({ ...c, monthlyFee: Number(c.monthlyFee) || 0 })),
      batches:  (info.batches  || []).map(b => ({ ...b })),
    });
  }, [info]);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        subjects: (form.subjects || []).map(s => ({ name: (s.name || '').trim() })).filter(s => s.name),
        classes:  (form.classes  || []).map(c => ({
          _id: c._id, name: (c.name || '').trim(), monthlyFee: Number(c.monthlyFee) || 0,
        })).filter(c => c.name),
        batches:  (form.batches  || []).map(b => ({
          _id: b._id, name: (b.name || '').trim(),
          startTime: b.startTime || '09:00', endTime: b.endTime || '11:00',
          weeklyOffDays: (b.weeklyOffDays && b.weeklyOffDays.length) ? b.weeklyOffDays : [0]
        })).filter(b => b.name),
      };
      if (showPwd && newPassword) body.teacherPassword = newPassword;
      await api.put('/config', body);
      if (refreshInfo) await refreshInfo();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setNewPassword('');
      setShowPwd(false);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    } finally { setSaving(false); }
  };

  // -- Subjects (names only, no fees) ----------------------------------------
  const addSubject = () => {
    const name = subjectName.trim();
    if (!name) return;
    setForm(f => {
      if ((f.subjects || []).some(s => s.name.toLowerCase() === name.toLowerCase())) return f;
      return { ...f, subjects: [...(f.subjects || []), { name }] };
    });
    setSubjectName('');
  };
  const removeSubject = (name) => {
    setForm(f => ({ ...f, subjects: (f.subjects || []).filter(s => s.name !== name) }));
  };

  // -- Classes (with monthly fee) --------------------------------------------
  const addClass = () => {
    const name = className.trim();
    if (!name) return;
    const fee = Number(classFee) || 0;
    setForm(f => {
      if ((f.classes || []).some(c => c.name.toLowerCase() === name.toLowerCase())) return f;
      return { ...f, classes: [...(f.classes || []), { name, monthlyFee: fee }] };
    });
    setClassName(''); setClassFee('');
  };
  const updateClassFee = (name, fee) => {
    setForm(f => ({
      ...f,
      classes: (f.classes || []).map(c => c.name === name ? { ...c, monthlyFee: Number(fee) || 0 } : c)
    }));
  };
  const removeClass = (name) => {
    setForm(f => ({ ...f, classes: (f.classes || []).filter(c => c.name !== name) }));
  };

  // -- Batches ---------------------------------------------------------------
  const addBatch = () => {
    setForm(f => ({
      ...f,
      batches: [...(f.batches || []), { name: 'New Batch', startTime: '09:00', endTime: '11:00', weeklyOffDays: [0] }]
    }));
  };
  const updateBatch = (idx, patch) => {
    setForm(f => ({
      ...f,
      batches: (f.batches || []).map((b, i) => i === idx ? { ...b, ...patch } : b)
    }));
  };
  const toggleBatchOffDay = (idx, dow) => {
    setForm(f => ({
      ...f,
      batches: (f.batches || []).map((b, i) => {
        if (i !== idx) return b;
        const cur = b.weeklyOffDays || [0];
        return { ...b, weeklyOffDays: cur.includes(dow) ? cur.filter(d => d !== dow) : [...cur, dow].sort() };
      })
    }));
  };
  const removeBatch = (idx) => {
    if (!confirm('Remove this batch? Students assigned to it will become unassigned.')) return;
    setForm(f => ({ ...f, batches: (f.batches || []).filter((_, i) => i !== idx) }));
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      <label>Default Class Start Time</label>
      <input type="time" value={form.classStart || ''} onChange={e => setForm({...form, classStart: e.target.value})} />
      <label>Default Class End Time</label>
      <input type="time" value={form.classEnd || ''} onChange={e => setForm({...form, classEnd: e.target.value})} />

      <hr />
      <h3><GraduationCap size={16} /> Classes & Monthly Fees</h3>
      <p className="small muted">A student's monthly fee comes from the class they belong to. Per-day fee is auto-calculated from working days.</p>
      <table className="settings-table">
        <thead>
          <tr><th>Class</th><th>Monthly Fee (₹)</th><th></th></tr>
        </thead>
        <tbody>
          {(form.classes || []).length === 0 && (
            <tr><td colSpan={3} className="muted small">No classes yet. Add one below.</td></tr>
          )}
          {(form.classes || []).map(c => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td>
                <input type="number" min="0" value={c.monthlyFee} onChange={e => updateClassFee(c.name, e.target.value)} style={{ maxWidth: 140 }} />
              </td>
              <td className="text-right">
                <button className="icon-btn icon-btn-danger" onClick={() => removeClass(c.name)}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 8 }}>
        <input value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. 8th Standard" />
        <input type="number" min="0" value={classFee} onChange={e => setClassFee(e.target.value)} placeholder="Monthly fee (₹)" style={{ maxWidth: 180 }} />
        <button className="btn btn-outline" onClick={addClass}><Plus size={14} /> Add class</button>
      </div>

      <hr />
      <h3><Layers size={16} /> Batches (each can have its own timing & off-days)</h3>
      <p className="small muted">Default off-day is Sunday only.</p>
      <div className="batch-list">
        {(form.batches || []).map((b, i) => (
          <div key={b._id || i} className="batch-card">
            <div className="row">
              <label style={{ margin: 0, minWidth: 60 }}>Name</label>
              <input value={b.name || ''} onChange={e => updateBatch(i, { name: e.target.value })} placeholder="e.g. Morning 6th Grade" />
            </div>
            <div className="row">
              <label style={{ margin: 0, minWidth: 60 }}>Start</label>
              <input type="time" value={b.startTime || ''} onChange={e => updateBatch(i, { startTime: e.target.value })} />
              <label style={{ margin: 0, minWidth: 40 }}>End</label>
              <input type="time" value={b.endTime || ''} onChange={e => updateBatch(i, { endTime: e.target.value })} />
            </div>
            <div>
              <label style={{ marginTop: 8 }}>Weekly off days</label>
              <div className="chip-group">
                {dayNames.map((d, dow) => (
                  <button
                    key={dow}
                    type="button"
                    className={'chip-toggle' + ((b.weeklyOffDays || []).includes(dow) ? ' on' : '')}
                    onClick={() => toggleBatchOffDay(i, dow)}
                  >{d}</button>
                ))}
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-mini" onClick={() => removeBatch(i)}>
                <Trash2 size={14} /> Remove batch
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-outline" onClick={addBatch}><Plus size={14} /> Add batch</button>

      <hr />
      <h3><BookOpen size={16} /> Subjects</h3>
      <p className="small muted">Just for organization — subjects don't carry fees.</p>
      <div className="chip-group" style={{ marginBottom: 10 }}>
        {(form.subjects || []).map(s => (
          <span key={s.name} className="chip-static">
            {s.name}
            <button className="chip-x" onClick={() => removeSubject(s.name)} aria-label={`Remove ${s.name}`}>×</button>
          </span>
        ))}
        {(form.subjects || []).length === 0 && <span className="small muted">No subjects yet.</span>}
      </div>
      <div className="row">
        <input value={subjectName} onChange={e => setSubjectName(e.target.value)} placeholder="New subject name" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubject(); } }} />
        <button className="btn btn-outline" onClick={addSubject}><Plus size={14} /> Add</button>
      </div>

      <hr />
      <div className="row">
        <h3>Teacher Password</h3>
        <button className="btn-link" onClick={() => setShowPwd(!showPwd)}>{showPwd ? 'Cancel' : 'Change'}</button>
      </div>
      <p className="small muted">Parents log in with their unique 6-character code (from the Students tab). Students mark themselves on your device — no password needed.</p>
      {showPwd && (
        <>
          <label>New Teacher Password</label>
          <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" />
        </>
      )}

      <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>
        <Save size={14} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>

      <hr />
      <StorageCard />
    </div>
  );
}

// ============================
// STORAGE CARD — iOS-style MongoDB Atlas usage bar
// ============================
function StorageCard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/storage').then(r => setData(r.data)).catch(e => setErr(e.response?.data?.error || e.message));
  }, []);

  if (err) return <div className="card small muted">Storage info unavailable: {err}</div>;
  if (!data) return <div className="card small muted">Loading storage…</div>;

  const formatBytes = (b) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const cap = data.cap || (512 * 1024 * 1024);
  const used = data.totalUsed || (data.dataSize + data.indexSize);
  const free = Math.max(0, cap - used);
  const pct = (n) => Math.max(0, Math.min(100, (n / cap) * 100));

  // Colours match the iOS-storage screen vibe.
  const palette = ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff453a', '#5e5ce6', '#64d2ff'];

  // Build segments per collection (data portion), then a single indexes segment.
  const segments = [];
  (data.perCollection || []).forEach((c, i) => {
    if (c.size > 0) segments.push({ label: c.name, size: c.size, color: palette[i % palette.length] });
  });
  if (data.indexSize > 0) segments.push({ label: 'Indexes', size: data.indexSize, color: '#8e8e93' });

  return (
    <div className="storage-card">
      <div className="storage-header">
        <h3 style={{ margin: 0 }}>Database Storage</h3>
        <div className="small muted">{formatBytes(used)} of {formatBytes(cap)} used</div>
      </div>

      <div className="storage-bar" role="img" aria-label={`${formatBytes(used)} of ${formatBytes(cap)} used`}>
        {segments.map((s, i) => (
          <div key={i} className="storage-seg" style={{ width: `${pct(s.size)}%`, background: s.color }} title={`${s.label}: ${formatBytes(s.size)}`} />
        ))}
      </div>

      <div className="storage-legend">
        {segments.map((s, i) => (
          <div key={i} className="storage-legend-row">
            <span className="storage-dot" style={{ background: s.color }} />
            <span className="storage-label">{s.label}</span>
            <span className="storage-size">{formatBytes(s.size)}</span>
          </div>
        ))}
        <div className="storage-legend-row storage-free">
          <span className="storage-dot" style={{ background: '#e5e5ea', border: '1px solid #d1d1d6' }} />
          <span className="storage-label">Free</span>
          <span className="storage-size">{formatBytes(free)}</span>
        </div>
      </div>

      <div className="storage-meta small muted">
        {data.objects.toLocaleString()} documents across {data.collections} collections
      </div>
    </div>
  );
}

// ============================
// STUDENT DASHBOARD — with Undo Check-In (feature #1, #2)
// ============================
function StudentDashboard({ student, info, announcements, onSignOut }) {
  const [tab, setTab] = useState('today');
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);

  const load = async () => {
    if (!student) return;
    try {
      const [hist, summ] = await Promise.all([
        api.get('/attendance/student/' + student._id),
        api.get('/attendance/summary/' + student._id),
      ]);
      setHistory(hist.data);
      setSummary(summ.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { load(); }, [student]);

  const todayAtt = history.find(h => h.date === todayISO());

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

  // Feature #1: undo today's check-in if the student tapped someone else's name by mistake
  const undoToday = async () => {
    if (!confirm("Undo today's check-in? You'll be back to 'not marked'.")) return;
    try {
      await api.post('/attendance/undo-self', { studentId: student._id });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed: ' + err.message);
    }
  };

  // Feature #1 (extra): "This isn't me" - sign out and go back to picker
  const wrongPerson = () => {
    if (!confirm('Sign out and pick the right name?')) return;
    onSignOut();
  };

  const offDay = isOffDayToday(announcements, student?.batchId);

  return (
    <div className="page">
      <header className="dashboard-header">
        <div>
          <h1 className="display">Hi, {student?.name}</h1>
          <p className="muted">Roll #{student?.rollNumber}</p>
        </div>
        <div className="row-buttons">
          <button className="btn btn-outline" onClick={wrongPerson} title="Not you?"><ArrowLeft size={14} /> Not you?</button>
          <button className="btn btn-outline" onClick={onSignOut}><LogOut size={16} /> Sign out</button>
        </div>
      </header>

      <OffDayBanner announcements={announcements} batchId={student?.batchId} />

      <nav className="tabs">
        <button className={tab === 'today' ? 'tab active' : 'tab'} onClick={() => setTab('today')}><Calendar size={16} /> Today</button>
        <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}><BarChart3 size={16} /> My Attendance</button>
        <button className={tab === 'announcements' ? 'tab active' : 'tab'} onClick={() => setTab('announcements')}><Megaphone size={16} /> Updates</button>
        <button className={tab === 'info' ? 'tab active' : 'tab'} onClick={() => setTab('info')}><Info size={16} /> Class Info</button>
      </nav>

      <main className="tab-content">
        {tab === 'today' && (
          <div className="center-content">
            <h2 className="display">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ })}
            </h2>
            {offDay ? (
              <div className="big-card muted-card">
                <CalendarOff size={48} />
                <h3>Today is a holiday</h3>
                <p>{offDay.message}</p>
                <p className="muted small">No check-in needed today</p>
              </div>
            ) : todayAtt ? (
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
                  {todayAtt.markedBy === 'self' && (
                    <button className="btn btn-outline btn-lg" onClick={undoToday}>
                      <RotateCcw size={18} /> Undo (wrong tap?)
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

            {summary && (
              <div className="summary-stats" style={{marginTop: 24}}>
                <div className="stat-big green"><strong>{summary.present}</strong><span>Days Present</span></div>
                <div className="stat-big red"><strong>{summary.absent}</strong><span>Days Absent</span></div>
                <div className="stat-big blue"><strong>{summary.percentage}%</strong><span>Attendance</span></div>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && summary && (
          <div>
            <div className="summary-stats">
              <div className="stat-big green"><strong>{summary.present}</strong><span>Days Present</span></div>
              <div className="stat-big red"><strong>{summary.absent}</strong><span>Days Absent</span></div>
              <div className="stat-big blue"><strong>{summary.percentage}%</strong><span>Attendance</span></div>
            </div>
            <h3>Recent History</h3>
            <div className="list">
              {history.length === 0 && <p className="muted">No records yet.</p>}
              {history.map(h => (
                <div key={h._id} className="history-row">
                  <strong>{formatDate(h.date)}</strong>
                  {h.status === 'present' ? (
                    <span className="badge green small">
                      <CheckCircle size={12} /> Present {h.inTime && `· ${h.inTime} - ${h.outTime || '?'}`}
                    </span>
                  ) : (
                    <span className="badge red small"><XCircle size={12} /> Absent {h.reason && `· ${h.reason}`}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'announcements' && <AnnouncementList announcements={announcements} info={info} />}
        {tab === 'info' && <ClassInfo info={info} student={student} />}
      </main>
    </div>
  );
}

// ============================
// PARENT DASHBOARD — sees only their own child (feature #13), with fees
// ============================
function ParentDashboard({ student, info, announcements, onSignOut }) {
  const [tab, setTab] = useState('summary');
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [monthFilter, setMonthFilter] = useState('');
  const [fees, setFees] = useState(null);
  const [feesMonth, setFeesMonth] = useState(thisMonth());

  const load = async () => {
    if (!student) return;
    try {
      const [hist, summ] = await Promise.all([
        api.get('/attendance/student/' + student._id),
        api.get('/attendance/summary/' + student._id),
      ]);
      setHistory(hist.data);
      setSummary(summ.data);
    } catch (err) { console.error(err); }
  };

  const loadFees = async () => {
    try {
      const r = await api.get('/fees/student/' + student._id, { params: { month: feesMonth } });
      setFees(r.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { load(); }, [student]);
  useEffect(() => { if (tab === 'fees') loadFees(); }, [tab, feesMonth]);

  const today = todayISO();
  const todayAtt = history.find(h => h.date === today);
  const offDay = isOffDayToday(announcements, student?.batchId);

  const filteredHistory = monthFilter ? history.filter(h => h.date.startsWith(monthFilter)) : history;
  const monthOptions = Array.from(new Set(history.map(h => h.date.substring(0, 7)))).sort().reverse();

  return (
    <div className="page">
      <header className="dashboard-header">
        <div>
          <h1 className="display">{student?.name}'s Attendance</h1>
          <p className="muted">Roll #{student?.rollNumber}</p>
        </div>
        <button className="btn btn-outline" onClick={onSignOut}><LogOut size={16} /> Sign out</button>
      </header>

      <OffDayBanner announcements={announcements} batchId={student?.batchId} />

      <nav className="tabs">
        <button className={tab === 'summary' ? 'tab active' : 'tab'} onClick={() => setTab('summary')}><BarChart3 size={16} /> Summary</button>
        <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}><Calendar size={16} /> History</button>
        <button className={tab === 'fees' ? 'tab active' : 'tab'} onClick={() => setTab('fees')}><Wallet size={16} /> Fees</button>
        <button className={tab === 'announcements' ? 'tab active' : 'tab'} onClick={() => setTab('announcements')}><Megaphone size={16} /> Updates</button>
        <button className={tab === 'info' ? 'tab active' : 'tab'} onClick={() => setTab('info')}><Info size={16} /> Class Info</button>
      </nav>

      <main className="tab-content">
        {tab === 'summary' && summary && (
          <div>
            <div className="today-status">
              {offDay ? (
                <div className="big-card muted-card">
                  <CalendarOff size={48} />
                  <h3>Today is a holiday</h3>
                  <p>{offDay.message}</p>
                </div>
              ) : todayAtt ? (
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
              <div className="stat-big green"><strong>{summary.present}</strong><span>Days Present</span></div>
              <div className="stat-big red"><strong>{summary.absent}</strong><span>Days Absent</span></div>
              <div className="stat-big blue"><strong>{summary.percentage}%</strong><span>Attendance</span></div>
            </div>

            {summary.absentDays?.length > 0 && (
              <>
                <h3>Recent Absences</h3>
                <div className="list">
                  {summary.absentDays.slice(0, 5).map((a, i) => (
                    <div key={i} className="history-row">
                      <strong>{formatDate(a.date)}</strong>
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
            <div className="row" style={{justifyContent: 'space-between'}}>
              <h3>Full Attendance Record</h3>
              {monthOptions.length > 0 && (
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="sort-select">
                  <option value="">All months</option>
                  {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>
            <div className="list">
              {filteredHistory.length === 0 && <p className="muted">No records for this period.</p>}
              {filteredHistory.map(h => (
                <div key={h._id} className="history-row">
                  <div>
                    <strong>{formatDate(h.date)}</strong>
                    {h.status === 'present' ? (
                      <span className="badge green small">
                        <CheckCircle size={12} /> Present {h.inTime && `· ${h.inTime} - ${h.outTime || '?'}`}
                      </span>
                    ) : (
                      <span className="badge red small"><XCircle size={12} /> Absent {h.reason && `· ${h.reason}`}</span>
                    )}
                  </div>
                  {h.markedBy === 'teacher' && <span className="small muted">Marked by teacher</span>}
                  {h.markedBy === 'self' && <span className="small muted">Self-marked</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'fees' && (
          <div>
            <div className="row" style={{justifyContent: 'space-between'}}>
              <h3><IndianRupee size={16} /> Fees</h3>
              <input type="month" value={feesMonth} onChange={e => setFeesMonth(e.target.value)} className="sort-select" />
            </div>
            {!fees ? <p className="muted">Loading…</p> : (
              <>
                <div className="summary-stats">
                  <div className="stat-big green"><strong>{formatRupee(fees.fees?.monthlyFee || 0)}</strong><span>This month</span></div>
                  <div className="stat-big blue"><strong>{formatRupee(Math.round(fees.fees?.perDay || 0))}</strong><span>Per working day</span></div>
                  <div className="stat-big"><strong>{fees.fees?.workingDays}/{fees.fees?.totalDays}</strong><span>Working days</span></div>
                </div>
                <div className="fee-row">
                  <div className="fee-row-left">
                    <div className="fee-row-name">{student?.name}</div>
                    <div className="fee-row-meta">
                      {fees.fees?.className && <span className="fee-pill fee-pill-class">{fees.fees.className}</span>}
                      <span className="fee-pill">{fees.fees?.workingDays || 0}/{fees.fees?.totalDays || 0} working days</span>
                    </div>
                  </div>
                  <div className="fee-row-amount">
                    <div className="fee-row-month">{formatRupee(fees.fees?.monthlyFee || 0)}</div>
                    <div className="fee-row-day">{formatRupee(Math.round(fees.fees?.perDay || 0))}/day</div>
                  </div>
                </div>
                <p className="small muted" style={{ marginTop: 12 }}>
                  Per-day fee = monthly fee ÷ working days. Holidays don't reduce the working-day count.
                </p>
              </>
            )}
          </div>
        )}

        {tab === 'announcements' && <AnnouncementList announcements={announcements} info={info} />}
        {tab === 'info' && <ClassInfo info={info} student={student} />}
      </main>
    </div>
  );
}

// ============================
// SHARED: Announcement List (used by student & parent)
// ============================
function AnnouncementList({ announcements, info }) {
  return (
    <div>
      <h2 className="display">Updates from the teacher</h2>
      {announcements.length === 0 && (
        <div className="empty">
          <Megaphone size={48} color="#999" />
          <p className="muted">No announcements yet.</p>
        </div>
      )}
      <div className="list">
        {announcements.map(a => {
          const batch = findBatch(info, a.batchId);
          return (
            <div key={a._id} className="announcement-card">
              <div>
                {a.type === 'off-day' ? (
                  <span className="badge red"><CalendarOff size={12} /> Holiday</span>
                ) : (
                  <span className="badge blue"><MessageSquare size={12} /> Update</span>
                )}
                {batch && <span className="badge gray small" style={{ marginLeft: 6 }}>{batch.name}</span>}
                <p>{a.message}</p>
                {a.dates?.length > 0 && <p className="small muted">Dates: {a.dates.map(formatDate).join(', ')}</p>}
                <p className="small muted">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================
// CLASS INFO
// ============================
function ClassInfo({ info, student }) {
  const batch = student ? findBatch(info, student.batchId) : null;
  return (
    <div className="container-narrow">
      <h2 className="display">{info.classroomName || 'Coaching Center'}</h2>
      <div className="info-grid">
        {info.teacherName && <div className="info-row"><User size={18} /><span>Teacher: {info.teacherName}</span></div>}
        {info.phone && (
          <div className="info-row">
            <Phone size={18} />
            <a href={`tel:${info.phone}`}>{info.phone}</a>
            {' · '}
            <a href={whatsappLink(info.phone, 'Hello, I have a query about the coaching center.')} target="_blank" rel="noreferrer" className="wa-link">
              <MessageCircle size={14} /> WhatsApp
            </a>
          </div>
        )}
        {info.email && <div className="info-row"><Mail size={18} /><a href={`mailto:${info.email}`}>{info.email}</a></div>}
        {info.mapUrl && <div className="info-row"><MapPin size={18} /><a href={info.mapUrl} target="_blank" rel="noreferrer">View Location on Map</a></div>}
        {batch ? (
          <div className="info-row"><Layers size={18} /><span>Your batch: <strong>{batch.name}</strong> ({batch.startTime} - {batch.endTime})</span></div>
        ) : info.classStart && info.classEnd && (
          <div className="info-row"><Clock size={18} /><span>Class: {info.classStart} - {info.classEnd}</span></div>
        )}
        {info.subjects?.length > 0 && <div className="info-row"><BookOpen size={18} /><span>Subjects: {info.subjects.map(getSubjectName).filter(Boolean).join(', ')}</span></div>}
      </div>
    </div>
  );
}

// ============================
// MODAL
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
