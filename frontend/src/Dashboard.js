import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Players from './Players';
import Attendance from './Attendance';
import Fees from './Fees';

function Dashboard({ session }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [stats, setStats] = useState({
    totalPlayers: 0,
    presentToday: 0,
    totalCollected: 0,
    totalPending: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data: players } = await supabase.from('players').select('id');
    const { data: attendance } = await supabase
      .from('attendance')
      .select('id')
      .eq('date', today)
      .eq('status', 'present');
    const { data: paidFees } = await supabase
      .from('fees')
      .select('amount')
      .eq('status', 'paid');
    const { data: unpaidFees } = await supabase
      .from('fees')
      .select('amount')
      .eq('status', 'unpaid');

    const totalCollected = (paidFees || []).reduce((sum, f) => sum + Number(f.amount), 0);
    const totalPending = (unpaidFees || []).reduce((sum, f) => sum + Number(f.amount), 0);

    setStats({
      totalPlayers: players?.length || 0,
      presentToday: attendance?.length || 0,
      totalCollected,
      totalPending,
    });
  };

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
              <div>
                <h1 style={styles.headerTitle}>Welcome back! 👋</h1>
                <p style={styles.headerSub}>Here's what's happening at your academy today.</p>
              </div>
              <span style={styles.userEmail}>{session.user.email}</span>
            </div>

            {/* Stats Grid */}
            <div style={styles.statsGrid}>
              <div style={styles.card}>
                <div style={styles.cardIcon}>👥</div>
                <h3 style={styles.cardNumber}>{stats.totalPlayers}</h3>
                <p style={styles.cardLabel}>Total Players</p>
              </div>
              <div style={styles.card}>
                <div style={styles.cardIcon}>✅</div>
                <h3 style={{ ...styles.cardNumber, color: '#34a853' }}>{stats.presentToday}</h3>
                <p style={styles.cardLabel}>Present Today</p>
              </div>
              <div style={styles.card}>
                <div style={styles.cardIcon}>💰</div>
                <h3 style={{ ...styles.cardNumber, color: '#34a853' }}>₹{stats.totalCollected}</h3>
                <p style={styles.cardLabel}>Fees Collected</p>
              </div>
              <div style={styles.card}>
                <div style={styles.cardIcon}>⏳</div>
                <h3 style={{ ...styles.cardNumber, color: '#e53935' }}>₹{stats.totalPending}</h3>
                <p style={styles.cardLabel}>Fees Pending</p>
              </div>
            </div>

            {/* Quick Actions */}
            <h2 style={styles.sectionTitle}>Quick Actions</h2>
            <div style={styles.quickActions}>
              <div style={styles.actionCard} onClick={() => setActivePage('players')}>
                <span style={styles.actionIcon}>👥</span>
                <p style={styles.actionLabel}>Add Player</p>
              </div>
              <div style={styles.actionCard} onClick={() => setActivePage('attendance')}>
                <span style={styles.actionIcon}>📋</span>
                <p style={styles.actionLabel}>Mark Attendance</p>
              </div>
              <div style={styles.actionCard} onClick={() => setActivePage('fees')}>
                <span style={styles.actionIcon}>💰</span>
                <p style={styles.actionLabel}>Manage Fees</p>
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
  navItem: { padding: '12px 16px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', fontSize: '15px' },
  activeNav: { backgroundColor: 'rgba(255,255,255,0.25)' },
  logoutBtn: { marginTop: 'auto', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', backgroundColor: 'rgba(255,255,255,0.15)' },
  main: { flex: 1, backgroundColor: '#f0f4f8', padding: '32px', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' },
  headerTitle: { fontSize: '28px', color: '#333', margin: '0 0 4px 0' },
  headerSub: { color: '#666', margin: 0, fontSize: '14px' },
  userEmail: { color: '#666', fontSize: '14px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' },
  card: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' },
  cardIcon: { fontSize: '28px', marginBottom: '8px' },
  cardNumber: { fontSize: '36px', color: '#1a73e8', margin: '0 0 8px 0' },
  cardLabel: { color: '#666', margin: 0, fontSize: '14px' },
  sectionTitle: { fontSize: '18px', color: '#333', marginBottom: '16px' },
  quickActions: { display: 'flex', gap: '16px' },
  actionCard: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center', cursor: 'pointer', flex: 1 },
  actionIcon: { fontSize: '32px' },
  actionLabel: { color: '#333', fontWeight: '600', margin: '12px 0 0 0' },
};

export default Dashboard;