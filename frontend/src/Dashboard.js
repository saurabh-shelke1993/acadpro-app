import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Players from './Players';
import Attendance from './Attendance';
import Fees from './Fees';

function Dashboard({ session }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
      .from('attendance').select('id')
      .eq('date', today).eq('status', 'present');
    const { data: paidFees } = await supabase
      .from('fees').select('amount').eq('status', 'paid');
    const { data: unpaidFees } = await supabase
      .from('fees').select('amount').eq('status', 'unpaid');

    setStats({
      totalPlayers: players?.length || 0,
      presentToday: attendance?.length || 0,
      totalCollected: (paidFees || []).reduce((sum, f) => sum + Number(f.amount), 0),
      totalPending: (unpaidFees || []).reduce((sum, f) => sum + Number(f.amount), 0),
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navigateTo = (page) => {
    setActivePage(page);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activePage) {
      case 'players': return <Players />;
      case 'attendance': return <Attendance />;
      case 'fees': return <Fees />;
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

            <div className="stats-grid">
              {[
                { icon: '👥', number: stats.totalPlayers, label: 'Total Players', color: '#1a73e8' },
                { icon: '✅', number: stats.presentToday, label: 'Present Today', color: '#34a853' },
                { icon: '💰', number: `₹${stats.totalCollected}`, label: 'Fees Collected', color: '#34a853' },
                { icon: '⏳', number: `₹${stats.totalPending}`, label: 'Fees Pending', color: '#e53935' },
              ].map((stat, i) => (
                <div key={i} style={styles.card}>
                  <div style={styles.cardIcon}>{stat.icon}</div>
                  <h3 style={{ ...styles.cardNumber, color: stat.color }}>{stat.number}</h3>
                  <p style={styles.cardLabel}>{stat.label}</p>
                </div>
              ))}
            </div>

            <h2 style={styles.sectionTitle}>Quick Actions</h2>
            <div className="quick-actions">
              {[
                { icon: '👥', label: 'Add Player', page: 'players' },
                { icon: '📋', label: 'Mark Attendance', page: 'attendance' },
                { icon: '💰', label: 'Manage Fees', page: 'fees' },
              ].map((action, i) => (
                <div key={i} style={styles.actionCard} onClick={() => navigateTo(action.page)}>
                  <span style={styles.actionIcon}>{action.icon}</span>
                  <p style={styles.actionLabel}>{action.label}</p>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-container">
      {/* Hamburger Button */}
      <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99 }} />
      )}

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h2 style={styles.logo}>AcadPro</h2>
        <nav>
          {[
            { icon: '🏠', label: 'Dashboard', page: 'dashboard' },
            { icon: '👥', label: 'Players', page: 'players' },
            { icon: '📋', label: 'Attendance', page: 'attendance' },
            { icon: '💰', label: 'Fees', page: 'fees' },
          ].map((item) => (
            <div key={item.page}
              style={{ ...styles.navItem, ...(activePage === item.page ? styles.activeNav : {}) }}
              onClick={() => navigateTo(item.page)}>
              {item.icon} {item.label}
            </div>
          ))}
        </nav>
        <div style={styles.logoutBtn} onClick={handleLogout}>🚪 Logout</div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {renderContent()}
      </div>
    </div>
  );
}

const styles = {
  logo: { fontSize: '24px', fontWeight: 'bold', marginBottom: '40px', textAlign: 'center' },
  navItem: { padding: '12px 16px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', fontSize: '15px' },
  activeNav: { backgroundColor: 'rgba(255,255,255,0.25)' },
  logoutBtn: { marginTop: 'auto', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', backgroundColor: 'rgba(255,255,255,0.15)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' },
  headerTitle: { fontSize: '28px', color: '#333', margin: '0 0 4px 0' },
  headerSub: { color: '#666', margin: 0, fontSize: '14px' },
  userEmail: { color: '#666', fontSize: '14px' },
  card: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' },
  cardIcon: { fontSize: '28px', marginBottom: '8px' },
  cardNumber: { fontSize: '36px', margin: '0 0 8px 0' },
  cardLabel: { color: '#666', margin: 0, fontSize: '14px' },
  sectionTitle: { fontSize: '18px', color: '#333', marginBottom: '16px', marginTop: '8px' },
  actionCard: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center', cursor: 'pointer', flex: 1 },
  actionIcon: { fontSize: '32px' },
  actionLabel: { color: '#333', fontWeight: '600', margin: '12px 0 0 0' },
};

export default Dashboard;