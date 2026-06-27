import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  getAccessibleCenters,
  getAccessibleBatches
} from "../utils/dataScope";


import {
  getCurrentUser,
  isSuperAdmin,
} from "../utils/auth";

import Layout from "../components/Layout";

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
      console.log("Academies:", data);

console.log(
  "Auto Selected Academy:",
  data[0]?.id
);
      // AUTO SELECT OWNER ACADEMY
      if (
        !isSuperAdmin(user) &&
        data &&
        data.length > 0
      ) {
        setSelectedAcademy(data[0].id);
        console.log(
  "Selected Academy State Updated"
);
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
      
      console.log("Attendance History Data:", data);
console.log("Attendance History Error:", error);

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

    const { error } = await supabase
      .from("attendance")
      .update({
        status: editingStatus
      })
      .eq("id", attendanceId);

    if (error) throw error;

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

  try {

    const { error } = await supabase
      .from("attendance")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq("id", attendanceId);

    if (error) throw error;

    await fetchAttendanceHistory();

    alert("Attendance deleted successfully.");

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
    <div style={{ padding: "20px" }}>


      <h1>Attendance History</h1>

      {/* FILTERS */}

      <div
        style={{
          display: "flex",
          gap: "20px",
          marginBottom: "30px",
          flexWrap: "wrap",
        }}
      >

        {/* ACADEMY */}

        <div>

          <label>Academy</label>

          <br />

          <select
            value={selectedAcademy}
            onChange={(e) => {
              setSelectedAcademy(
                e.target.value
              );

              setSelectedCenter("");
              setSelectedBatch("");
            }}
            disabled={!isSuperAdmin(user)}
          >

            <option value="">
              Select Academy
            </option>

            {academies.map((academy) => (
              <option
                key={academy.id}
                value={academy.id}
              >
                {academy.academy_name}
              </option>
            ))}

          </select>

        </div>

        {/* CENTER */}

        <div>

          <label>Center</label>

          <br />

          <select
            value={selectedCenter}
            onChange={(e) => {
              setSelectedCenter(
                e.target.value
              );

              setSelectedBatch("");
            }}
          >

            <option value="">
              Select Center
            </option>

            {centers.map((center) => (
              <option
                key={center.id}
                value={center.id}
              >
                {center.center_name}
              </option>
            ))}

          </select>

        </div>

        {/* BATCH */}

        <div>

          <label>Batch</label>

          <br />

          <select
            value={selectedBatch}
            onChange={(e) =>
              setSelectedBatch(
                e.target.value
              )
            }
          >

            <option value="">
              Select Batch
            </option>

            {batches.map((batch) => (
              <option
                key={batch.id}
                value={batch.id}
              >
                {batch.batch_name}
              </option>
            ))}

          </select>

        </div>

        {/* DATE */}

        <div>

          <label>Date</label>

          <br />

          <input
            type="date"
            value={selectedDate}
            onChange={(e) =>
              setSelectedDate(
                e.target.value
              )
            }
          />

        </div>

      </div>

      {/* TABLE */}

      {loading ? (
        <h3>Loading...</h3>
      ) : (
        <table
          border="1"
          cellPadding="10"
          width="100%"
        >

          <thead>
<tr>
  <th>Date</th>
  <th>Player Name</th>
  <th>Center</th>
  <th>Batch</th>
  <th>Status</th>
  <th>Marked By</th>
  <th>Action</th>
</tr>
          </thead>

          <tbody>

            {attendanceHistory.length > 0 ? (
              attendanceHistory.map((item) => (
                <tr key={item.id}>

                  <td>
                    {item.attendance_date}
                  </td>

                  <td>
                    {item.players?.full_name}
                  </td>

                  
                  <td>
                    {item.batches?.centers?.center_name}
                  </td>

                  <td>
                    {item.batches?.batch_name}
                  </td>

<td>
  {editingAttendanceId === item.id ? (
    <select
      value={editingStatus}
      onChange={(e) =>
        setEditingStatus(e.target.value)
      }
    >
      <option value="present">Present</option>
      <option value="absent">Absent</option>
    </select>
  ) : (
    item.status
  )}
</td>

                  <td>
                    {item.users?.full_name}
                  </td>
<td>

{editingAttendanceId === item.id ? (

    <>

        <button
            onClick={() =>
                updateAttendance(item.id)
            }
        >
            Save
        </button>

        {" "}

        <button
            onClick={() => {

                setEditingAttendanceId(null);
                setEditingStatus("");

            }}
        >
            Cancel
        </button>

    </>

) : (

    <>

        <button
            onClick={() => {

                setEditingAttendanceId(item.id);
                setEditingStatus(item.status);

            }}
            title="Edit Attendance"
        >
            ✏️
        </button>

        {" "}

        <button
            onClick={() =>
                deleteAttendance(item.id)
            }
            title="Delete Attendance"
        >
            🗑️
        </button>

    </>

)}

</td>

                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="7"
                  align="center"
                >
                  No attendance found
                </td>
              </tr>
            )}

          </tbody>

        </table>
      )}

    </div>
  </Layout>
);
}

export default AttendanceHistory;