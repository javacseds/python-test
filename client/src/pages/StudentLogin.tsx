import React, { useState } from 'react';
import axios from 'axios';
import { User, Hash, Briefcase, Calendar, BookOpen, Mail, RotateCcw, Play } from 'lucide-react';

interface StudentLoginProps {
  onLoginSuccess: (token: string, studentData: any, questions: any[]) => void;
  onNavigateToAdmin: () => void;
}

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
      const response = await axios.post('http://localhost:5000/api/student/register', formData);
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
          <h2 className="fw-bold mb-1" style={{ letterSpacing: '-0.5px' }}>Programming Question Portal</h2>
          <p className="text-muted small">Please enter your registration details to start your assessment session.</p>
        </div>

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
                disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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
                disabled={loading}
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
                disabled={loading}
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
              disabled={loading}
            />
            {errors.email && <div className="invalid-feedback">{errors.email}</div>}
          </div>

          {/* Buttons */}
          <div className="d-flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-portal-secondary w-100 d-flex align-items-center justify-content-center gap-2"
              disabled={loading}
            >
              <RotateCcw size={16} /> Reset
            </button>
            <button
              type="submit"
              className="btn btn-portal-primary w-100 d-flex align-items-center justify-content-center gap-2"
              disabled={loading}
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
