import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function ParentPortal() {
  const [phone, setPhone] = useState('');
  const [player, setPlayer] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPlayer(null);

    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('phone', phone)
      .single();

    if (!playerData) {
      setError('No player found with this phone number. Please contact your academy admin.');
      setLoading(false);
      setSearched(true);
      return;
    }

    setPlayer(playerData);

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*')
      .eq('player_id', playerData.id)
      .order('date', { ascending: false })
      .limit(30);

    const { data: feesData } = await supabase
      .from('fees')
      .select('*')
      .eq('player_id', playerData.id)
      .order('created_at', { ascending: false });

    setAttendance(attendanceData || []);
    setFees(feesData || []);
    setLoading(false);
    setSearched(true);
  };

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const attendancePercent = attendance.length > 0
    ? Math.round((presentCount / attendance.length) * 100)
    : 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.logo}>AcadPro</h1>
        <p style={styles.subtitle}>Parent & Player Portal</p>
      </div>

      {/* Search Box */}
      <div style={styles.searchCard}>
        <h2 style={styles.searchTitle}>Find Your Child's Profile</h2>
        <p style={styles.searchDesc}>Enter the phone number registered with the academy</p>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input
            style={styles.searchInput}
            type="tel"
            placeholder="Enter registered phone number"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
          />
          <button style={styles.searchBtn} type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {error && <p style={styles.error}>{error}</p>}
      </div>

      {/* Player Profile */}
      {player && (
        <div style={styles.content}>

          {/* Player Card */}
          <div style={styles.playerCard}>
            <div style={styles.avatar}>{player.name.charAt(0)}</div>
            <div style={styles.playerInfo}>
              <h2 style={styles.playerName}>{player.name}</h2>
              <p style={styles.playerMeta}>⚽ {player.position} &nbsp;•&nbsp; 🎽 {player.batch} &nbsp;•&nbsp; 🎂 Age: {player.age}</p>
            </div>
          </div>

          {/* Stats Row */}
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <h3 style={{ color: '#34a853', margin: 0 }}>{attendancePercent}%</h3>
              <p style={styles.statLabel}>Attendance Rate</p>
            </div>
            <div style={styles.statCard}>
              <h3 style={{ color: '#1a73e8', margin: 0 }}>{presentCount}</h3>
              <p style={styles.statLabel}>Days Present</p>
            </div>
            <div style={styles.statCard}>
              <h3 style={{ color: '#e53935', margin: 0 }}>
                {fees.filter(f => f.status === 'unpaid').length}
              </h3>
              <p style={styles.statLabel}>Pending Fees</p>
            </div>
          </div>

          {/* Attendance History */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📋 Recent Attendance (Last 30 Days)</h3>
            {attendance.length === 0 ? (
              <p style={styles.emptyText}>No attendance records found.</p>
            ) : (
              <div style={styles.attendanceGrid}>
                {attendance.map(record => (
                  <div key={record.id} style={{
                    ...styles.attendanceBadge,
                    backgroundColor: record.status === 'present' ? '#e6f4ea' : '#fce8e6',
                    color: record.status === 'present' ? '#34a853' : '#e53935',
                  }}>
                    <p style={styles.attendanceDate}>{record.date}</p>
                    <p style={styles.attendanceStatus}>
                      {record.status === 'present' ? '✅' : '❌'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fee History */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>💰 Fee History</h3>
            {fees.length === 0 ? (
              <p style={styles.emptyText}>No fee records found.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.th}>Month</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Due Date</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map(fee => (
                    <tr key={fee.id} style={styles.tableRow}>
                      <td style={styles.td}>{fee.month}</td>
                      <td style={styles.td}>₹{fee.amount}</td>
                      <td style={styles.td}>{fee.due_date}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          backgroundColor: fee.status === 'paid' ? '#e6f4ea' : '#fce8e6',
                          color: fee.status === 'paid' ? '#34a853' : '#e53935',
                        }}>
                          {fee.status === 'paid' ? '✅ Paid' : '⏳ Unpaid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f0f4f8', fontFamily: 'Arial, sans-serif' },
  header: { backgroundColor: '#1a73e8', padding: '24px', textAlign: 'center', color: 'white' },
  logo: { margin: 0, fontSize: '32px', fontWeight: 'bold' },
  subtitle: { margin: '4px 0 0 0', fontSize: '14px', opacity: 0.8 },
  searchCard: { maxWidth: '600px', margin: '32px auto', backgroundColor: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
  searchTitle: { margin: '0 0 8px 0', color: '#333', fontSize: '22px' },
  searchDesc: { margin: '0 0 24px 0', color: '#666', fontSize: '14px' },
  searchForm: { display: 'flex', gap: '12px' },
  searchInput: { flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px' },
  searchBtn: { padding: '12px 24px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' },
  error: { color: '#e53935', marginTop: '12px', fontSize: '14px' },
  content: { maxWidth: '800px', margin: '0 auto', padding: '0 24px 32px' },
  playerCard: { backgroundColor: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' },
  avatar: { width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#1a73e8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold' },
  playerInfo: {},
  playerName: { margin: '0 0 8px 0', fontSize: '24px', color: '#333' },
  playerMeta: { margin: 0, color: '#666', fontSize: '14px' },
  statsRow: { display: 'flex', gap: '16px', marginBottom: '20px' },
  statCard: { flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' },
  statLabel: { color: '#666', margin: '4px 0 0 0', fontSize: '13px' },
  section: { backgroundColor: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' },
  sectionTitle: { margin: '0 0 16px 0', color: '#333', fontSize: '18px' },
  emptyText: { color: '#666', fontSize: '14px' },
  attendanceGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  attendanceBadge: { padding: '8px 12px', borderRadius: '8px', textAlign: 'center', minWidth: '80px' },
  attendanceDate: { margin: 0, fontSize: '11px', fontWeight: '600' },
  attendanceStatus: { margin: '4px 0 0 0', fontSize: '16px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHeader: { backgroundColor: '#f8f9fa' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600', borderBottom: '1px solid #eee' },
  tableRow: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#333' },
  badge: { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
};

export default ParentPortal;