import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function Attendance() {
  const [players, setPlayers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPlayers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (players.length > 0) fetchAttendance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, players]);

  const fetchPlayers = async () => {
    setLoading(true);
    const { data } = await supabase.from('players').select('*').order('batch');
    setPlayers(data || []);
    setLoading(false);
  };

  const fetchAttendance = async () => {
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', selectedDate);
    const attendanceMap = {};
    (data || []).forEach(record => {
      attendanceMap[record.player_id] = record.status;
    });
    setAttendance(attendanceMap);
  };

  const toggleAttendance = (playerId) => {
    setAttendance(prev => ({
      ...prev,
      [playerId]: prev[playerId] === 'present' ? 'absent' : 'present'
    }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    for (const player of players) {
      const status = attendance[player.id] || 'absent';
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('player_id', player.id)
        .eq('date', selectedDate);
      if (existing && existing.length > 0) {
        await supabase.from('attendance')
          .update({ status })
          .eq('player_id', player.id)
          .eq('date', selectedDate);
      } else {
        await supabase.from('attendance')
          .insert([{ player_id: player.id, date: selectedDate, status }]);
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = players.length - presentCount;

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.title}>Attendance</h2>
        <div style={styles.headerRight}>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={styles.datePicker}
          />
          <button style={styles.saveBtn} onClick={saveAttendance} disabled={saving}>
            {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Attendance'}
          </button>
        </div>
      </div>
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <h3 style={{ color: '#34a853', margin: 0 }}>{presentCount}</h3>
          <p style={styles.statLabel}>Present</p>
        </div>
        <div style={styles.statCard}>
          <h3 style={{ color: '#e53935', margin: 0 }}>{absentCount}</h3>
          <p style={styles.statLabel}>Absent</p>
        </div>
        <div style={styles.statCard}>
          <h3 style={{ color: '#1a73e8', margin: 0 }}>{players.length}</h3>
          <p style={styles.statLabel}>Total Players</p>
        </div>
      </div>
      {players.length === 0 ? (
        <div style={styles.emptyState}>
          <p>⚽ No players found. Add players first!</p>
        </div>
      ) : (
        <div style={styles.playerList}>
          {players.map(player => {
            const status = attendance[player.id] || 'absent';
            const isPresent = status === 'present';
            return (
              <div key={player.id} style={styles.playerRow}>
                <div style={styles.playerInfo}>
                  <div style={styles.avatar}>{player.name.charAt(0)}</div>
                  <div>
                    <p style={styles.playerName}>{player.name}</p>
                    <p style={styles.playerMeta}>{player.position} • {player.batch}</p>
                  </div>
                </div>
                <div style={styles.toggleContainer}>
                  <span style={{ color: isPresent ? '#34a853' : '#e53935', fontWeight: '600', fontSize: '14px', marginRight: '12px' }}>
                    {isPresent ? 'Present' : 'Absent'}
                  </span>
                  <div onClick={() => toggleAttendance(player.id)}
                    style={{ ...styles.toggle, backgroundColor: isPresent ? '#34a853' : '#ddd' }}>
                    <div style={{ ...styles.toggleKnob, transform: isPresent ? 'translateX(24px)' : 'translateX(0)' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '24px', color: '#333', margin: 0 },
  headerRight: { display: 'flex', gap: '12px', alignItems: 'center' },
  datePicker: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' },
  saveBtn: { padding: '10px 20px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  statsRow: { display: 'flex', gap: '16px', marginBottom: '24px' },
  statCard: { backgroundColor: 'white', padding: '20px 32px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' },
  statLabel: { color: '#666', margin: '4px 0 0 0', fontSize: '13px' },
  emptyState: { textAlign: 'center', padding: '60px', backgroundColor: 'white', borderRadius: '12px', color: '#666' },
  playerList: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' },
  playerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f0f0f0' },
  playerInfo: { display: 'flex', alignItems: 'center', gap: '16px' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e8f0fe', color: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' },
  playerName: { margin: 0, fontWeight: '600', color: '#333' },
  playerMeta: { margin: '2px 0 0 0', fontSize: '13px', color: '#666' },
  toggleContainer: { display: 'flex', alignItems: 'center' },
  toggle: { width: '48px', height: '24px', borderRadius: '12px', cursor: 'pointer', position: 'relative', transition: 'background-color 0.3s' },
  toggleKnob: { width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px', transition: 'transform 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
};

export default Attendance;