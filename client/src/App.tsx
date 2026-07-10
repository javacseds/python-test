import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_BASE_URL } from './utils/apiHelper';
import { StudentLogin } from './pages/StudentLogin';
import { StudentPortal } from './pages/StudentPortal';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

type PageView = 'student-login' | 'student-portal' | 'admin-login' | 'admin-dashboard';

function App() {
  const [view, setView] = useState<PageView>('student-login');
  const [loading, setLoading] = useState(true);
  
  // Student Session State
  const [studentData, setStudentData] = useState<any>(null);
  const [studentQuestions, setStudentQuestions] = useState<any[]>([]);

  // Admin Session State
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Check LocalStorage for active sessions on load
  useEffect(() => {
    const checkSessions = async () => {
      const savedStudentToken = localStorage.getItem('student_token');
      const savedAdminToken = localStorage.getItem('admin_token');

      if (savedStudentToken) {
        try {
          const response = await axios.get(`${API_BASE_URL}/api/student/session/${savedStudentToken}`);
          setStudentData(response.data.student);
          setStudentQuestions(response.data.questions);
          setView('student-portal');
        } catch (error) {
          console.warn('Student session invalid or expired:', error);
          localStorage.removeItem('student_token');
        }
      } else if (savedAdminToken) {
        setAdminToken(savedAdminToken);
        setView('admin-dashboard');
      }
      
      setLoading(false);
    };

    checkSessions();
  }, []);

  // Handlers for Student Session
  const handleStudentLoginSuccess = (token: string, student: any, questions: any[]) => {
    localStorage.setItem('student_token', token);
    setStudentData(student);
    setStudentQuestions(questions);
    setView('student-portal');
  };

  const handleStudentLogout = () => {
    localStorage.removeItem('student_token');
    setStudentData(null);
    setStudentQuestions([]);
    setView('student-login');
  };

  // Handlers for Admin Session
  const handleAdminLoginSuccess = (token: string, admin: any) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_data', JSON.stringify(admin));
    setAdminToken(token);
    setView('admin-dashboard');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_data');
    setAdminToken(null);
    setView('student-login');
  };

  // Student-side WebSocket listener for instant warning/disqualification notifications
  useEffect(() => {
    if (view === 'student-portal' && studentData) {
      const socket = io(API_BASE_URL);
      
      socket.on('student_update', (updatedStudent: any) => {
        if (updatedStudent.id === studentData.id) {
          setStudentData(updatedStudent);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [view, studentData?.id]);

  if (loading) {
    return (
      <div className="min-vh-100 d-flex flex-column justify-content-center align-items-center bg-gradient-soft">
        <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted fw-medium font-heading">Initializing Assessment Portal...</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-soft min-vh-100">
      {view === 'student-login' && (
        <StudentLogin
          onLoginSuccess={handleStudentLoginSuccess}
          onNavigateToAdmin={() => setView('admin-login')}
        />
      )}
      
      {view === 'student-portal' && studentData && (
        <StudentPortal
          student={studentData}
          questions={studentQuestions}
          onLogout={handleStudentLogout}
        />
      )}

      {view === 'admin-login' && (
        <AdminLogin
          onLoginSuccess={handleAdminLoginSuccess}
          onNavigateToStudent={() => setView('student-login')}
        />
      )}

      {view === 'admin-dashboard' && adminToken && (
        <AdminDashboard
          token={adminToken}
          onLogout={handleAdminLogout}
        />
      )}
    </div>
  );
}

export default App;
