import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import Players from './Players';
import Attendance from './Attendance';
import Fees from './Fees';

function Dashboard({ session }) {
  const [activePage, setActivePage] = useState('dashboard');

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderContent = () => {
    switch (activePage) {
      case 'players':
        return <Players />;
      case 'attendance':
        return <Attendance />;
      case 'fees':
        return <Fees />;
      default:
        return (
          <div>
            <div style={styles.header}>
              <h1 style={styles.headerTitle}>Dashboard</h1>
              <span style={styles.userEmail}>{session.user.email}</span>
            </div>
            <div style={styles.statsGrid}>
              <div style={styles.card}>
                <h3 style={styles.cardNumber}>0</h3>
                <p style={styles.cardLabel}>Total Players</p>
              </div>
              <div style={styles.card}>
                <h3 style={styles.cardNumber}>0</h3>
                <p style={styles.cardLabel}>Batches</p>
              </div>
              <div style={styles.card}>
                <h3 style={styles.cardNumber}>0</h3>
                <p style={styles.cardLabel}>Present Today</p>
              </div>
              <div style={styles.card}>
                <h3 style={styles.cardNumber}>₹0</h3>
                <p style={styles.cardLabel}>Fees Collected</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <h2 style={styles.logo}>AcadPro</h2>
        <nav>
          <div
            style={{ ...styles.navItem, ...(activePage === 'dashboard' ? styles.activeNav : {}) }}
            onClick={() => setActivePage('dashboard')}>
            🏠 Dashboard
          </div>
          <div
            style={{ ...styles.navItem, ...(activePage === 'players' ? styles.activeNav : {}) }}
            onClick={() => setActivePage('players')}>
            👥 Players
          </div>
          <div
            style={{ ...styles.navItem, ...(activePage === 'attendance' ? styles.activeNav : {}) }}
            onClick={() => setActivePage('attendance')}>
            📋 Attendance
          </div>
          <div
            style={{ ...styles.navItem, ...(activePage === 'fees' ? styles.activeNav : {}) }}
            onClick={() => setActivePage('fees')}>
            💰 Fees
          </div>
        </nav>
        <div style={styles.logoutBtn} onClick={handleLogout}>
          🚪 Logout
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        {renderContent()}
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' },
  sidebar: {
    width: '220px', backgroundColor: '#1a73e8', color: 'white',
    padding: '24px 16px', display: 'flex', flexDirection: 'column',
  },
  logo: { fontSize: '24px', fontWeight: 'bold', marginBottom: '40px', textAlign: 'center' },
  navItem: {
    padding: '12px 16px', borderRadius: '8px', marginBottom: '8px',
    cursor: 'pointer', fontSize: '15px',
  },
  activeNav: { backgroundColor: 'rgba(255,255,255,0.25)' },
  logoutBtn: {
    marginTop: 'auto', padding: '12px 16px', borderRadius: '8px',
    cursor: 'pointer', fontSize: '15px', backgroundColor: 'rgba(255,255,255,0.15)'
  },
  main: { flex: 1, backgroundColor: '#f0f4f8', padding: '32px', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  headerTitle: { fontSize: '28px', color: '#333', margin: 0 },
  userEmail: { color: '#666', fontSize: '14px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' },
  card: {
    backgroundColor: 'white', padding: '24px', borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center'
  },
  cardNumber: { fontSize: '36px', color: '#1a73e8', margin: '0 0 8px 0' },
  cardLabel: { color: '#666', margin: 0, fontSize: '14px' },
};

export default Dashboard;