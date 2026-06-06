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

    if (error) {
      setMessage(error.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.page}>
      {/* Left Panel */}
      <div style={styles.leftPanel}>
        <div style={styles.leftContent}>
          <h1 style={styles.brandName}>AcadPro</h1>
          <p style={styles.brandTagline}>The smart way to manage your football academy</p>
          <div style={styles.featureList}>
            <div style={styles.feature}>⚽ Player Management</div>
            <div style={styles.feature}>📋 Attendance Tracking</div>
            <div style={styles.feature}>💰 Fee Management</div>
            <div style={styles.feature}>👨‍👩‍👦 Parent Portal</div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div style={styles.rightPanel}>
        <div style={styles.loginCard}>
          <div style={styles.logoCircle}>⚽</div>
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
            {message && (
              <div style={styles.errorBox}>
                ⚠️ {message}
              </div>
            )}
            <button style={styles.loginBtn} type="submit" disabled={loading}>
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <span>Sign In →</span>
              )}
            </button>
          </form>

          <p style={styles.parentLink}>
            Are you a parent?{' '}
            <a href="/parent" style={styles.link}>View your child's progress →</a>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex', height: '100vh', fontFamily: "'Segoe UI', Arial, sans-serif"
  },
  leftPanel: {
    flex: 1, backgroundColor: '#1a73e8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '48px',
  },
  leftContent: { color: 'white', maxWidth: '400px' },
  brandName: { fontSize: '48px', fontWeight: '800', margin: '0 0 12px 0', letterSpacing: '-1px' },
  brandTagline: { fontSize: '18px', opacity: 0.85, margin: '0 0 48px 0', lineHeight: '1.5' },
  featureList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  feature: {
    backgroundColor: 'rgba(255,255,255,0.15)', padding: '14px 20px',
    borderRadius: '12px', fontSize: '16px', fontWeight: '500'
  },
  rightPanel: {
    width: '480px', backgroundColor: '#f8faff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px'
  },
  loginCard: { width: '100%', maxWidth: '380px' },
  logoCircle: {
    width: '64px', height: '64px', backgroundColor: '#1a73e8',
    borderRadius: '16px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '32px', marginBottom: '24px'
  },
  loginTitle: { fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 8px 0' },
  loginSubtitle: { color: '#666', margin: '0 0 32px 0', fontSize: '15px' },
  inputGroup: { marginBottom: '20px' },
  label: { display: 'block', marginBottom: '8px', color: '#333', fontWeight: '600', fontSize: '14px' },
  input: {
    width: '100%', padding: '14px 16px', borderRadius: '10px',
    border: '2px solid #e8ecf4', fontSize: '15px', boxSizing: 'border-box',
    outline: 'none', transition: 'border-color 0.2s',
    backgroundColor: 'white'
  },
  errorBox: {
    backgroundColor: '#fce8e6', color: '#c62828', padding: '12px 16px',
    borderRadius: '10px', fontSize: '14px', marginBottom: '16px'
  },
  loginBtn: {
    width: '100%', padding: '14px', backgroundColor: '#1a73e8',
    color: 'white', border: 'none', borderRadius: '10px',
    fontSize: '16px', fontWeight: '600', cursor: 'pointer',
    marginTop: '8px', letterSpacing: '0.3px'
  },
  parentLink: { textAlign: 'center', marginTop: '24px', color: '#666', fontSize: '14px' },
  link: { color: '#1a73e8', textDecoration: 'none', fontWeight: '600' },
};

export default Login;