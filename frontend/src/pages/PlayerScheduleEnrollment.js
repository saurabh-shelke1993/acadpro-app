import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { getLoggedInUser, isAcademyOwner, isSuperAdmin } from "../utils/auth";
import {
  getAccessibleAcademies,
  getAccessibleCenters,
  getAccessibleBatches
} from "../utils/dataScope";
import { supabase } from "../supabaseClient";
import {
  deactivatePlayerScheduleEnrollment,
  enrollPlayerInSchedule,
  getActiveSchedulesForBatch,
  getDayName,
  getPlayerScheduleEnrollments,
  updatePlayerScheduleEnrollment
} from "../services/playerScheduleService";
import "./PlayerScheduleEnrollment.css";

const today = () => new Date().toISOString().split("T")[0];

const PlayerScheduleEnrollment = () => {
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [filters, setFilters] = useState({ academyId: "", centerId: "", batchId: "", playerId: "" });
  const [form, setForm] = useState({ playerId: "", scheduleId: "", enrolledFrom: today(), enrolledUntil: "" });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canManage = isSuperAdmin(user) || isAcademyOwner(user);

  const loadReferences = useCallback(async () => {
    if (!user) return;

    const [academyData, centerData, batchData] = await Promise.all([
      getAccessibleAcademies(user),
      getAccessibleCenters(user),
      getAccessibleBatches(user)
    ]);

    setAcademies(academyData || []);
    setCenters(centerData || []);
    setBatches(batchData || []);

    let query = supabase
      .from("players")
      .select("id, full_name, academy_id, center_id, batch_id, is_active")
      .eq("is_active", true)
      .order("full_name");

    if (isAcademyOwner(user)) query = query.eq("academy_id", user.academy_id);

    const { data, error: playerError } = await query;
    if (playerError) throw playerError;
    setPlayers(data || []);
  }, [user]);

  const loadEnrollments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    try {
      const data = await getPlayerScheduleEnrollments(filters);
      setEnrollments(data);
    } catch (err) {
      console.error("Failed to load player schedule enrollments:", err);
      setEnrollments([]);
      setError(err.message || "Unable to load player schedule enrollments.");
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useEffect(() => {
    getLoggedInUser().then(setUser);
  }, []);

  useEffect(() => {
    if (user) loadReferences().catch((err) => setError(err.message || "Unable to load reference data."));
  }, [user, loadReferences]);

  useEffect(() => {
    if (user) loadEnrollments();
  }, [user, loadEnrollments]);

  const visibleCenters = useMemo(
    () => centers.filter((center) => !filters.academyId || center.academy_id === filters.academyId),
    [centers, filters.academyId]
  );

  const visibleBatches = useMemo(
    () => batches.filter((batch) =>
      (!filters.academyId || batch.academy_id === filters.academyId) &&
      (!filters.centerId || batch.center_id === filters.centerId)
    ),
    [batches, filters.academyId, filters.centerId]
  );

  const visiblePlayers = useMemo(
    () => players.filter((player) =>
      (!filters.academyId || player.academy_id === filters.academyId) &&
      (!filters.centerId || player.center_id === filters.centerId) &&
      (!filters.batchId || player.batch_id === filters.batchId)
    ),
    [players, filters.academyId, filters.centerId, filters.batchId]
  );

  const formPlayers = useMemo(
    () => players.filter((player) =>
      (!form.academyId || player.academy_id === form.academyId) &&
      (!form.centerId || player.center_id === form.centerId) &&
      (!form.batchId || player.batch_id === form.batchId)
    ),
    [players, form.academyId, form.centerId, form.batchId]
  );

  const formCenters = useMemo(
    () => centers.filter((center) => !form.academyId || center.academy_id === form.academyId),
    [centers, form.academyId]
  );

  const formBatches = useMemo(
    () => batches.filter((batch) =>
      (!form.academyId || batch.academy_id === form.academyId) &&
      (!form.centerId || batch.center_id === form.centerId)
    ),
    [batches, form.academyId, form.centerId]
  );

  const handleFilterChange = (field, value) => {
    setFilters((current) => {
      const next = { ...current, [field]: value };
      if (field === "academyId") { next.centerId = ""; next.batchId = ""; next.playerId = ""; }
      if (field === "centerId") { next.batchId = ""; next.playerId = ""; }
      if (field === "batchId") next.playerId = "";
      return next;
    });
  };

  const resetForm = () => {
    setForm({
      academyId: isSuperAdmin(user) ? "" : user?.academy_id || "",
      centerId: "",
      batchId: "",
      playerId: "",
      scheduleId: "",
      enrolledFrom: today(),
      enrolledUntil: ""
    });
    setEditingId(null);
    setSchedules([]);
  };

  const handlePlayerChange = async (playerId) => {
    const player = players.find((item) => item.id === playerId);
    const batchId = player?.batch_id || "";
    const centerId = player?.center_id || "";

    setForm((current) => ({ ...current, playerId, batchId, centerId, scheduleId: "" }));

    if (!batchId) {
      setSchedules([]);
      return;
    }

    try {
      setError("");
      setSchedules(await getActiveSchedulesForBatch(batchId));
    } catch (err) {
      setError(err.message || "Unable to load player schedules.");
      setSchedules([]);
    }
  };

  const handleSave = async () => {
    if (!canManage) return;

    if (!form.playerId || !form.scheduleId || !form.enrolledFrom) {
      setError("Player, schedule, and enrollment start date are required.");
      return;
    }

    if (form.enrolledUntil && form.enrolledUntil < form.enrolledFrom) {
      setError("Enrollment end date cannot be before start date.");
      return;
    }

    const player = players.find((item) => item.id === form.playerId);
    if (!player) {
      setError("Selected player could not be found.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        academyId: player.academy_id,
        playerId: form.playerId,
        batchScheduleId: form.scheduleId,
        enrolledFrom: form.enrolledFrom,
        enrolledUntil: form.enrolledUntil || null
      };

      if (editingId) {
        await updatePlayerScheduleEnrollment(editingId, {
          enrolledFrom: form.enrolledFrom,
          enrolledUntil: form.enrolledUntil || null
        });
      } else {
        await enrollPlayerInSchedule(payload);
      }

      resetForm();
      await loadEnrollments();
    } catch (err) {
      console.error("Failed to save player schedule enrollment:", err);
      setError(err.message || "Unable to save enrollment.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (enrollment) => {
    setEditingId(enrollment.id);
    setError("");
    setForm({
      academyId: enrollment.academy_id,
      centerId: enrollment.players?.center_id || enrollment.batch_schedules?.center_id || "",
      batchId: enrollment.players?.batch_id || enrollment.batch_schedules?.batch_id || "",
      playerId: enrollment.player_id,
      scheduleId: enrollment.batch_schedule_id,
      enrolledFrom: enrollment.enrolled_from,
      enrolledUntil: enrollment.enrolled_until || ""
    });
    setSchedules([]);
  };

  const handleDeactivate = async (enrollment) => {
    if (!canManage) return;

    if (!window.confirm(`Remove ${enrollment.players?.full_name || "this player"} from this schedule?`)) return;

    setError("");
    try {
      await deactivatePlayerScheduleEnrollment(enrollment.id);
      if (editingId === enrollment.id) resetForm();
      await loadEnrollments();
    } catch (err) {
      setError(err.message || "Unable to deactivate enrollment.");
    }
  };

  const filterPlayers = visiblePlayers;

  return (
    <Layout>
      <div className="player-schedule-page">
        <section className="player-schedule-header">
          <div>
            <span className="player-schedule-eyebrow">Academy operations</span>
            <h1>Player Schedule Enrollment</h1>
            <p>Assign players to the specific recurring sessions they attend.</p>
          </div>
          <div className="player-schedule-count">
            <strong>{enrollments.length}</strong>
            <span>active enrollments</span>
          </div>
        </section>

        {error ? <div className="player-schedule-alert" role="alert">{error}</div> : null}

        <section className="player-schedule-card">
          <div className="player-schedule-heading">
            <div>
              <span className="player-schedule-kicker">Directory filters</span>
              <h2>Find enrollments</h2>
            </div>
          </div>
          <div className="player-schedule-grid">
            {isSuperAdmin(user) ? (
              <div className="player-schedule-field">
                <label>Academy</label>
                <select value={filters.academyId} onChange={(e) => handleFilterChange("academyId", e.target.value)}>
                  <option value="">All academies</option>
                  {academies.map((item) => <option key={item.id} value={item.id}>{item.academy_name}</option>)}
                </select>
              </div>
            ) : null}
            <div className="player-schedule-field">
              <label>Center</label>
              <select value={filters.centerId} onChange={(e) => handleFilterChange("centerId", e.target.value)}>
                <option value="">All centers</option>
                {visibleCenters.map((item) => <option key={item.id} value={item.id}>{item.center_name}</option>)}
              </select>
            </div>
            <div className="player-schedule-field">
              <label>Batch</label>
              <select value={filters.batchId} onChange={(e) => handleFilterChange("batchId", e.target.value)}>
                <option value="">All batches</option>
                {visibleBatches.map((item) => <option key={item.id} value={item.id}>{item.batch_name}</option>)}
              </select>
            </div>
            <div className="player-schedule-field">
              <label>Player</label>
              <select value={filters.playerId} onChange={(e) => handleFilterChange("playerId", e.target.value)}>
                <option value="">All players</option>
                {filterPlayers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
              </select>
            </div>
          </div>
        </section>

        {canManage ? (
          <section className="player-schedule-card">
            <div className="player-schedule-heading">
              <div>
                <span className="player-schedule-kicker">{editingId ? "Edit enrollment" : "New enrollment"}</span>
                <h2>{editingId ? "Update player schedule dates" : "Enroll player in a session"}</h2>
              </div>
            </div>

            <div className="player-schedule-form-grid">
              {isSuperAdmin(user) ? (
                <div className="player-schedule-field">
                  <label>Academy *</label>
                  <select
                    value={form.academyId}
                    disabled={Boolean(editingId)}
                    onChange={(e) => setForm((current) => ({ ...current, academyId: e.target.value, centerId: "", batchId: "", playerId: "", scheduleId: "" }))}
                  >
                    <option value="">Select academy</option>
                    {academies.map((item) => <option key={item.id} value={item.id}>{item.academy_name}</option>)}
                  </select>
                </div>
              ) : null}

              <div className="player-schedule-field">
                <label>Center *</label>
                <select
                  value={form.centerId}
                  disabled={Boolean(editingId)}
                  onChange={(e) => setForm((current) => ({ ...current, centerId: e.target.value, batchId: "", playerId: "", scheduleId: "" }))}
                >
                  <option value="">Select center</option>
                  {formCenters.map((item) => <option key={item.id} value={item.id}>{item.center_name}</option>)}
                </select>
              </div>

              <div className="player-schedule-field">
                <label>Batch *</label>
                <select
                  value={form.batchId}
                  disabled={Boolean(editingId)}
                  onChange={(e) => setForm((current) => ({ ...current, batchId: e.target.value, playerId: "", scheduleId: "" }))}
                >
                  <option value="">Select batch</option>
                  {formBatches.map((item) => <option key={item.id} value={item.id}>{item.batch_name}</option>)}
                </select>
              </div>

              <div className="player-schedule-field player-schedule-field-wide">
                <label>Player *</label>
                <select
                  value={form.playerId}
                  disabled={Boolean(editingId)}
                  onChange={(e) => handlePlayerChange(e.target.value)}
                >
                  <option value="">Select player</option>
                  {formPlayers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                </select>
              </div>

              <div className="player-schedule-field player-schedule-field-wide">
                <label>Recurring session *</label>
                <select
                  value={form.scheduleId}
                  disabled={Boolean(editingId) || !form.playerId}
                  onChange={(e) => setForm((current) => ({ ...current, scheduleId: e.target.value }))}
                >
                  <option value="">Select session</option>
                  {schedules.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getDayName(item.day_of_week)} · {String(item.start_time).slice(0,5)}–{String(item.end_time).slice(0,5)}
                      {item.session_label ? ` · ${item.session_label}` : ""}
                      {item.centers?.center_name ? ` · ${item.centers.center_name}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="player-schedule-field">
                <label>Enrolled from *</label>
                <input type="date" value={form.enrolledFrom} disabled={Boolean(editingId)} onChange={(e) => setForm((current) => ({ ...current, enrolledFrom: e.target.value }))} />
              </div>

              <div className="player-schedule-field">
                <label>Enrolled until</label>
                <input type="date" value={form.enrolledUntil} onChange={(e) => setForm((current) => ({ ...current, enrolledUntil: e.target.value }))} />
              </div>
            </div>

            <div className="player-schedule-actions">
              <button className="player-schedule-primary" type="button" disabled={saving} onClick={handleSave}>
                {saving ? "Saving..." : editingId ? "Update Enrollment" : "Enroll Player"}
              </button>
              {editingId ? <button type="button" disabled={saving} onClick={resetForm}>Cancel</button> : null}
            </div>
          </section>
        ) : null}

        <section className="player-schedule-card player-schedule-results">
          <div className="player-schedule-results-heading">
            <div>
              <span className="player-schedule-kicker">Active enrollment directory</span>
              <h2>Player Sessions</h2>
            </div>
            <span>{loading ? "Loading..." : `${enrollments.length} enrollment${enrollments.length === 1 ? "" : "s"}`}</span>
          </div>
          <div className="player-schedule-table-wrap">
            <table className="player-schedule-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Center</th>
                  <th>Batch</th>
                  <th>Session</th>
                  <th>Enrollment</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {!loading && enrollments.length === 0 ? (
                  <tr><td colSpan={canManage ? 6 : 5} className="player-schedule-empty"><strong>No active player schedule enrollments found.</strong><span>Enroll players into their specific recurring sessions above.</span></td></tr>
                ) : enrollments.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.players?.full_name || "—"}</strong></td>
                    <td>{item.batch_schedules?.centers?.center_name || "—"}</td>
                    <td>{item.batch_schedules?.batches?.batch_name || "—"}</td>
                    <td>
                      {getDayName(item.batch_schedules?.day_of_week)} · {String(item.batch_schedules?.start_time || "").slice(0,5)}–{String(item.batch_schedules?.end_time || "").slice(0,5)}
                      {item.batch_schedules?.session_label ? <span className="player-schedule-muted"> · {item.batch_schedules.session_label}</span> : null}
                    </td>
                    <td>{item.enrolled_from} → {item.enrolled_until || "Open"}</td>
                    {canManage ? (
                      <td>
                        <div className="player-schedule-row-actions">
                          <button type="button" onClick={() => handleEdit(item)}>Edit</button>
                          <button type="button" className="player-schedule-danger" onClick={() => handleDeactivate(item)}>Remove</button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default PlayerScheduleEnrollment;
