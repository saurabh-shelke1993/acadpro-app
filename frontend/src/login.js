import React, { useState } from 'react';
import { supabase } from './supabaseClient';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    setLoading(false);
  };

  return (
    <div style={styles.page}>
      {/* Top Blue Section */}
      <div style={styles.topSection}>
        <div style={styles.logoCircle}>⚽</div>
        <h1 style={styles.brandName}>AcadPro</h1>
        <p style={styles.brandTagline}>The smart way to manage your football academy</p>
      </div>

      {/* Login Card */}
      <div style={styles.loginCard}>
        <h2 style={styles.loginTitle}>Welcome Back</h2>
        <p style={styles.loginSubtitle}>Sign in to your academy dashboard</p>

        <form onSubmit={handleLogin}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              style={styles.input}
              type="email"
              placeholder="admin@youracademy.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {message && <div style={styles.errorBox}>⚠️ {message}</div>}
          <button style={styles.loginBtn} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        <div style={styles.features}>
          {['⚽ Player Management', '📋 Attendance Tracking', '💰 Fee Management', '👨‍👩‍👦 Parent Portal'].map((f, i) => (
            <div key={i} style={styles.featureBadge}>{f}</div>
          ))}
        </div>

        <p style={styles.parentLink}>
          Are you a parent?{' '}
          <a href="/parent" style={styles.link}>View your child's progress →</a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f0f4f8',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  },
  topSection: {
    backgroundColor: '#1a73e8',
    padding: '40px 24px 60px',
    textAlign: 'center',
    color: 'white',
  },
  logoCircle: {
    fontSize: '48px',
    marginBottom: '12px',
    display: 'block',
  },
  brandName: {
    fontSize: '36px',
    fontWeight: '800',
    margin: '0 0 8px 0',
  },
  brandTagline: {
    fontSize: '15px',
    opacity: 0.85,
    margin: 0,
    lineHeight: '1.5',
  },
  loginCard: {
    backgroundColor: 'white',
    borderRadius: '24px 24px 0 0',
    padding: '32px 24px',
    marginTop: '-24px',
    minHeight: '60vh',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
  },
  loginTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a2e',
    margin: '0 0 8px 0',
  },
  loginSubtitle: {
    color: '#666',
    margin: '0 0 28px 0',
    fontSize: '14px',
  },
  inputGroup: { marginBottom: '20px' },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: '#333',
    fontWeight: '600',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '2px solid #e8ecf4',
    fontSize: '15px',
    boxSizing: 'border-box',
    backgroundColor: '#f8faff',
  },
  errorBox: {
    backgroundColor: '#fce8e6',
    color: '#c62828',
    padding: '12px 16px',
    borderRadius: '10px',
    fontSize: '14px',
    marginBottom: '16px',
  },
  loginBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#1a73e8',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
  },
  features: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '24px',
    justifyContent: 'center',
  },
  featureBadge: {
    backgroundColor: '#e8f0fe',
    color: '#1a73e8',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
  },
  parentLink: {
    textAlign: 'center',
    marginTop: '24px',
    color: '#666',
    fontSize: '14px',
  },
  link: {
    color: '#1a73e8',
    textDecoration: 'none',
    fontWeight: '600',
  },
};

export default Login;