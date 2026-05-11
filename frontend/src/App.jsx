import React, { useState, useEffect } from 'react';
import {
  GraduationCap, LogOut, Bell, Plus, Edit2, Trash2,
  Check, Calendar, Clock, Users, Settings, Eye, EyeOff,
  BarChart3, Phone, Mail, MapPin, ArrowLeft, LogIn, AlertTriangle,
  CheckCircle, XCircle, ChevronRight, Save, MessageSquare, CalendarOff,
Send } from 'lucide-react';
import axios from 'axios';
import './index.css';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// =====================================================================
// MAIN APP
// =====================================================================
export default function App() {
  const [view, setView] = useState('landing');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [role, setRole] = useState(() => localStorage.getItem('role'));
  const [selectedStudent, setSelectedStudent] = useState(() => localStorage.getItem('selectedStudent'));
  const [config, setConfig] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || '/api'}/auth/check-setup`);
      setConfig(res.data.config);

      if (res.data.setupDone && !token) {
        setView('landing');
      } else if (token && role) {
        if (role === 'teacher') {
          setView('teacher-dashboard');
        } else if (selectedStudent) {
          setView(role === 'student' ? 'student-dashboard' : 'parent-dashboard');
        } else {
          setView('pick-student');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('selectedStudent');
    setToken(null);
    setRole(null);
    setSelectedStudent(null);
    setView('landing');
    showToast('Logged out');
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  };

  // Views
  if (view === 'teacher-setup') {
    return <TeacherSetup onComplete={() => checkSetup()} showToast={showToast} />;
  }

  if (view === 'landing') {
    return <LandingPage config={config} onLogin={() => setView('login')} />;
  }

  if (view === 'login') {
    return (
      <LoginPage
        onBack={() => setView('landing')}
        onSuccess={(t, r, students) => {
          localStorage.setItem('token', t);
          localStorage.setItem('role', r);
          setToken(t);
          setRole(r);

          if (r === 'teacher') {
            setView('teacher-dashboard');
            showToast('Welcome, Teacher! 👨‍🏫');
          } else {
            setView('pick-student');
            showToast(`${r === 'student' ? 'Student' : 'Parent'} login successful`);
          }
        }}
        showToast={showToast}
        config={config}
      />
    );
  }

  if (view === 'pick-student' && token && role !== 'teacher') {
    return (
      <PickStudentPage
        role={role}
        onSelectStudent={(sid, sname) => {
          localStorage.setItem('selectedStudent', JSON.stringify({ id: sid, name: sname }));
          setSelectedStudent(JSON.stringify({ id: sid, name: sname }));
          setView(role === 'student' ? 'student-dashboard' : 'parent-dashboard');
        }}
        onLogout={logout}
        showToast={showToast}
      />
    );
  }

  if (view === 'teacher-dashboard' && token) {
    return <TeacherDashboard config={config} onLogout={logout} showToast={showToast} />;
  }

  if (view === 'student-dashboard' && token && selectedStudent) {
    const student = JSON.parse(selectedStudent);
    return <StudentDashboard studentId={student.id} studentName={student.name} onLogout={logout} showToast={showToast} />;
  }

  if (view === 'parent-dashboard' && token && selectedStudent) {
    const student = JSON.parse(selectedStudent);
    return <ParentDashboard studentId={student.id} studentName={student.name} onLogout={logout} showToast={showToast} />;
  }

  return <div className="container mt-4">Loading...</div>;
}

// =====================================================================
// LANDING PAGE (Advertisement)
// =====================================================================
function LandingPage({ config, onLogin }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header with Login */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--accent)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
            }}>
              <GraduationCap size={24} />
            </div>
            <div>
              <div className="display" style={{ fontSize: '18px' }}>
                {config?.classroomName || 'Coaching Center'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '2px' }}>Attendance Tracking</div>
            </div>
          </div>
          <button onClick={onLogin} className="btn btn-primary btn-sm">
            <LogIn size={14} /> Sign In
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--bg) 100%)',
        padding: 'clamp(40px, 10vw, 80px) 20px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h1 className="display" style={{
            fontSize: 'clamp(32px, 8vw, 64px)',
            lineHeight: '1.1',
            marginBottom: '20px',
            color: 'var(--ink)',
          }}>
            Smart Attendance Tracking for Your Coaching Center
          </h1>
          <p style={{
            fontSize: 'clamp(16px, 4vw, 20px)',
            color: 'var(--ink-soft)',
            marginBottom: '32px',
            lineHeight: '1.6',
            maxWidth: '700px',
            margin: '0 auto 32px',
          }}>
            Students check in with one tap. Parents monitor progress in real-time. Teachers manage everything from one dashboard.
          </p>
          <button onClick={onLogin} className="btn btn-primary" style={{ padding: '14px 32px', fontSize: '16px' }}>
            Get Started Now
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '60px 20px', background: 'var(--surface)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 className="display" style={{
            fontSize: '32px',
            textAlign: 'center',
            marginBottom: '48px',
          }}>
            How It Works
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}>
            <FeatureCard
              icon={<Check size={32} style={{ color: 'var(--success)' }} />}
              title="Students Check In"
              desc="One tap to mark arrival. Times are recorded automatically. No confusion, no paperwork."
            />
            <FeatureCard
              icon={<BarChart3 size={32} style={{ color: 'var(--accent)' }} />}
              title="Parents Track Progress"
              desc="See attendance history, percentage, and updates. Stay connected with your child's learning."
            />
            <FeatureCard
              icon={<Settings size={32} style={{ color: 'var(--warn)' }} />}
              title="Teachers Control Everything"
              desc="Manage students, view analytics, send announcements, all from one place."
            />
          </div>
        </div>
      </section>

      {/* Coaching Info Section */}
      {config && (
        <section style={{ padding: '60px 20px', background: 'var(--bg)' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 className="display" style={{
              fontSize: '32px',
              textAlign: 'center',
              marginBottom: '48px',
            }}>
              {config.classroomName}
            </h2>

            <div className="card" style={{ padding: '40px', marginBottom: '40px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '32px',
              }}>
                <InfoBlock icon={<Users size={20} />} label="Teacher" value={config.teacherName} />
                <InfoBlock icon={<Phone size={20} />} label="Phone" value={<a href={`tel:${config.phone}`}>{config.phone}</a>} />
                <InfoBlock icon={<Mail size={20} />} label="Email" value={<a href={`mailto:${config.email}`}>{config.email}</a>} />
                <InfoBlock icon={<Clock size={20} />} label="Class Hours" value={`${config.classStart} – ${config.classEnd}`} />
                <InfoBlock icon={<MapPin size={20} />} label="Location" value={<a href={config.mapUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>View on Maps</a>} />
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button onClick={onLogin} className="btn btn-primary" style={{ padding: '12px 28px' }}>
                Start Tracking Now
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        padding: '20px',
        textAlign: 'center',
        color: 'var(--ink-mute)',
        fontSize: '12px',
        marginTop: 'auto',
      }}>
        © {new Date().getFullYear()} Attendance System. All rights reserved.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <h3 className="display" style={{ fontSize: '18px', marginBottom: '12px' }}>{title}</h3>
      <p style={{ color: 'var(--ink-soft)', fontSize: '14px', lineHeight: '1.6' }}>{desc}</p>
    </div>
  );
}

function InfoBlock({ icon, label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: 'var(--accent)', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: '12px', color: 'var(--ink-soft)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ink)' }}>{value}</div>
    </div>
  );
}

// =====================================================================
// SETUP PAGE
// =====================================================================
function TeacherSetup({ onComplete, showToast }) {
  const [data, setData] = useState({
    teacherPassword: '',
    studentPassword: '',
    parentPassword: '',
    teacherName: 'Gunjan Yadav',
    phone: '9310795698',
    email: 'gunjanyadav1718@gmail.com',
    classroomName: "Gunjan Yadav's Coaching",
    mapUrl: 'https://maps.app.goo.gl/CfQzyXvRqEm1DBrDA',
    classStart: '16:00',
    classEnd: '18:00',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const submit = async () => {
    if (!data.teacherPassword || data.teacherPassword.length < 3) return setErr('Teacher password min 3 chars');
    if (!data.studentPassword || data.studentPassword.length < 3) return setErr('Student password min 3 chars');
    if (!data.parentPassword || data.parentPassword.length < 3) return setErr('Parent password min 3 chars');

    setLoading(true);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || '/api'}/auth/setup`,
        data
      );
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', 'teacher');
      showToast('Setup complete! Welcome! 👨‍🏫');
      setTimeout(onComplete, 1500);
    } catch (err) {
      setErr(err.response?.data?.error || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--bg) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'var(--accent)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <GraduationCap size={28} />
          </div>
          <h1 className="display" style={{ fontSize: '26px', marginBottom: '8px' }}>
            Welcome! 👋
          </h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>
            Let's set up your coaching center
          </p>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          <Field label="Your Name">
            <input className="input" value={data.teacherName} onChange={(e) => setData({ ...data, teacherName: e.target.value })} />
          </Field>

          <Field label="Coaching Center Name">
            <input className="input" value={data.classroomName} onChange={(e) => setData({ ...data, classroomName: e.target.value })} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Phone">
              <input className="input" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="input" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
            </Field>
          </div>

          <Field label="Maps URL">
            <input className="input" value={data.mapUrl} onChange={(e) => setData({ ...data, mapUrl: e.target.value })} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Class Start Time">
              <input type="time" className="input" value={data.classStart} onChange={(e) => setData({ ...data, classStart: e.target.value })} />
            </Field>
            <Field label="Class End Time">
              <input type="time" className="input" value={data.classEnd} onChange={(e) => setData({ ...data, classEnd: e.target.value })} />
            </Field>
          </div>

          <hr style={{ borderColor: 'var(--border)', margin: '16px 0' }} />

          <Field label="🔐 YOUR Teacher Password">
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPasswords ? 'text' : 'password'}
                value={data.teacherPassword}
                onChange={(e) => setData({ ...data, teacherPassword: e.target.value })}
                placeholder="You use this to log in"
              />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
              You'll use this password to access the teacher dashboard.
            </div>
          </Field>

          <Field label="📚 Student Password (Give to all students)">
            <input
              className="input"
              type={showPasswords ? 'text' : 'password'}
              value={data.studentPassword}
              onChange={(e) => setData({ ...data, studentPassword: e.target.value })}
              placeholder="Students use this to check in"
            />
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
              Share this password with all your students. They use only this to log in.
            </div>
          </Field>

          <Field label="👨‍👩‍👧 Parent Password (Give to all parents)">
            <input
              className="input"
              type={showPasswords ? 'text' : 'password'}
              value={data.parentPassword}
              onChange={(e) => setData({ ...data, parentPassword: e.target.value })}
              placeholder="Parents use this to view reports"
            />
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
              Share this password with parents. They use it to view their child's attendance.
            </div>
          </Field>

          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            {showPasswords ? '👁️ Hide passwords' : '👁️ Show passwords'}
          </button>

          {err && <div className="tag tag-error" style={{ padding: '10px', width: '100%' }}>{err}</div>}

          <button
            onClick={submit}
            disabled={loading}
            className="btn btn-primary btn-block"
            style={{ marginTop: '16px', padding: '14px' }}
          >
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// LOGIN PAGE (Password Only)
// =====================================================================
function LoginPage({ onBack, onSuccess, showToast, config }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const login = async (e) => {
    e.preventDefault();
    if (!password) return setErr('Enter password');

    setLoading(true);
    setErr('');
    try {
      const res = await API.post('/auth/login', { password });
      onSuccess(res.data.token, res.data.role, res.data.students);
    } catch (error) {
      setErr(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '32px',
        maxWidth: '900px',
        width: '100%',
        alignItems: 'start',
      }}>
        {/* Left: Info */}
        <div>
          <button onClick={onBack} className="btn btn-ghost btn-sm mb-4" style={{ color: 'var(--ink-soft)' }}>
            ← Back
          </button>
          <h1 className="display" style={{ fontSize: '32px', lineHeight: '1.2', marginBottom: '16px' }}>
            {config?.classroomName || 'Coaching Center'}
          </h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: '16px', lineHeight: '1.6', marginBottom: '24px' }}>
            One password. Three roles.
          </p>

          <div className="card" style={{ padding: '20px', marginBottom: '20px', background: 'var(--accent-soft)', border: 'none' }}>
            <div style={{ fontWeight: '700', color: 'var(--accent-deep)', marginBottom: '8px' }}>👨‍🏫 Teacher?</div>
            <div style={{ fontSize: '13px', color: 'var(--accent-deep)' }}>Use your teacher password to manage everything.</div>
          </div>

          <div className="card" style={{ padding: '20px', marginBottom: '20px', background: 'var(--success-soft)', border: 'none' }}>
            <div style={{ fontWeight: '700', color: 'var(--success)', marginBottom: '8px' }}>📚 Student?</div>
            <div style={{ fontSize: '13px', color: 'var(--success)' }}>Use the student password your teacher gave you.</div>
          </div>

          <div className="card" style={{ padding: '20px', background: 'var(--warn-soft)', border: 'none' }}>
            <div style={{ fontWeight: '700', color: 'var(--warn)', marginBottom: '8px' }}>👨‍👩‍👧 Parent?</div>
            <div style={{ fontSize: '13px', color: 'var(--warn)' }}>Use the parent password to see your child's attendance.</div>
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="card" style={{ padding: '32px' }}>
          <h2 className="display" style={{ fontSize: '22px', marginBottom: '8px' }}>Sign In</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: '14px', marginBottom: '24px' }}>Enter your password below</p>

          <form onSubmit={login}>
            <Field label="Password">
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--ink-mute)',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            {err && <div className="tag tag-error" style={{ padding: '10px', marginBottom: '16px', width: '100%' }}>{err}</div>}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-block"
              style={{ padding: '14px', marginBottom: '16px' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <hr style={{ borderColor: 'var(--border)', margin: '20px 0' }} />

          <div style={{
            fontSize: '12px',
            color: 'var(--ink-soft)',
            textAlign: 'center',
            lineHeight: '1.6',
          }}>
            <strong>No password yet?</strong><br />
            Ask your teacher for the password.
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// PICK STUDENT PAGE
// =====================================================================
function PickStudentPage({ role, onSelectStudent, onLogout, showToast }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await API.get('/students');
      setStudents(res.data);
    } catch (err) {
      showToast('Failed to load students', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px',
      }}>
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h1 className="display" style={{ fontSize: '18px' }}>
              Select Your {role === 'student' ? 'Name' : 'Child'}
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '2px' }}>
              {role === 'student' ? 'Choose your student record' : 'Select your child to view their attendance'}
            </p>
          </div>
          <button onClick={onLogout} className="btn btn-ghost btn-sm">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '24px 20px',
      }}>
        {loading ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loading" style={{ margin: '0 auto' }} />
            <p style={{ color: 'var(--ink-soft)', marginTop: '12px' }}>Loading students...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <Users size={32} style={{ color: 'var(--ink-mute)', margin: '0 auto' }} />
            <p style={{ color: 'var(--ink-soft)', marginTop: '12px' }}>No students yet</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {students.map((s) => (
              <button
                key={s._id}
                onClick={() => onSelectStudent(s._id, s.name)}
                className="card"
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 0 rgba(0,0,0,0.02)'}
              >
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-deep)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '20px',
                  margin: '0 auto 16px',
                }}>
                  {s.name.split(' ').map(p => p[0]).join('')}
                </div>
                <div className="display" style={{ fontSize: '18px', marginBottom: '4px' }}>
                  {s.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                  {s.rollNumber} • {(s.subjects || []).join(', ')}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// =====================================================================
// TEACHER DASHBOARD
// =====================================================================
function TeacherDashboard({ config, onLogout, showToast }) {
  const [tab, setTab] = useState('today');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await API.get('/students');
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h1 className="display" style={{ fontSize: '18px' }}>Teacher Dashboard</h1>
            <p style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '2px' }}>Welcome back, {config?.teacherName}</p>
          </div>
          <button onClick={onLogout} className="btn btn-ghost btn-sm">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', paddingTop: '12px', paddingBottom: '0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '8px', padding: '0 20px 12px' }}>
          <TabButton active={tab === 'today'} onClick={() => setTab('today')}>
            <Calendar size={14} /> Today
          </TabButton>
          <TabButton active={tab === 'students'} onClick={() => setTab('students')}>
            <Users size={14} /> Students ({students.length})
          </TabButton>
          <TabButton active={tab === 'announcements'} onClick={() => setTab('announcements')}>
            <Bell size={14} /> Announcements
          </TabButton>
        </div>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
        {loading && <p style={{ color: 'var(--ink-soft)' }}>Loading...</p>}
        {!loading && tab === 'today' && <TeacherTodayView students={students} config={config} />}
        {!loading && tab === 'students' && (
          <TeacherStudentsView
            students={students}
            showAddStudent={showAddStudent}
            setShowAddStudent={setShowAddStudent}
            onAddSuccess={() => { fetchStudents(); setShowAddStudent(false); }}
            onDelete={() => fetchStudents()}
            showToast={showToast}
          />
        )}
        {!loading && tab === 'announcements' && <AnnouncementsView showToast={showToast} />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 14px',
        border: 'none',
        background: active ? 'var(--ink)' : 'transparent',
        color: active ? 'white' : 'var(--ink-soft)',
        cursor: 'pointer',
        borderRadius: '10px 10px 0 0',
        fontSize: '13px',
        fontWeight: '600',
      }}
    >
      {children}
    </button>
  );
}

function TeacherTodayView({ students, config }) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <h2 className="display" style={{ fontSize: '22px', marginBottom: '20px' }}>Today's Attendance - {new Date().toLocaleDateString()}</h2>
      {students.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px' }}>
          <Users size={32} style={{ color: 'var(--ink-mute)', margin: '0 auto' }} />
          <p style={{ color: 'var(--ink-soft)', marginTop: '12px' }}>No students yet. Add one to get started.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
        }}>
          {students.map((s) => (
            <StudentAttendanceCard key={s._id} student={s} date={today} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentAttendanceCard({ student, date }) {
  const [att, setAtt] = useState(null);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const res = await API.get(`/attendance/${student._id}`);
      const rec = res.data.find(a => a.date === date);
      setAtt(rec || null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ fontWeight: '600', marginBottom: '8px' }}>{student.name}</div>
      <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '12px' }}>
        {student.rollNumber} • {student.phone}
      </div>
      {att && att.status === 'present' ? (
        <div style={{
          background: 'var(--success-soft)',
          color: 'var(--success)',
          padding: '8px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '600',
        }}>
          ✓ Present ({att.inTime} – {att.outTime || 'pending'})
        </div>
      ) : (
        <div style={{
          background: 'var(--error-soft)',
          color: 'var(--error)',
          padding: '8px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '600',
        }}>
          ✗ Absent
        </div>
      )}
    </div>
  );
}

function TeacherStudentsView({ students, showAddStudent, setShowAddStudent, onAddSuccess, onDelete, showToast }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="display" style={{ fontSize: '22px' }}>All Students</h2>
        <button onClick={() => setShowAddStudent(!showAddStudent)} className="btn btn-primary btn-sm">
          <Plus size={14} /> Add Student
        </button>
      </div>

      {showAddStudent && <AddStudentForm onSuccess={onAddSuccess} showToast={showToast} />}

      <div style={{ display: 'grid', gap: '12px' }}>
        {students.map((s) => (
          <StudentRow key={s._id} student={s} onDelete={onDelete} showToast={showToast} />
        ))}
      </div>
    </div>
  );
}

function StudentRow({ student, onDelete, showToast }) {
  const deleteStudent = async () => {
    if (!confirm(`Delete ${student.name} and all their records?`)) return;
    try {
      await API.delete(`/students/${student._id}`);
      onDelete();
      showToast(`${student.name} deleted`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Delete failed', 'error');
    }
  };

  return (
    <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '600', fontSize: '16px' }}>{student.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
          {student.rollNumber} • {student.phone} • {(student.subjects || []).join(', ')}
        </div>
      </div>
      <button onClick={deleteStudent} className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function AddStudentForm({ onSuccess, showToast }) {
  const [data, setData] = useState({ name: '', rollNumber: '', phone: '', parentPhone: '', aadhar: '', subjects: [] });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!data.name || !data.rollNumber || !data.phone) return showToast('Fill required fields', 'error');

    setLoading(true);
    try {
      await API.post('/students', data);
      onSuccess();
      showToast(`${data.name} added successfully`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add student', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
      <h3 className="display" style={{ fontSize: '16px', marginBottom: '16px' }}>Add New Student</h3>
      <form onSubmit={submit} style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Name">
            <input className="input" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} required />
          </Field>
          <Field label="Roll Number">
            <input className="input" value={data.rollNumber} onChange={(e) => setData({ ...data, rollNumber: e.target.value })} required />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Phone">
            <input className="input" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} required />
          </Field>
          <Field label="Parent Phone">
            <input className="input" value={data.parentPhone} onChange={(e) => setData({ ...data, parentPhone: e.target.value })} />
          </Field>
        </div>
        <Field label="Subjects (comma separated)">
          <input className="input" value={data.subjects.join(', ')} onChange={(e) => setData({ ...data, subjects: e.target.value.split(',').map(s => s.trim()) })} />
        </Field>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Adding...' : 'Add Student'}
        </button>
      </form>
    </div>
  );
}

function AnnouncementsView({ showToast }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('general');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await API.get('/announcements');
      setAnnouncements(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!message.trim()) return showToast('Enter a message', 'error');

    try {
      await API.post('/announcements', { message, type, dates: [] });
      setMessage('');
      fetchAnnouncements();
      showToast('Announcement sent!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  return (
    <div>
      <h2 className="display" style={{ fontSize: '22px', marginBottom: '20px' }}>Announcements</h2>

      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 className="display" style={{ fontSize: '16px', marginBottom: '16px' }}>Send Announcement</h3>
        <form onSubmit={send}>
          <Field label="Message">
            <textarea
              className="textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., Test on Monday or Holiday tomorrow"
              rows={3}
            />
          </Field>
          <button type="submit" className="btn btn-primary">
            <Send size={14} /> Send to All
          </button>
        </form>
      </div>

      <div>
        <h3 className="display" style={{ fontSize: '16px', marginBottom: '12px' }}>Sent ({announcements.length})</h3>
        <div style={{ display: 'grid', gap: '12px' }}>
          {announcements.map((a) => (
            <div key={a._id} className="card" style={{ padding: '16px' }}>
              <p style={{ marginBottom: '8px' }}>{a.message}</p>
              <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>
                {new Date(a.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// STUDENT DASHBOARD
// =====================================================================
function StudentDashboard({ studentId, studentName, onLogout, showToast }) {
  const [today, setToday] = useState(null);
  const [allAtt, setAllAtt] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [attRes, annRes] = await Promise.all([
        API.get(`/attendance/${studentId}`),
        API.get('/announcements'),
      ]);
      setAllAtt(attRes.data);
      setAnnouncements(annRes.data);
      const t = new Date().toISOString().split('T')[0];
      setToday(attRes.data.find(a => a.date === t) || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkIn = async () => {
    try {
      const t = new Date().toISOString().split('T')[0];
      await API.post('/attendance', { studentId, date: t, action: 'in' });
      fetchData();
      showToast('Checked in ✓');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const checkOut = async () => {
    try {
      const t = new Date().toISOString().split('T')[0];
      await API.post('/attendance', { studentId, date: t, action: 'out' });
      fetchData();
      showToast('Checked out ✓');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  if (loading) {
    return <div className="container mt-4" style={{ color: 'var(--ink-soft)' }}>Loading...</div>;
  }

  const presentDays = allAtt.filter(a => a.status === 'present').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="display" style={{ fontSize: '18px' }}>Hi, {studentName.split(' ')[0]} 👋</h1>
            <p style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '2px' }}>Student Dashboard</p>
          </div>
          <button onClick={onLogout} className="btn btn-ghost btn-sm">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Check In/Out Card */}
        <div className="card" style={{ padding: '32px', marginBottom: '24px', textAlign: 'center' }}>
          <h2 className="display" style={{ fontSize: '20px', marginBottom: '8px' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
          </h2>

          {!today ? (
            <button onClick={checkIn} className="btn btn-primary" style={{ padding: '16px 32px', fontSize: '16px', marginTop: '20px' }}>
              <Check size={18} /> Tap to Check In
            </button>
          ) : !today.outTime ? (
            <div style={{ marginTop: '20px' }}>
              <div style={{
                background: 'var(--success-soft)',
                color: 'var(--success)',
                padding: '12px',
                borderRadius: '10px',
                marginBottom: '12px',
                fontWeight: '600',
              }}>
                ✓ You checked in at {today.inTime}
              </div>
              <button onClick={checkOut} className="btn btn-primary w-full">
                <Clock size={16} /> Tap to Check Out
              </button>
            </div>
          ) : (
            <div style={{
              background: 'var(--success-soft)',
              color: 'var(--success)',
              padding: '12px',
              borderRadius: '10px',
              marginTop: '20px',
              fontWeight: '600',
            }}>
              ✓ All done for today! ({today.inTime} – {today.outTime})
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="card" style={{ padding: '24px', marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', fontWeight: '700', color: 'var(--accent)' }}>{presentDays}</div>
          <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginTop: '8px' }}>Days Present</div>
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 className="display" style={{ fontSize: '16px', marginBottom: '12px' }}>📢 Announcements</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {announcements.slice(0, 3).map((a) => (
                <div key={a._id} className="card" style={{ padding: '12px' }}>
                  <p style={{ marginBottom: '4px', fontWeight: '600' }}>{a.message}</p>
                  <div style={{ fontSize: '10px', color: 'var(--ink-soft)' }}>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attendance History */}
        <div>
          <h3 className="display" style={{ fontSize: '16px', marginBottom: '12px' }}>📊 Recent Attendance</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {allAtt.slice(0, 10).map((a) => (
              <div key={a._id} className="card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: a.status === 'present' ? 'var(--success)' : 'var(--error)',
                }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '13px' }}>
                    {new Date(a.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>
                    {a.status === 'present' ? `${a.inTime} – ${a.outTime || 'pending'}` : 'Absent'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// =====================================================================
// PARENT DASHBOARD
// =====================================================================
function ParentDashboard({ studentId, studentName, onLogout, showToast }) {
  const [allAtt, setAllAtt] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [attRes, annRes, configRes] = await Promise.all([
        API.get(`/attendance/${studentId}`),
        API.get('/announcements'),
        API.get('/config'),
      ]);
      setAllAtt(attRes.data);
      setAnnouncements(annRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container mt-4" style={{ color: 'var(--ink-soft)' }}>Loading...</div>;
  }

  const presentDays = allAtt.filter(a => a.status === 'present').length;
  const totalDays = allAtt.length;
  const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="display" style={{ fontSize: '18px' }}>👨‍👩‍👧 {studentName}</h1>
            <p style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '2px' }}>Parent View</p>
          </div>
          <button onClick={onLogout} className="btn btn-ghost btn-sm">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--accent)' }}>{presentDays}</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>Days Present</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--success)' }}>{percentage}%</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>Attendance %</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--ink)' }}>{totalDays}</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>Total Days</div>
          </div>
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 className="display" style={{ fontSize: '16px', marginBottom: '12px' }}>📢 Important Notices</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {announcements.map((a) => (
                <div key={a._id} className="card" style={{ padding: '14px', background: 'var(--accent-soft)', border: 'none' }}>
                  <p style={{ marginBottom: '4px', fontWeight: '600', color: 'var(--accent-deep)' }}>{a.message}</p>
                  <div style={{ fontSize: '10px', color: 'var(--accent-deep)', opacity: 0.7 }}>
                    {new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attendance Table */}
        <div>
          <h3 className="display" style={{ fontSize: '16px', marginBottom: '12px' }}>📊 Full Attendance Record</h3>
          {allAtt.length === 0 ? (
            <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-soft)' }}>
              No attendance records yet
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {allAtt.map((a) => (
                <div key={a._id} className="card" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: a.status === 'present' ? 'var(--success)' : 'var(--error)',
                    }}/>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>
                        {new Date(a.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>
                        {a.status === 'present' ? `${a.inTime} – ${a.outTime || 'pending'}` : a.reason || 'Absent'}
                      </div>
                    </div>
                  </div>
                  <span className="tag" style={{
                    background: a.status === 'present' ? 'var(--success-soft)' : 'var(--error-soft)',
                    color: a.status === 'present' ? 'var(--success)' : 'var(--error)',
                    padding: '4px 8px',
                    fontSize: '11px',
                  }}>
                    {a.status === 'present' ? '✓' : '✗'} {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// =====================================================================
// FIELD COMPONENT
// =====================================================================
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}
