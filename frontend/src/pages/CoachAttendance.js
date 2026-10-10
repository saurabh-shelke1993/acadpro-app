import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import "./Attendance.css";
import { supabase } from "../supabaseClient";
import {
  getCoachAttendanceSessions,
  getEnrolledPlayersForSchedule,
  formatScheduleLabel,
} from "../services/scheduleViewService";

function CoachAttendance() {
  const [searchParams] = useSearchParams();
  const initialScheduleId = searchParams.get("scheduleId") || "";
  const initialBatchId = searchParams.get("batchId") || "";
  const user = JSON.parse(localStorage.getItem("acadpro_user"));

  const [sessions, setSessions] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(initialScheduleId);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [players, setPlayers] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getCoachAttendanceSessions(user, attendanceDate);
      const filtered = initialBatchId
        ? data.filter((session) => session.batch_id === initialBatchId)
        : data;
      setSessions(filtered);
      setSelectedSchedule((current) =>
        filtered.some((session) => session.id === current) ? current : filtered[0]?.id || ""
      );
    } catch (err) {
      console.error(err);
      setSessions([]);
      setSelectedSchedule("");
      setError(err.message || "Unable to load your assigned sessions.");
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    if (!selectedSchedule) {
      setPlayers([]);
      setIsEditMode(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const enrolledPlayers = await getEnrolledPlayersForSchedule(selectedSchedule, attendanceDate);

      const { data, error: attendanceError } = await supabase
        .from("attendance")
        .select("id, player_id, status")
        .eq("batch_schedule_id", selectedSchedule)
        .eq("attendance_date", attendanceDate)
        .eq("is_deleted", false);

      if (attendanceError) throw attendanceError;

      const existingByPlayer = new Map((data || []).map((record) => [record.player_id, record.status]));
      const nextPlayers = enrolledPlayers.map((player) => ({
        ...player,
        status: existingByPlayer.get(player.id) || "",
      }));

      setPlayers(nextPlayers);
      setIsEditMode((data || []).length > 0);
      setMessage((data || []).length > 0
        ? "Attendance already exists for this session and date. Review or edit the recorded attendance."
        : "");
    } catch (err) {
      console.error(err);
      setPlayers([]);
      setIsEditMode(false);
      setError(err.message || "Unable to load session attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [attendanceDate]);

  useEffect(() => {
    loadPlayers();
  }, [selectedSchedule, attendanceDate]);

  const handleAttendanceChange = (playerId, status) => {
    setPlayers((current) =>
      current.map((player) => player.id === playerId ? { ...player, status } : player)
    );
    setMessage("");
    setError("");
  };

  const markAll = (status) => {
    setPlayers((current) => current.map((player) => ({ ...player, status })));
    setMessage("");
    setError("");
  };

  const saveAttendance = async () => {
    if (!selectedSchedule || !players.length || saving) return;

    const unmarked = players.filter((player) => !player.status);
    if (unmarked.length) {
      setError(`Please mark attendance for all ${unmarked.length} unmarked players before saving.`);
      return;
    }

    try {
      setSaving(true);
      setError("");
      const { data: existing, error: existingError } = await supabase
        .from("attendance")
        .select("id")
        .eq("batch_schedule_id", selectedSchedule)
        .eq("attendance_date", attendanceDate)
        .eq("is_deleted", false);

      if (existingError) throw existingError;
      if (existing?.length) {
        const existingByPlayer = new Map(existing.map((row) => [row.player_id, row]));
        await Promise.all(
          players
            .filter((player) => existingByPlayer.has(player.id))
            .map((player) =>
              supabase
                .from("attendance")
                .update({ status: player.status })
                .eq("id", existingByPlayer.get(player.id).id)
            )
        );
        setIsEditMode(true);
        setMessage("Attendance updated successfully.");
        return;
      }

      const session = sessions.find((item) => item.id === selectedSchedule);
      const rows = players.map((player) => ({
        academy_id: user.academy_id,
        player_id: player.id,
        batch_id: session.batch_id,
        center_id: session.center_id,
        batch_schedule_id: selectedSchedule,
        attendance_date: attendanceDate,
        status: player.status,
        marked_by: user.id,
      }));

      const { error: insertError } = await supabase.from("attendance").insert(rows);
      if (insertError) throw insertError;

      setIsEditMode(true);
      setMessage(`Attendance saved successfully · ${players.filter((p) => p.status === "present").length} present · ${players.filter((p) => p.status === "absent").length} absent`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const selectedSession = sessions.find((session) => session.id === selectedSchedule);

  return (
    <Layout>
      <div className="attendance-page">
        <section className="attendance-workspace-card" aria-labelledby="coach-attendance-title">
          <div className="attendance-workspace-heading">
            <div>
              <span className="attendance-page-eyebrow">Daily operations</span>
              <h1 id="coach-attendance-title">Coach Attendance</h1>
              <p>Select one of your assigned recurring sessions, then mark the enrolled players.</p>
            </div>
            {selectedSchedule ? (
              <span className={isEditMode ? "attendance-status-badge attendance-status-existing" : "attendance-status-badge"}>
                {isEditMode ? "Attendance recorded" : "Ready to mark"}
              </span>
            ) : null}
          </div>

          <div className="attendance-filter-card attendance-coach-filter-card">
            <div className="attendance-filter-field">
              <label htmlFor="coach-attendance-date">Date</label>
              <input
                id="coach-attendance-date"
                type="date"
                value={attendanceDate}
                onChange={(e) => {
                  setAttendanceDate(e.target.value);
                  setSelectedSchedule("");
                  setMessage("");
                  setError("");
                }}
              />
            </div>
            <div className="attendance-filter-field">
              <label htmlFor="coach-attendance-session">Assigned Session</label>
              <select
                id="coach-attendance-session"
                value={selectedSchedule}
                onChange={(e) => {
                  setSelectedSchedule(e.target.value);
                  setMessage("");
                  setError("");
                }}
                disabled={loading || sessions.length === 0}
              >
                <option value="">Select Session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {formatScheduleLabel(session)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSession ? (
            <div className="attendance-inline-message attendance-inline-success" role="status">
              <strong>Session</strong>
              <span>{formatScheduleLabel(selectedSession)} · {selectedSession.centers?.center_name || "Center"} · {selectedSession.batches?.batch_name || "Batch"}</span>
            </div>
          ) : (
            <div className="attendance-inline-message" role="status">
              <strong>!</strong>
              <span>No assigned session is available for the selected date.</span>
            </div>
          )}

          {message ? (
            <div className="attendance-inline-message attendance-inline-success" role="status">
              <strong>✓</strong><span>{message}</span>
            </div>
          ) : null}
          {error ? (
            <div className="attendance-inline-message attendance-inline-error" role="alert">
              <strong>!</strong><span>{error}</span>
            </div>
          ) : null}
        </section>

        <section className="attendance-list-section" aria-labelledby="coach-players-attendance-title">
          <div className="attendance-list-header">
            <div>
              <span className="attendance-section-eyebrow">Session roster</span>
              <h2 id="coach-players-attendance-title">Players Attendance</h2>
              <p>{selectedSchedule ? `${players.length} ${players.length === 1 ? "player" : "players"} enrolled in this session` : "Select a session to load enrolled players."}</p>
            </div>

            {selectedSchedule && players.length > 0 ? (
              <div className="attendance-bulk-actions">
                <button type="button" className="attendance-secondary-button" onClick={() => markAll("present")}>✓ Mark all present</button>
                <button type="button" className="attendance-secondary-button attendance-secondary-button-muted" onClick={() => markAll("absent")}>Mark all absent</button>
              </div>
            ) : null}
          </div>

          <div className="attendance-summary attendance-coach-summary" aria-label="Attendance summary">
            <div className="attendance-summary-item"><span>Total players</span><strong>{players.length}</strong></div>
            <div className="attendance-summary-item attendance-summary-present"><span>Present</span><strong>{players.filter((p) => p.status === "present").length}</strong></div>
            <div className="attendance-summary-item attendance-summary-absent"><span>Absent</span><strong>{players.filter((p) => p.status === "absent").length}</strong></div>
            <div className="attendance-summary-item attendance-summary-unmarked"><span>Unmarked</span><strong>{players.filter((p) => !p.status).length}</strong></div>
          </div>

          <div className="attendance-table-wrap">
            <table className="attendance-table">
              <caption className="sr-only">Coach session attendance roster</caption>
              <thead><tr><th scope="col">#</th><th scope="col">Player Name</th><th scope="col">P</th><th scope="col">A</th></tr></thead>
              <tbody>
                {players.length ? players.map((player, index) => (
                  <tr key={player.id} className={player.status ? `attendance-row-${player.status}` : "attendance-row-unmarked"}>
                    <td className="attendance-player-number">{index + 1}</td>
                    <td className="attendance-player-name"><strong>{player.full_name || "—"}</strong>{!player.status ? <span>Not marked</span> : null}</td>
                    <td>
                      <label className={`attendance-choice attendance-choice-present ${player.status === "present" ? "attendance-choice-selected" : ""}`}>
                        <input type="radio" name={`attendance-${player.id}`} checked={player.status === "present"} onChange={() => handleAttendanceChange(player.id, "present")} />
                        <span className="attendance-choice-label">P</span>
                      </label>
                    </td>
                    <td>
                      <label className={`attendance-choice attendance-choice-absent ${player.status === "absent" ? "attendance-choice-selected" : ""}`}>
                        <input type="radio" name={`attendance-${player.id}`} checked={player.status === "absent"} onChange={() => handleAttendanceChange(player.id, "absent")} />
                        <span className="attendance-choice-label">A</span>
                      </label>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="attendance-empty-cell">{loading ? "Loading session roster…" : "No players are enrolled in this session for the selected date."}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedSchedule && players.length > 0 && !isEditMode ? (
            <div className="attendance-save-bar">
              <button type="button" className="attendance-primary-button" onClick={saveAttendance} disabled={saving}>
                {saving ? "Saving…" : "Save Attendance"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </Layout>
  );
}

export default CoachAttendance;
