import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../supabaseClient";
import {
  getAccessiblePlayers,
} from "../utils/dataScope";

function CoachAttendance() {
  const user = JSON.parse(localStorage.getItem("acadpro_user"));

  const [batches, setBatches] = useState([]);

  const [selectedBatch, setSelectedBatch] = useState("");
  const [players, setPlayers] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isEditMode, setIsEditMode] = useState(false);
const [existingAttendance, setExistingAttendance] = useState([]);

  useEffect(() => {
    loadCoachBatches();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      loadPlayers();
    }
  }, [selectedBatch]);

  // =========================
  // LOAD COACH ASSIGNED BATCHES
  // =========================

 const loadCoachBatches = async () => {

  // Step 1
  const { data: coachData, error: coachError } =
    await supabase
      .from("coaches")
      .select("id")
      .eq("user_id", user.id)
      .single();

  if (coachError) {
    console.log(coachError);
    return;
  }

  // Step 2
  const coachId = coachData.id;

  // Step 3
  const { data, error } =
    await supabase
      .from("coach_batch_assignments")
      .select(`
        batch_id,
        batches (
          id,
          batch_name
        )
      `)
      .eq("coach_id", coachId)
      .eq("is_active", true);

  if (error) {
    console.log(error);
    return;
  }

  const formattedBatches =
    data?.map(item => ({
      id: item.batches.id,
      name: item.batches.batch_name
    })) || [];

  setBatches(formattedBatches);
};

// =========================
// CHECK EXISTING ATTENDANCE
// =========================

const checkExistingAttendance = async () => {

  try {

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("is_deleted", false)
      .eq("batch_id", selectedBatch)
      .eq("attendance_date", attendanceDate);

    if (error) {

      console.log(error);
      return false;

    }

    if (data && data.length > 0) {

      setIsEditMode(true);
      setExistingAttendance(data);

      return true;

    }

    setIsEditMode(false);
    setExistingAttendance([]);

    return false;

  } catch (err) {

    console.log(err);

    return false;

  }

};

  // =========================
  // LOAD PLAYERS
  // =========================

  const loadPlayers = async () => {
  try {

    const attendanceExists =
      await checkExistingAttendance();
          console.log(
      "Attendance Exists:",
      attendanceExists
    );

const data = await getAccessiblePlayers(
  selectedBatch
);

const formattedPlayers =
  data?.map((item) => ({
    id: item.player_id,
    full_name: item.players?.full_name,
    status: "present",
  })) || [];

setPlayers(formattedPlayers);
    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // MARK ATTENDANCE
  // =========================

  const handleAttendanceChange = (playerId, status) => {
    const updatedPlayers = players.map((player) => {
      if (player.id === playerId) {
        return {
          ...player,
          status,
        };
      }

      return player;
    });

    setPlayers(updatedPlayers);
  };

  // =========================
  // SAVE ATTENDANCE
  // =========================

 const saveAttendance = async () => {

  try {

    // =========================
    // CHECK DUPLICATE ATTENDANCE
    // =========================

    const { data: existingAttendance, error: checkError } =
      await supabase
        .from("attendance")
        .select("id")
        .eq("batch_id", selectedBatch)
        .eq("attendance_date", attendanceDate);

    if (checkError) {

      console.log(checkError);
      alert("Error checking attendance");
      return;

    }

    if (existingAttendance.length > 0) {

      alert("Attendance already marked for this batch on selected date.");
      return;

    }

    // =========================
    // SAVE ATTENDANCE
    // =========================

    const attendanceRecords =
      players.map((player) => ({
academy_id: user.academy_id,

        player_id: player.id,

        batch_id: selectedBatch,

        attendance_date: attendanceDate,

        status: player.status,

        marked_by: user.id,

      }));

    const { error } =
      await supabase
        .from("attendance")
        .insert(attendanceRecords);

    if (error) {

      console.log(error);

      alert("Error saving attendance");

      return;

    }

    alert("Attendance saved successfully");

  } catch (err) {

    console.log(err);

  }

};

return (
  <Layout>
      <div style={{ flex: 1, padding: "30px" }}>
        <h1>Coach Attendance</h1>

        <h2>Welcome, {user?.full_name}</h2>

        {/* DATE */}

        <div style={{ marginTop: "20px" }}>
          <label>Date</label>

          <br />

          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
          />
        </div>

        {/* BATCH */}

        <div style={{ marginTop: "20px" }}>
          <label>Select Batch</label>

          <br />

          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
          >
            <option value="">Select Batch</option>

            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </div>

        {/* PLAYERS TABLE */}

        <div style={{ marginTop: "30px" }}>
          <h2>Players Attendance</h2>

          <table
            border="1"
            cellPadding="10"
            cellSpacing="0"
            width="100%"
          >
            <thead>
              <tr>
                <th>Player Name</th>
                <th>Present</th>
                <th>Absent</th>
              </tr>
            </thead>

            <tbody>
              {players.length > 0 ? (
                players.map((player) => (
                  <tr key={player.id}>
                    <td>{player.full_name}</td>

                    <td align="center">
                      <input
                        type="radio"
                        name={`attendance-${player.id}`}
                        checked={player.status === "present"}
                        onChange={() =>
                          handleAttendanceChange(player.id, "present")
                        }
                      />
                    </td>

                    <td align="center">
                      <input
                        type="radio"
                        name={`attendance-${player.id}`}
                        checked={player.status === "absent"}
                        onChange={() =>
                          handleAttendanceChange(player.id, "absent")
                        }
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3">No Players Found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* SAVE BUTTON */}

        <button
          onClick={saveAttendance}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            cursor: "pointer",
          }}
        >
          Save Attendance
        </button>
    </div>
  </Layout>
);
}

export default CoachAttendance;