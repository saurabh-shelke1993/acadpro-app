import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import "./Attendance.css";
import {
  getAccessibleAcademies,
  getAccessibleCenters,
  getAccessiblePlayers,
  getAccessibleBatches,
} from "../utils/dataScope";

import {
 MESSAGES
} from '../utils/messages';

import {
  isAcademyOwner,
  isCoach,
  canManageAttendance,
  canAccessBatch,
} from "../utils/permissions";

import {
  saveAttendanceRecords,
} from "../services/attendanceService";

function Attendance() {
  const [user, setUser] = useState(null);

  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [assignedBatchIds, setAssignedBatchIds] = useState([]);

  const [selectedAcademy, setSelectedAcademy] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");

  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [attendanceData, setAttendanceData] = useState({});

  // =====================================================
  // FETCH LOGGED IN USER
  // =====================================================

  useEffect(() => {
    getLoggedInUser();
  }, []);

const getLoggedInUser = async () => {
  try {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!authUser) {
      return;
    }


    // FETCH USER FROM USERS TABLE
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error) throw error;

    setUser(data);
  } catch (err) {
    console.log(err.message);
  }
};

const loadAssignedBatches = async () => {

  if (!isCoach(user)) {
    return;
  }

  try {

    const { data: coachData, error: coachError } =
      await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", user.id)
        .single();

    if (coachError) throw coachError;

    const { data, error } =
      await supabase
        .from("coach_batch_assignments")
        .select("batch_id")
        .eq("coach_id", coachData.id)
        .eq("is_active", true);

    if (error) throw error;

    setAssignedBatchIds(
      data.map(item => item.batch_id)
    );

  } catch (err) {
    console.log(err.message);
  }

};

  // =====================================================
  // FETCH ACADEMIES
  // =====================================================

useEffect(() => {

  if (!user) return;

  fetchAcademies();

  loadAssignedBatches();

}, [user]);

  const fetchAcademies = async () => {
  try {
    const data = await getAccessibleAcademies(user);

    setAcademies(data || []);

    if (
      (isAcademyOwner(user) || isCoach(user)) &&
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
    } else {
      setCenters([]);
    }
  }, [selectedAcademy]);

 const fetchCenters = async () => {
  try {
    const data = await getAccessibleCenters(user);

    const filteredCenters = (data || []).filter(
      (center) => center.academy_id === selectedAcademy
    );

    setCenters(filteredCenters);
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
    } else {
      setBatches([]);
    }
  }, [selectedCenter]);

  const fetchBatches = async () => {
    try {
   const data = await getAccessibleBatches(
  user,
  selectedCenter
);

setBatches(data || []);
    } catch (err) {
      console.log(err.message);
    }
  };

  // =====================================================
  // FETCH PLAYERS
  // =====================================================

  useEffect(() => {
    if (selectedBatch) {
      fetchPlayers();
    } else {
      setPlayers([]);
    }
  }, [selectedBatch]);

  const fetchPlayers = async () => {
  try {

    const data = await getAccessiblePlayers(
      selectedBatch
    );

    setPlayers(data || []);

    // DEFAULT PRESENT

    let attendanceObj = {};

    data.forEach((item) => {
      attendanceObj[item.player_id] = "present";
    });

    setAttendanceData(attendanceObj);

  } catch (err) {
    console.log(err.message);
  }
};
  // =====================================================
  // HANDLE ATTENDANCE CHANGE
  // =====================================================

  const handleAttendanceChange = (playerId, status) => {
    setAttendanceData({
      ...attendanceData,
      [playerId]: status,
    });
  };

  // =====================================================
  // SAVE ATTENDANCE
  // =====================================================

  const saveAttendance = async () => {
    try {

              if (!canManageAttendance(user)) {
            alert("You are not authorized to mark attendance.");
            return;
        }
        if (
  !canAccessBatch(
    user,
    selectedBatch,
    assignedBatchIds
  )
) {
  alert("You are not authorized for this batch.");
  return;
}
      if (!selectedAcademy) {
        alert("Please select academy");
        return;
      }

      if (!selectedCenter) {
        alert("Please select center");
        return;
      }

      if (!selectedBatch) {
        alert("Please select batch");
        return;
      }
// =====================================================
  // CHECK DUPLICATE ATTENDANCE
  // =====================================================
      const { data: existingAttendance, error: duplicateError } =
        await supabase
          .from("attendance")
          .select("*")
          .eq("batch_id", selectedBatch)
          .eq("attendance_date", attendanceDate);

      if (duplicateError) throw duplicateError;

      if (existingAttendance?.length > 0) {
        alert(MESSAGES.DUPLICATE_ATTENDANCE);
        return;
      }
if (players.length === 0) {
  alert(MESSAGES.NO_PLAYERS);
  return;
}

      const attendanceRows = players.map((item) => ({
        academy_id: selectedAcademy,
        player_id: item.player_id,
        batch_id: selectedBatch,
        attendance_date: attendanceDate,
        status: attendanceData[item.player_id],
        marked_by: user?.id,
        remarks: "",
      }));

await saveAttendanceRecords(
  attendanceRows
);

      alert(MESSAGES.ATTENDANCE_SAVED);
    } catch (err) {
      console.log(err.message);
      alert(err.message);
    }
  };

  // =====================================================
  // UI
  // =====================================================

return (
  <Layout>
    <div className="attendance-page">

      <div className="attendance-page-header">
        <div>
          <span className="attendance-page-eyebrow">Daily operations</span>
          <h1>Attendance</h1>
          <p>Record and manage daily player attendance by batch.</p>
        </div>
        <div className="attendance-date-summary">
          <span>Date</span>
          <strong>{attendanceDate}</strong>
        </div>
      </div>

      {/* FILTERS */}

      <div className="attendance-filter-card">
        {/* ACADEMY */}

        <div className="attendance-filter-field">
          <label htmlFor="attendance-academy">Academy</label>
          <br />

          <select
            id="attendance-academy"
            value={selectedAcademy}
            onChange={(e) => {
              setSelectedAcademy(e.target.value);

              // RESET DEPENDENCIES
              setSelectedCenter("");
              setSelectedBatch("");
              setCenters([]);
              setBatches([]);
              setPlayers([]);
            }}
            disabled={
    isAcademyOwner(user) ||
    isCoach(user)
}
          >
            <option value="">Select Academy</option>

            {academies.map((academy) => (
              <option key={academy.id} value={academy.id}>
                {academy.academy_name}
              </option>
            ))}
          </select>
        </div>

        {/* CENTER */}

        <div className="attendance-filter-field">
          <label htmlFor="attendance-center">Center</label>
          <br />

          <select
            id="attendance-center"
            value={selectedCenter}
            onChange={(e) => {
              setSelectedCenter(e.target.value);

              // RESET DEPENDENCIES
              setSelectedBatch("");
              setBatches([]);
              setPlayers([]);
            }}
          >
            <option value="">Select Center</option>

            {centers.map((center) => (
              <option key={center.id} value={center.id}>
                {center.center_name}
              </option>
            ))}
          </select>
        </div>

        {/* BATCH */}

        <div className="attendance-filter-field">
          <label htmlFor="attendance-batch">Batch</label>
          <br />

          <select
            id="attendance-batch"
            value={selectedBatch}
            onChange={(e) =>
              setSelectedBatch(e.target.value)
            }
          >
            <option value="">Select Batch</option>

            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batch_name}
              </option>
            ))}
          </select>
        </div>

        {/* DATE */}

        <div className="attendance-filter-field">
          <label htmlFor="attendance-date">Date</label>
          <br />

          <input
            type="date"
            value={attendanceDate}
            onChange={(e) =>
              setAttendanceDate(e.target.value)
            }
          />
        </div>
      </div>

      {/* PLAYERS */}

      <div className="attendance-list-header">
        <div>
          <h2>Players Attendance</h2>
          <p>{players.length} {players.length === 1 ? "player" : "players"} in the selected batch</p>
        </div>
        {selectedBatch && <span className="attendance-selection-badge">Batch selected</span>}
      </div>

      <div className="attendance-table-wrap">
      <table className="attendance-table">
        <thead>
          <tr>
            <th>Player Name</th>
            <th>Present</th>
            <th>Absent</th>
          </tr>
        </thead>

        <tbody>
          {players.length === 0 ? (
            <tr>
              <td className="attendance-empty-state" colSpan={3}>
                <strong>No players to mark</strong>
                <span>{selectedBatch ? "No active players are available in this batch." : "Select a batch to load players."}</span>
              </td>
            </tr>
          ) : (
            players.map((item) => (
            <tr key={item.player_id}>
              <td>{item.players?.full_name}</td>

              <td align="center">
                <input
                  type="radio"
                  name={`attendance-${item.player_id}`}
                  checked={
                    attendanceData[item.player_id] ===
                    "present"
                  }
                  onChange={() =>
                    handleAttendanceChange(
                      item.player_id,
                      "present"
                    )
                  }
                />
              </td>

              <td align="center">
                <input
                  type="radio"
                  name={`attendance-${item.player_id}`}
                  checked={
                    attendanceData[item.player_id] ===
                    "absent"
                  }
                  onChange={() =>
                    handleAttendanceChange(
                      item.player_id,
                      "absent"
                    )
                  }
                />
              </td>
            </tr>
          ))
          )}
        </tbody>
      </table>
      </div>

      <br />

{canManageAttendance(user) && (
    <button className="attendance-save-button" type="button" onClick={saveAttendance}>
        Save Attendance
    </button>
)}
    </div>
  </Layout>
);
}

export default Attendance;