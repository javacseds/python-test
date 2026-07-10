import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../utils/apiHelper';
import axios from 'axios';
import { User, Hash, Briefcase, Calendar, BookOpen, Mail, RotateCcw, Play } from 'lucide-react';

interface StudentLoginProps {
  onLoginSuccess: (token: string, studentData: any, questions: any[]) => void;
  onNavigateToAdmin: () => void;
}

type HealthStatus = 'checking' | 'healthy' | 'offline' | 'db_offline';

export const StudentLogin: React.FC<StudentLoginProps> = ({ onLoginSuccess, onNavigateToAdmin }) => {
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    branch: '',
    year: '',
    semester: '',
    email: ''
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');
  const [healthError, setHealthError] = useState<string>('');

  const checkHealth = async () => {
    setHealthStatus('checking');
    setHealthError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/health`, { timeout: 6000 });
      if (res.data?.database === 'Connected') {
        setHealthStatus('healthy');
      } else {
        setHealthStatus('healthy'); // API responded, DB ok
      }
    } catch (err: any) {
      if (err.response) {
        // Server replied with 5xx — database offline
        const msg = err.response.data?.message || 'Database connection unavailable.';
        setHealthError(`Database connection unavailable. ${msg} Please contact the administrator.`);
        setHealthStatus('db_offline');
      } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        setHealthError('Backend server is offline. Unable to reach the exam API at ' + API_BASE_URL + '. Make sure the server is running.');
        setHealthStatus('offline');
      } else if (err.code === 'ECONNABORTED') {
        setHealthError('Registration service temporarily unavailable. Connection timed out. Please try again in a moment.');
        setHealthStatus('offline');
      } else {
        setHealthError('Unable to reach the API. An unexpected error occurred while connecting to the exam servers.');
        setHealthStatus('offline');
      }
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const branches = ['CSE', 'CSE (AI & ML)', 'ECE', 'EEE'];
  const years = ['I Year', 'II Year', 'III Year', 'IV Year'];
  const semesters = ['I Semester', 'II Semester'];

  const validate = () => {
    const tempErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) tempErrors.name = 'Student Name is required';
    
    if (!formData.rollNumber.trim()) {
      tempErrors.rollNumber = 'Roll Number is required';
    } else if (formData.rollNumber.trim().length < 5) {
      tempErrors.rollNumber = 'Enter a valid Roll Number';
    }
    
    if (!formData.branch) tempErrors.branch = 'Please select a Branch';
    if (!formData.year) tempErrors.year = 'Please select a Year';
    if (!formData.semester) tempErrors.semester = 'Please select a Semester';
    
    if (!formData.email.trim()) {
      tempErrors.email = 'Email ID is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        tempErrors.email = 'Enter a valid Email ID';
      }
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear field-specific error as they type
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      rollNumber: '',
      branch: '',
      year: '',
      semester: '',
      email: ''
    });
    setErrors({});
    setApiError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    setLoading(true);
    try {
      // Connect to server port 5000
      const response = await axios.post(`${API_BASE_URL}/api/student/register`, formData);
      const { token, student, questions } = response.data;
      onLoginSuccess(token, student, questions);
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setApiError(err.response.data.error);
      } else {
        setApiError('Failed to connect to the server. Make sure the backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex flex-column justify-content-center align-items-center min-vh-100 py-5">
      <div className="portal-card p-4 p-md-5 animate-fade-in" style={{ maxWidth: '560px', width: '100%' }}>
        <div className="text-center mb-4">
          <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill mb-2 fw-semibold">Assessment Portal</span>
          <h2 className="fw-bold mb-1" style={{ letterSpacing: '-0.5px' }}>Python Assessment Portal</h2>
          <p className="text-muted small">Please enter your registration details to start your assessment session.</p>
        </div>

        {/* Connection Status Banner */}
        {healthStatus === 'checking' && (
          <div className="alert alert-info border-0 rounded-3 shadow-sm py-2.5 px-3 mb-4 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <span className="spinner-border spinner-border-sm text-info me-2" role="status" aria-hidden="true"></span>
              <span className="small text-info fw-semibold">Connecting to secure exam servers...</span>
            </div>
          </div>
        )}

        {healthStatus === 'healthy' && (
          <div className="alert alert-success border-0 rounded-3 shadow-sm py-2 px-3 mb-4 d-flex align-items-center justify-content-between animate-fade-in" style={{ backgroundColor: '#EAFDF1', borderLeft: '4px solid #22C55E' }}>
            <div className="d-flex align-items-center">
              <span className="badge bg-success rounded-circle p-1 me-2 d-inline-flex align-items-center justify-content-center" style={{ width: '16px', height: '16px', fontSize: '0.6rem' }}>✓</span>
              <span className="small fw-semibold text-success" style={{ fontSize: '0.82rem' }}>Secure Link Established</span>
            </div>
            <span className="badge bg-success-subtle text-success small px-2 py-0.5 rounded fw-bold" style={{ fontSize: '0.65rem' }}>ONLINE</span>
          </div>
        )}

        {(healthStatus === 'offline' || healthStatus === 'db_offline') && (
          <div className="alert alert-danger border-0 rounded-3 shadow-sm p-3 mb-4 animate-fade-in" style={{ backgroundColor: '#FFF5F5', borderLeft: '4px solid #EF4444' }}>
            <div className="d-flex align-items-start gap-2.5">
              <span className="badge bg-danger rounded-circle p-1 mt-0.5 d-inline-flex align-items-center justify-content-center" style={{ width: '18px', height: '18px', fontSize: '0.7rem', fontWeight: 'bold' }}>!</span>
              <div className="flex-grow-1 text-start">
                <h6 className="alert-heading fw-bold mb-1 text-danger font-heading" style={{ fontSize: '0.85rem' }}>
                  {healthStatus === 'db_offline' ? 'Database Connection Error' : 'Server Connection Offline'}
                </h6>
                <p className="text-muted small mb-2" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                  {healthError}
                </p>
                <button
                  type="button"
                  onClick={checkHealth}
                  className="btn btn-sm btn-danger py-1 px-3.5 fw-semibold rounded-2 d-inline-flex align-items-center gap-1 text-white border-0"
                  style={{ fontSize: '0.75rem', backgroundColor: '#EF4444' }}
                >
                  Retry Connection
                </button>
              </div>
            </div>
          </div>
        )}

        {apiError && (
          <div className="alert alert-danger border-0 rounded-3 shadow-sm py-2 px-3 mb-4 d-flex align-items-center" role="alert">
            <span className="small text-danger fw-medium">{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="mb-3">
            <label className="label-title"><User size={12} className="me-1" /> Student Name</label>
            <div className="input-group">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                placeholder="Enter Full Name"
                disabled={loading || healthStatus !== 'healthy'}
              />
              {errors.name && <div className="invalid-feedback">{errors.name}</div>}
            </div>
          </div>

          {/* Roll Number */}
          <div className="mb-3">
            <label className="label-title"><Hash size={12} className="me-1" /> Roll Number</label>
            <input
              type="text"
              name="rollNumber"
              value={formData.rollNumber}
              onChange={handleChange}
              className={`form-control ${errors.rollNumber ? 'is-invalid' : ''}`}
              placeholder="e.g. 21B81A0501"
              disabled={loading || healthStatus !== 'healthy'}
            />
            {errors.rollNumber && <div className="invalid-feedback">{errors.rollNumber}</div>}
          </div>

          {/* Branch */}
          <div className="mb-3">
            <label className="label-title"><Briefcase size={12} className="me-1" /> Branch</label>
            <select
              name="branch"
              value={formData.branch}
              onChange={handleChange}
              className={`form-select ${errors.branch ? 'is-invalid' : ''}`}
              disabled={loading || healthStatus !== 'healthy'}
            >
              <option value="">Select Branch</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {errors.branch && <div className="invalid-feedback">{errors.branch}</div>}
          </div>

          {/* Year & Semester */}
          <div className="row mb-3">
            <div className="col-md-6 mb-3 mb-md-0">
              <label className="label-title"><Calendar size={12} className="me-1" /> Academic Year</label>
              <select
                name="year"
                value={formData.year}
                onChange={handleChange}
                className={`form-select ${errors.year ? 'is-invalid' : ''}`}
                disabled={loading || healthStatus !== 'healthy'}
              >
                <option value="">Select Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {errors.year && <div className="invalid-feedback">{errors.year}</div>}
            </div>
            <div className="col-md-6">
              <label className="label-title"><BookOpen size={12} className="me-1" /> Semester</label>
              <select
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                className={`form-select ${errors.semester ? 'is-invalid' : ''}`}
                disabled={loading || healthStatus !== 'healthy'}
              >
                <option value="">Select Semester</option>
                {semesters.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.semester && <div className="invalid-feedback">{errors.semester}</div>}
            </div>
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="label-title"><Mail size={12} className="me-1" /> Email ID</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`form-control ${errors.email ? 'is-invalid' : ''}`}
              placeholder="student@example.com"
              disabled={loading || healthStatus !== 'healthy'}
            />
            {errors.email && <div className="invalid-feedback">{errors.email}</div>}
          </div>

          {/* Buttons */}
          <div className="d-flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-portal-secondary w-100 d-flex align-items-center justify-content-center gap-2"
              disabled={loading || healthStatus !== 'healthy'}
            >
              <RotateCcw size={16} /> Reset
            </button>
            <button
              type="submit"
              className="btn btn-portal-primary w-100 d-flex align-items-center justify-content-center gap-2"
              disabled={loading || healthStatus !== 'healthy'}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                <>
                  <Play size={16} /> Start Questions
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      
      <div className="mt-4">
        <button 
          onClick={onNavigateToAdmin} 
          className="btn btn-link text-decoration-none text-muted small"
          style={{ fontSize: '0.85rem' }}
        >
          Administrator Log In
        </button>
      </div>
    </div>
  );
};
