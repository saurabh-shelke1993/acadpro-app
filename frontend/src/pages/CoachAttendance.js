import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import "./Attendance.css";
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
  }, [selectedBatch, attendanceDate]);

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

    if (error) throw error;

    const records = data || [];
    setIsEditMode(records.length > 0);
    setExistingAttendance(records);
    return records;
  } catch (err) {
    console.log(err);
    setIsEditMode(false);
    setExistingAttendance([]);
    return [];
  }
};

  // =========================
  // LOAD PLAYERS
  // =========================

  const loadPlayers = async () => {
  try {
    const existingRecords = await checkExistingAttendance();

    const data = await getAccessiblePlayers(selectedBatch);
    const existingByPlayer = new Map(
      existingRecords.map((record) => [record.player_id, record.status])
    );

    const formattedPlayers =
      data?.map((item) => ({
        id: item.player_id,
        full_name: item.players?.full_name,
        status: existingByPlayer.get(item.player_id) || "present",
      })) || [];

    setPlayers(formattedPlayers);
  } catch (err) {
    console.log(err);
    setPlayers([]);
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
    <div className="attendance-page">
      <section className="attendance-workspace-card" aria-labelledby="coach-attendance-title">
        <div className="attendance-workspace-heading">
          <div>
            <span className="attendance-page-eyebrow">Daily operations</span>
            <h1 id="coach-attendance-title">Coach Attendance</h1>
            <p>Welcome, {user?.full_name || "Coach"}. Select your assigned batch and date, then mark attendance.</p>
          </div>
          {selectedBatch ? (
            <span className={isEditMode ? "attendance-status-badge attendance-status-existing" : "attendance-status-badge"}>
              {isEditMode ? "Attendance recorded" : "Ready to mark"}
            </span>
          ) : null}
        </div>

        <div className="attendance-filter-card attendance-coach-filter-card">
          <div className="attendance-filter-field">
            <label htmlFor="coach-attendance-batch">Batch</label>
            <select
              id="coach-attendance-batch"
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setPlayers([]);
                setIsEditMode(false);
                setExistingAttendance([]);
              }}
            >
              <option value="">Select Batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="attendance-filter-field">
            <label htmlFor="coach-attendance-date">Date</label>
            <input
              id="coach-attendance-date"
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>
        </div>

        {selectedBatch ? (
          <div className="attendance-summary attendance-coach-summary" aria-label="Attendance summary">
            <div className="attendance-summary-item">
              <span>Total players</span>
              <strong>{players.length}</strong>
            </div>
            <div className="attendance-summary-item attendance-summary-present">
              <span>Present</span>
              <strong>{players.filter((player) => player.status === "present").length}</strong>
            </div>
            <div className="attendance-summary-item attendance-summary-absent">
              <span>Absent</span>
              <strong>{players.filter((player) => player.status === "absent").length}</strong>
            </div>
            <div className="attendance-summary-item attendance-summary-unmarked">
              <span>Unmarked</span>
              <strong>{players.filter((player) => !player.status).length}</strong>
            </div>
          </div>
        ) : null}

        {isEditMode ? (
          <div className="attendance-inline-message attendance-inline-success" role="status">
            <strong>✓</strong>
            <span>Attendance already exists for this batch and date. Review the recorded attendance below.</span>
          </div>
        ) : null}
      </section>

      <section className="attendance-list-section" aria-labelledby="coach-players-attendance-title">
        <div className="attendance-list-header">
          <div>
            <span className="attendance-section-eyebrow">Daily roster</span>
            <h2 id="coach-players-attendance-title">Players Attendance</h2>
            <p>
              {selectedBatch
                ? `${players.length} ${players.length === 1 ? "player" : "players"} in the selected batch`
                : "Select a batch to load players."}
            </p>
          </div>

          {selectedBatch && players.length > 0 && !isEditMode ? (
            <div className="attendance-bulk-actions">
              <button
                type="button"
                className="attendance-secondary-button"
                onClick={() => setPlayers((current) => current.map((player) => ({ ...player, status: "present" })))}
              >
                ✓ Mark all present
              </button>
              <button
                type="button"
                className="attendance-secondary-button attendance-secondary-button-muted"
                onClick={() => setPlayers((current) => current.map((player) => ({ ...player, status: "absent" })))}
              >
                Mark all absent
              </button>
            </div>
          ) : null}
        </div>

        <div className="attendance-table-wrap">
          <table className="attendance-table">
            <caption className="sr-only">Coach attendance roster</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Player Name</th>
                <th scope="col">Present</th>
                <th scope="col">Absent</th>
              </tr>
            </thead>
            <tbody>
              {players.length > 0 ? (
                players.map((player, index) => (
                  <tr key={player.id} className={player.status ? `attendance-row-${player.status}` : "attendance-row-unmarked"}>
                    <td className="attendance-player-number">{index + 1}</td>
                    <td className="attendance-player-name">
                      <strong>{player.full_name || "-"}</strong>
                      {!player.status ? <span>Not marked</span> : null}
                    </td>
                    <td>
                      <label className={`attendance-choice ${player.status === "present" ? "attendance-choice-selected attendance-choice-present" : ""}`}>
                        <input
                          type="radio"
                          name={`attendance-${player.id}`}
                          checked={player.status === "present"}
                          onChange={() => handleAttendanceChange(player.id, "present")}
                          disabled={isEditMode}
                        />
                        <span>Present</span>
                      </label>
                    </td>
                    <td>
                      <label className={`attendance-choice ${player.status === "absent" ? "attendance-choice-selected attendance-choice-absent" : ""}`}>
                        <input
                          type="radio"
                          name={`attendance-${player.id}`}
                          checked={player.status === "absent"}
                          onChange={() => handleAttendanceChange(player.id, "absent")}
                          disabled={isEditMode}
                        />
                        <span>Absent</span>
                      </label>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="attendance-empty-state" colSpan="4">
                    <strong>{selectedBatch ? "No players found" : "Select a batch to begin"}</strong>
                    <span>{selectedBatch ? "No active players are available in this batch." : "Choose one of your assigned batches to load the attendance roster."}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedBatch && players.length > 0 && !isEditMode ? (
        <div className="attendance-action-bar">
          <div className="attendance-action-summary">
            <strong>{players.length} players</strong>
            <span>
              {players.filter((player) => player.status === "present").length} present ·{" "}
              {players.filter((player) => player.status === "absent").length} absent
            </span>
          </div>
          <div className="attendance-action-buttons">
            <button
              type="button"
              className="attendance-secondary-button"
              onClick={() => setPlayers((current) => current.map((player) => ({ ...player, status: "" })))}
            >
              Reset
            </button>
            <button className="attendance-save-button" type="button" onClick={saveAttendance}>
              Save Attendance
            </button>
          </div>
        </div>
      ) : null}
    </div>
  </Layout>
);
}
export default CoachAttendance;