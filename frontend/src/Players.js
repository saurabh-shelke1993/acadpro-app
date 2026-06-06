import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function Players() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', age: '', position: '', batch: '', phone: ''
  });

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('players').select('*').order('created_at', { ascending: false });
    if (!error) setPlayers(data);
    setLoading(false);
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('players').insert([form]);
    if (!error) {
      setForm({ name: '', age: '', position: '', batch: '', phone: '' });
      setShowForm(false);
      fetchPlayers();
    } else {
      alert(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this player?')) {
      await supabase.from('players').delete().eq('id', id);
      fetchPlayers();
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.title}>Players</h2>
        <button style={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Player'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddPlayer} style={styles.form}>
          <div style={styles.formGrid}>
            <input style={styles.input} placeholder="Full Name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} required />
            <input style={styles.input} placeholder="Age" type="number" value={form.age}
              onChange={e => setForm({ ...form, age: e.target.value })} required />
            <select style={styles.input} value={form.position}
              onChange={e => setForm({ ...form, position: e.target.value })} required>
              <option value="">Select Position</option>
              <option>Goalkeeper</option>
              <option>Defender</option>
              <option>Midfielder</option>
              <option>Forward</option>
            </select>
            <select style={styles.input} value={form.batch}
              onChange={e => setForm({ ...form, batch: e.target.value })} required>
              <option value="">Select Batch</option>
              <option>U-10</option>
              <option>U-12</option>
              <option>U-14</option>
              <option>U-16</option>
              <option>U-18</option>
              <option>Senior</option>
            </select>
            <input style={styles.input} placeholder="Phone Number" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <button style={styles.submitBtn} type="submit">Save Player</button>
        </form>
      )}

      {loading ? (
        <p>Loading players...</p>
      ) : players.length === 0 ? (
        <div style={styles.emptyState}>
          <p>⚽ No players added yet. Click "Add Player" to get started!</p>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Age</th>
              <th style={styles.th}>Position</th>
              <th style={styles.th}>Batch</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map(player => (
              <tr key={player.id} style={styles.tableRow}>
                <td style={styles.td}>{player.name}</td>
                <td style={styles.td}>{player.age}</td>
                <td style={styles.td}>{player.position}</td>
                <td style={styles.td}><span style={styles.badge}>{player.batch}</span></td>
                <td style={styles.td}>{player.phone}</td>
                <td style={styles.td}>
                  <button style={styles.deleteBtn} onClick={() => handleDelete(player.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '24px', color: '#333', margin: 0 },
  addBtn: { padding: '10px 20px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  form: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  submitBtn: { padding: '10px 24px', backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  emptyState: { textAlign: 'center', padding: '60px', backgroundColor: 'white', borderRadius: '12px', color: '#666' },
  table: { width: '100%', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderCollapse: 'collapse' },
  tableHeader: { backgroundColor: '#f8f9fa' },
  th: { padding: '14px 16px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600', borderBottom: '1px solid #eee' },
  tableRow: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  badge: { backgroundColor: '#e8f0fe', color: '#1a73e8', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' },
  deleteBtn: { padding: '6px 12px', backgroundColor: '#fee', color: '#e53935', border: '1px solid #ffcdd2', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};

export default Players;