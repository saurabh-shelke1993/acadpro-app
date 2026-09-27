import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  getAccessibleCenters,
  getAccessibleBatches
} from "../utils/dataScope";

import {
 MESSAGES
} from '../utils/messages';

import {
  getCurrentUser,
} from "../utils/auth";

import {
  isSuperAdmin,
  isAcademyOwner,
  isCoach,
  canEditAttendance,
  canDeleteAttendance,
} from "../utils/permissions";

import {
  updateAttendanceStatus,
  softDeleteAttendance,
} from "../services/attendanceService";

import Layout from "../components/Layout";
import "./AttendanceHistory.css";

function AttendanceHistory() {

  // =====================================================
  // STATES
  // =====================================================

  const [user, setUser] = useState(null);

  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);

  const [selectedAcademy, setSelectedAcademy] =
    useState("");

  const [selectedCenter, setSelectedCenter] =
    useState("");

  const [selectedBatch, setSelectedBatch] =
    useState("");

  const [selectedDate, setSelectedDate] =
    useState("");

  const [attendanceHistory, setAttendanceHistory] =
    useState([]);

  const [loading, setLoading] = useState(false);

  const [editingAttendanceId, setEditingAttendanceId] = useState(null);
const [editingStatus, setEditingStatus] = useState("");

  // =====================================================
  // LOAD USER
  // =====================================================

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await getCurrentUser();

    setUser(currentUser);
  };

  // =====================================================
  // FETCH ACADEMIES
  // =====================================================

  useEffect(() => {
    if (user) {
      fetchAcademies();
    }
  }, [user]);

  const fetchAcademies = async () => {
    try {

      let query = supabase
        .from("academies")
        .select("*")
        .eq("is_active", true);

      // ACADEMY OWNER FILTER
      if (!isSuperAdmin(user)) {
        query = query.eq(
          "id",
          user.academy_id
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      setAcademies(data || []);


      // AUTO SELECT OWNER ACADEMY
      if (
        !isSuperAdmin(user) &&
        data &&
        data.length > 0
      ) {
        setSelectedAcademy(data[0].id);

      }

    } catch (err) {
      console.log(err.message);
    }
  };

  // =====================================================
  // FETCH CENTERS
  // =====================================================

  useEffect(() => {
    if (selectedAcademy) {
      fetchCenters();
    }
  }, [selectedAcademy]);

  const fetchCenters = async () => {

  try {

    const centers =
      await getAccessibleCenters(user);

    setCenters(centers || []);

    // Auto-select if only one center is available

    if (
      centers &&
      centers.length === 1
    ) {

      setSelectedCenter(
        centers[0].id
      );

    }

  } catch (err) {

    console.log(err.message);

  }

};

  // =====================================================
  // FETCH BATCHES
  // =====================================================

  useEffect(() => {
    if (selectedCenter) {
      fetchBatches();
    }
  }, [selectedCenter]);

const fetchBatches = async () => {

  try {

    const batches =
      await getAccessibleBatches(
        user,
        selectedCenter
      );

    setBatches(batches || []);

  } catch (err) {

    console.log(err.message);

  }

};

  // =====================================================
  // FETCH ATTENDANCE HISTORY
  // =====================================================

  const fetchAttendanceHistory = async () => {
    try {

      setLoading(true);

      let query = supabase
        .from("attendance")
        .select(`
          *,
          players (
            full_name
          ),
batches (
  batch_name,
  centers (
    center_name
  )
),
  users!attendance_marked_by_fkey (
    full_name
  )
        `)
          .eq("is_deleted", false)
        .order("attendance_date", {
          ascending: false,
        });

      // FILTERS

      if (selectedAcademy) {
        query = query.eq(
          "academy_id",
          selectedAcademy
        );
      }

if (selectedCenter) {

  const centerBatches =
    await getAccessibleBatches(
      user,
      selectedCenter
    );

  const batchIds =
    centerBatches.map(
      batch => batch.id
    );

  if (batchIds.length === 0) {

    setAttendanceHistory([]);
    setLoading(false);
    return;

  }

  query = query.in(
    "batch_id",
    batchIds
  );
}

      if (selectedBatch) {
        query = query.eq(
          "batch_id",
          selectedBatch
        );
      }

      if (selectedDate) {
        query = query.eq(
          "attendance_date",
          selectedDate
        );
      }

      const { data, error } = await query;
    

      if (error) throw error;

      setAttendanceHistory(data || []);

      setLoading(false);

    } catch (err) {
      console.log(err.message);
      setLoading(false);
    }
  };

  // =====================================================
// UPDATE ATTENDANCE
// =====================================================

const updateAttendance = async (attendanceId) => {

  try {

    if (!canEditAttendance(user)) {

  alert("You are not authorized to edit attendance.");

  return;

}
await updateAttendanceStatus(
  attendanceId,
  editingStatus
);

    // Exit edit mode

    setEditingAttendanceId(null);
    setEditingStatus("");

    // Reload history

    fetchAttendanceHistory();

  } catch (err) {

    console.log(err.message);

  }

};

// =====================================================
// SOFT DELETE ATTENDANCE
// =====================================================

const deleteAttendance = async (attendanceId) => {

  const confirmDelete = window.confirm(
    "Are you sure you want to delete this attendance record?"
  );

  if (!confirmDelete) return;
  if (!canDeleteAttendance(user)) {

  alert("You are not authorized to delete attendance.");

  return;

}

  try {

await softDeleteAttendance(
  attendanceId,
  user.id
);

    await fetchAttendanceHistory();

    alert(MESSAGES.ATTENDANCE_DELETED);

  } catch (err) {

    console.log(err);

    alert("Unable to delete attendance.");

  }

};

  // =====================================================
  // LOAD HISTORY WHEN FILTERS CHANGE
  // =====================================================

useEffect(() => {
  fetchAttendanceHistory();
}, [
  selectedAcademy,
  selectedCenter,
  selectedBatch,
  selectedDate,
]);

  // =====================================================
  // UI
  // =====================================================

return (
  <Layout>
    <div className="attendance-history-page">
      <div className="attendance-history-header">
        <div>
          <span className="attendance-history-eyebrow">Attendance management</span>
          <h1>Attendance History</h1>
          <p>Review, edit, and manage recorded player attendance.</p>
        </div>
        <div className="attendance-history-count"><strong>{attendanceHistory.length}</strong><span>records shown</span></div>
      </div>

      <div className="attendance-history-filter-card">
        <div className="attendance-history-section-heading"><div><h2>Filters</h2><p>Use academy, center, batch, and date to narrow the history.</p></div></div>
        <div className="attendance-history-filter-grid">
          <label className="attendance-history-field"><span>Academy</span>
            <select value={selectedAcademy} onChange={(e) => { setSelectedAcademy(e.target.value); setSelectedCenter(""); setSelectedBatch(""); }} disabled={!isSuperAdmin(user)}>
              <option value="">Select Academy</option>
              {academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.academy_name}</option>)}
            </select>
          </label>
          <label className="attendance-history-field"><span>Center</span>
            <select value={selectedCenter} onChange={(e) => { setSelectedCenter(e.target.value); setSelectedBatch(""); }}>
              <option value="">Select Center</option>
              {centers.map((center) => <option key={center.id} value={center.id}>{center.center_name}</option>)}
            </select>
          </label>
          <label className="attendance-history-field"><span>Batch</span>
            <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
              <option value="">Select Batch</option>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_name}</option>)}
            </select>
          </label>
          <label className="attendance-history-field"><span>Date</span>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="attendance-history-list-header">
        <div><h2>Attendance Records</h2><p>{selectedDate ? `Showing records for ${selectedDate}.` : "Latest attendance records first."}</p></div>
      </div>

      {loading ? (
        <div className="attendance-history-state"><strong>Loading attendance...</strong><span>Please wait while the records are retrieved.</span></div>
      ) : (
        <div className="attendance-history-table-wrap">
          <table className="attendance-history-table">
            <caption className="sr-only">Attendance history with status and available edit or delete actions</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Player</th><th scope="col">Center</th><th scope="col">Batch</th><th scope="col">Status</th><th scope="col">Marked By</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              {attendanceHistory.length > 0 ? attendanceHistory.map((item) => (
                <tr key={item.id}>
                  <td>{item.attendance_date}</td>
                  <td className="attendance-history-player-cell">{item.players?.full_name || "—"}</td>
                  <td>{item.batches?.centers?.center_name || "—"}</td>
                  <td>{item.batches?.batch_name || "—"}</td>
                  <td>
                    {editingAttendanceId === item.id ? (
                      <select className="attendance-history-status-select" value={editingStatus} onChange={(e) => setEditingStatus(e.target.value)}>
                        <option value="present">Present</option><option value="absent">Absent</option>
                      </select>
                    ) : (
                      <span className={`attendance-status-badge attendance-status-${item.status}`}>{item.status}</span>
                    )}
                  </td>
                  <td>{item.users?.full_name || "—"}</td>
                  <td>
                    <div className="attendance-history-actions">
                      {editingAttendanceId === item.id ? (
                        <>
                          {canEditAttendance(user) && <button className="attendance-action-button attendance-action-save" type="button" onClick={() => updateAttendance(item.id)} aria-label={`Save attendance for ${item.players?.full_name || "player"}`}>Save</button>}
                          <button className="attendance-action-button attendance-action-cancel" type="button" onClick={() => { setEditingAttendanceId(null); setEditingStatus(""); }} aria-label={`Cancel editing attendance for ${item.players?.full_name || "player"}`}>Cancel</button>
                        </>
                      ) : (
                        <>
                          {canEditAttendance(user) && <button className="attendance-icon-button" type="button" onClick={() => { setEditingAttendanceId(item.id); setEditingStatus(item.status); }} title="Edit Attendance" aria-label="Edit Attendance">✏️</button>}
                          {canDeleteAttendance(user) && <button className="attendance-icon-button attendance-delete-button" type="button" onClick={() => deleteAttendance(item.id)} title="Delete Attendance" aria-label="Delete Attendance">🗑️</button>}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td className="attendance-history-empty-state" colSpan="7"><strong>No attendance found</strong><span>Try adjusting the selected filters.</span></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </Layout>
);
}

export default AttendanceHistory;