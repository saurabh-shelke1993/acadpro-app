import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import AttendanceWorkspaceTabs from "../components/AttendanceWorkspaceTabs";
import AttendanceRosterSummary from "../components/AttendanceRosterSummary";
import { countAttendance, formatAttendanceSessionLabel } from "../utils/attendancePresentation";
import { canCoachEditAttendanceDate, utcAttendanceToday } from "../utils/attendanceEditWindow";
import "./Attendance.css";
import { supabase } from "../supabaseClient";
import {
  getCoachAttendanceSessions,
  getEnrolledPlayersForSchedule,
} from "../services/scheduleViewService";

function CoachAttendance() {
  const [searchParams] = useSearchParams();
  const initialScheduleId = searchParams.get("scheduleId") || "";
  const initialDate = searchParams.get("date") || "";
  const initialBatchId = searchParams.get("batchId") || "";
  const user = useMemo(() => JSON.parse(localStorage.getItem("acadpro_user")), []);

  const [sessions, setSessions] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(initialScheduleId);
  const [attendanceDate, setAttendanceDate] = useState(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return initialDate;
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  });
  const [players, setPlayers] = useState([]);
  const loadedStatusRef = useRef({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSessions = useCallback(async () => {
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
  }, [user, attendanceDate, initialBatchId]);

  const loadPlayers = useCallback(async () => {
    // Do not query a schedule until the server-scoped assignment list confirms it.
    // This also prevents a tampered scheduleId deep link from triggering a roster read.
    if (!selectedSchedule || !sessions.some((session) => session.id === selectedSchedule)) {
      setPlayers([]);
      loadedStatusRef.current = {};
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
      loadedStatusRef.current = Object.fromEntries(nextPlayers.map((player) => [player.id, player.status]));
      setIsEditMode((data || []).length > 0);
      setMessage((data || []).length > 0
        ? "Attendance already exists for this session and date. Review or edit the recorded attendance."
        : "");
    } catch (err) {
      console.error(err);
      setPlayers([]);
      loadedStatusRef.current = {};
      setIsEditMode(false);
      setError(err.message || "Unable to load session attendance.");
    } finally {
      setLoading(false);
    }
  }, [selectedSchedule, attendanceDate, sessions]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const handleAttendanceChange = (playerId, status) => {
    if (saving || loading || (isEditMode && !canCoachEditAttendanceDate(attendanceDate))) return;
    setPlayers((current) =>
      current.map((player) => player.id === playerId ? { ...player, status } : player)
    );
    setMessage("");
    setError("");
  };

  const markAll = (status) => {
    if (saving || loading || !players.length || (isEditMode && !canCoachEditAttendanceDate(attendanceDate))) return;
    setPlayers((current) => current.map((player) => ({ ...player, status })));
    setMessage("");
    setError("");
  };

  // Reset only local draft changes. For an existing session restore the values
  // fetched from the database; for a new session clear all unsaved marks.
  const resetAttendance = () => {
    if (saving || loading || (isEditMode && !canCoachEditAttendanceDate(attendanceDate))) return;
    setPlayers((current) => current.map((player) => ({
      ...player,
      status: isEditMode ? loadedStatusRef.current[player.id] || "" : "",
    })));
    setMessage("");
    setError("");
  };

  const saveAttendance = async () => {
    if (!selectedSchedule || !players.length || saving) return;
    if (!sessions.some((session) => session.id === selectedSchedule)) {
      setError("Select an assigned training session before saving.");
      return;
    }
    if (isEditMode && !canCoachEditAttendanceDate(attendanceDate)) {
      setError("Older attendance is read-only. Coaches may edit only the last 7 calendar dates.");
      return;
    }
    if (attendanceDate > utcAttendanceToday()) {
      setError("Attendance cannot be marked for a future date. Select today or an earlier date.");
      return;
    }

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
        .select("id, player_id")
        .eq("batch_schedule_id", selectedSchedule)
        .eq("attendance_date", attendanceDate)
        .eq("is_deleted", false);

      if (existingError) throw existingError;
      if (existing?.length) {
        if (!canCoachEditAttendanceDate(attendanceDate)) {
          throw new Error("Older attendance is read-only. Coaches may edit only the last 7 calendar dates.");
        }
        const existingByPlayer = new Map(existing.map((row) => [row.player_id, row]));
        const updateResults = await Promise.all(
          players
            .filter((player) => existingByPlayer.has(player.id))
            .map((player) =>
              supabase
                .from("attendance")
                .update({ status: player.status })
                .eq("id", existingByPlayer.get(player.id).id)
                .select("id")
            )
        );
        const updateError = updateResults.find((result) => result.error)?.error;
        if (updateError) throw updateError;
        if (updateResults.some((result) => !Array.isArray(result.data) || result.data.length !== 1)) {
          throw new Error("Some attendance updates were not permitted. Refresh and review this session.");
        }
        loadedStatusRef.current = Object.fromEntries(players.map((player) => [player.id, player.status]));
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

      loadedStatusRef.current = Object.fromEntries(players.map((player) => [player.id, player.status]));
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
  const readOnlyExisting = isEditMode && !canCoachEditAttendanceDate(attendanceDate);
  const attendanceSummary = countAttendance(players, (player) => player.status);
  const canSaveAttendance = !!selectedSchedule && !!selectedSession && players.length > 0 &&
    !saving && !loading && !readOnlyExisting && attendanceSummary.unmarked === 0;

  return (
    <Layout>
      <div className="attendance-page">
        <AttendanceWorkspaceTabs role={user?.role} />
        <section className="attendance-workspace-card" aria-labelledby="coach-attendance-title">
          <div className="attendance-workspace-heading">
            <div>
              <span className="attendance-page-eyebrow">Daily operations</span>
              <h1 id="coach-attendance-title">Mark Attendance</h1>
              <p>Select one of your assigned sessions, then mark every player.</p>
            </div>
            {selectedSchedule ? (
              <span className={isEditMode ? "attendance-status-badge attendance-status-existing" : "attendance-status-badge"}>
                {readOnlyExisting ? "Read-only" : isEditMode ? "Attendance recorded" : "Ready to mark"}
              </span>
            ) : null}
          </div>

          <div className="attendance-filter-card attendance-coach-filter-card attendance-am6-coach-filters">
            <div className="attendance-filter-field">
              <label htmlFor="coach-attendance-date">Date</label>
              <input
                id="coach-attendance-date"
                type="date"
                max={utcAttendanceToday()}
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
                    {formatAttendanceSessionLabel(session)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSession ? (
            <div className="attendance-inline-message attendance-inline-success" role="status">
              <strong>Session</strong>
              <span>{formatAttendanceSessionLabel(selectedSession)} · {selectedSession.centers?.center_name || "Center"} · {selectedSession.batches?.batch_name || "Batch"}</span>
            </div>
          ) : (
            <div className="attendance-inline-message" role="status">
              <strong>!</strong>
              <span>No assigned session is available for the selected date.</span>
            </div>
          )}

          {readOnlyExisting && (
            <div className="attendance-inline-message" role="status">
              <strong>Read-only</strong>
              <span>Coaches can update recorded attendance only within the last 7 calendar dates. Older sessions remain available for review.</span>
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
                <button type="button" className="attendance-secondary-button" onClick={() => markAll("present")} disabled={saving || loading || readOnlyExisting}>✓ Mark all present</button>
                <button type="button" className="attendance-secondary-button attendance-secondary-button-muted" onClick={() => markAll("absent")} disabled={saving || loading || readOnlyExisting}>Mark all absent</button>
              </div>
            ) : null}
          </div>

          {selectedSchedule && <AttendanceRosterSummary totals={attendanceSummary} />}

          <div className="attendance-table-wrap">
            <table className="attendance-table">
              <caption className="sr-only">Coach session attendance roster</caption>
              <thead><tr><th scope="col">#</th><th scope="col">Player Name</th><th scope="col">P</th><th scope="col">A</th></tr></thead>
              <tbody>
                {players.length ? players.map((player, index) => (
                  <tr key={player.id} className={player.status ? `attendance-row-${player.status}` : "attendance-row-unmarked"}>
                    <td className="attendance-player-number">{index + 1}</td>
                    <td className="attendance-player-name">
                      <strong>{player.full_name || "—"}</strong>
                      <span className={`attendance-row-status attendance-row-status-${player.status || "unmarked"}`}>
                        {player.status === "present" ? "Present" : player.status === "absent" ? "Absent" : "Not marked"}
                      </span>
                    </td>
                    <td>
                      <label className={`attendance-choice attendance-choice-present ${player.status === "present" ? "attendance-choice-selected" : ""}`}>
                        <input type="radio" name={`attendance-${player.id}`} checked={player.status === "present"} onChange={() => handleAttendanceChange(player.id, "present")} aria-label={`Mark ${player.full_name || "player"} present`} disabled={saving || loading || readOnlyExisting} />
                        <span className="attendance-choice-label">P</span>
                      </label>
                    </td>
                    <td>
                      <label className={`attendance-choice attendance-choice-absent ${player.status === "absent" ? "attendance-choice-selected" : ""}`}>
                        <input type="radio" name={`attendance-${player.id}`} checked={player.status === "absent"} onChange={() => handleAttendanceChange(player.id, "absent")} aria-label={`Mark ${player.full_name || "player"} absent`} disabled={saving || loading || readOnlyExisting} />
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

          {selectedSchedule && players.length > 0 ? (
            <div className="attendance-action-bar attendance-coach-action-bar">
              <div className="attendance-action-summary" role="status">
                <strong>{readOnlyExisting ? "Read-only session" : attendanceSummary.unmarked ? `${attendanceSummary.unmarked} unmarked` : "Ready to save"}</strong>
                <span>{readOnlyExisting ? "Past attendance remains available for review." : attendanceSummary.unmarked ? "Mark every player before saving." : "All players marked. Save to record attendance."}</span>
              </div>
              <div className="attendance-action-buttons">
                <button type="button" className="attendance-secondary-button" onClick={resetAttendance} disabled={saving || loading || readOnlyExisting}>Reset</button>
                <button type="button" className="attendance-save-button" onClick={saveAttendance} disabled={!canSaveAttendance}>
                  {saving ? "Saving…" : isEditMode ? "Update Attendance" : "Save Attendance"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </Layout>
  );
}

export default CoachAttendance;
