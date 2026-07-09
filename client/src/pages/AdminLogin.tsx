import React, { useState } from 'react';
import axios from 'axios';
import { Lock, Shield, User, ArrowLeft } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (token: string, adminData: any) => void;
  onNavigateToStudent: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onNavigateToStudent }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Both username and password are required.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/admin/login', {
        username,
        password
      });
      const { token, admin } = response.data;
      onLoginSuccess(token, admin);
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Login failed. Please verify credentials or make sure server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex flex-column justify-content-center align-items-center min-vh-100 py-5 bg-gradient-soft">
      <div className="portal-card p-4 p-md-5 animate-fade-in" style={{ maxWidth: '460px', width: '100%' }}>
        <div className="text-center mb-4">
          <div className="d-inline-flex p-3 rounded-circle bg-primary-subtle text-primary mb-3">
            <Shield size={32} />
          </div>
          <h3 className="fw-bold mb-1 font-heading">Admin Portal</h3>
          <p className="text-muted small">Access panel to manage student questions & upload PDF sheets.</p>
        </div>

        {error && (
          <div className="alert alert-danger border-0 rounded-3 shadow-sm py-2.5 px-3 mb-4 text-center">
            <span className="small text-danger fw-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div className="mb-3">
            <label className="label-title"><User size={12} className="me-1" /> Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              className="form-control"
              placeholder="Enter Admin Username"
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="label-title"><Lock size={12} className="me-1" /> Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              className="form-control"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="btn btn-portal-primary w-100 py-2.5 d-flex align-items-center justify-content-center gap-2 mb-3"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              'Access Dashboard'
            )}
          </button>
        </form>

        <button
          onClick={onNavigateToStudent}
          className="btn btn-link text-decoration-none text-muted small w-100 text-center d-flex align-items-center justify-content-center gap-1 mt-2"
        >
          <ArrowLeft size={14} /> Back to Student Login
        </button>
      </div>
    </div>
  );
};
