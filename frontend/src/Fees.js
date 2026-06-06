import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function Fees() {
  const [players, setPlayers] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    player_id: '', amount: '', due_date: '', month: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: playersData } = await supabase.from('players').select('*');
    const { data: feesData } = await supabase
      .from('fees')
      .select('*, players(name, batch)')
      .order('created_at', { ascending: false });
    setPlayers(playersData || []);
    setFees(feesData || []);
    setLoading(false);
  };

  const handleAddFee = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('fees').insert([form]);
    if (!error) {
      setForm({ player_id: '', amount: '', due_date: '', month: '' });
      setShowForm(false);
      fetchData();
    } else {
      alert(error.message);
    }
  };

  const togglePayment = async (fee) => {
    const newStatus = fee.status === 'paid' ? 'unpaid' : 'paid';
    const paidDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;
    await supabase.from('fees')
      .update({ status: newStatus, paid_date: paidDate })
      .eq('id', fee.id);
    fetchData();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this fee record?')) {
      await supabase.from('fees').delete().eq('id', id);
      fetchData();
    }
  };

  const totalCollected = fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + Number(f.amount), 0);
  const totalPending = fees.filter(f => f.status === 'unpaid').reduce((sum, f) => sum + Number(f.amount), 0);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.title}>Fee Management</h2>
        <button style={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Fee'}
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <h3 style={{ color: '#34a853', margin: 0 }}>₹{totalCollected}</h3>
          <p style={styles.statLabel}>Collected</p>
        </div>
        <div style={styles.statCard}>
          <h3 style={{ color: '#e53935', margin: 0 }}>₹{totalPending}</h3>
          <p style={styles.statLabel}>Pending</p>
        </div>
        <div style={styles.statCard}>
          <h3 style={{ color: '#1a73e8', margin: 0 }}>{fees.length}</h3>
          <p style={styles.statLabel}>Total Records</p>
        </div>
      </div>

      {/* Add Fee Form */}
      {showForm && (
        <form onSubmit={handleAddFee} style={styles.form}>
          <div style={styles.formGrid}>
            <select style={styles.input} value={form.player_id}
              onChange={e => setForm({ ...form, player_id: e.target.value })} required>
              <option value="">Select Player</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.batch})</option>
              ))}
            </select>
            <input style={styles.input} placeholder="Amount (₹)" type="number"
              value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            <input style={styles.input} placeholder="Month (e.g. June 2026)"
              value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} required />
            <input style={styles.input} type="date" placeholder="Due Date"
              value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required />
          </div>
          <button style={styles.submitBtn} type="submit">Save Fee Record</button>
        </form>
      )}

      {/* Fee Records Table */}
      {fees.length === 0 ? (
        <div style={styles.emptyState}>
          <p>💰 No fee records yet. Click "+ Add Fee" to get started!</p>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>Player</th>
              <th style={styles.th}>Batch</th>
              <th style={styles.th}>Month</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Due Date</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {fees.map(fee => (
              <tr key={fee.id} style={styles.tableRow}>
                <td style={styles.td}>{fee.players?.name || 'N/A'}</td>
                <td style={styles.td}>{fee.players?.batch || 'N/A'}</td>
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
                <td style={styles.td}>
                  <button
                    style={{ ...styles.actionBtn, backgroundColor: fee.status === 'paid' ? '#fce8e6' : '#e6f4ea', color: fee.status === 'paid' ? '#e53935' : '#34a853' }}
                    onClick={() => togglePayment(fee)}>
                    {fee.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                  </button>
                  <button style={styles.deleteBtn} onClick={() => handleDelete(fee.id)}>Delete</button>
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
  statsRow: { display: 'flex', gap: '16px', marginBottom: '24px' },
  statCard: { backgroundColor: 'white', padding: '20px 32px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' },
  statLabel: { color: '#666', margin: '4px 0 0 0', fontSize: '13px' },
  form: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  submitBtn: { padding: '10px 24px', backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  emptyState: { textAlign: 'center', padding: '60px', backgroundColor: 'white', borderRadius: '12px', color: '#666' },
  table: { width: '100%', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderCollapse: 'collapse' },
  tableHeader: { backgroundColor: '#f8f9fa' },
  th: { padding: '14px 16px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600', borderBottom: '1px solid #eee' },
  tableRow: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '14px 16px', fontSize: '14px', color: '#333' },
  badge: { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  actionBtn: { padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginRight: '8px' },
  deleteBtn: { padding: '6px 12px', backgroundColor: '#fee', color: '#e53935', border: '1px solid #ffcdd2', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};

export default Fees;