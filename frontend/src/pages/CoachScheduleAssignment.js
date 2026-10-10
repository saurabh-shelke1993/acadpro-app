import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import "./CoachScheduleAssignment.css";
import { getCurrentUser, isSuperAdmin } from "../utils/auth";
import { isAcademyOwner } from "../utils/roles";
import {
  getCoachScheduleAssignments,
  assignCoachToSchedule,
  updateCoachScheduleAssignment,
  deactivateCoachScheduleAssignment,
  getActiveCoachesForAcademy,
  getActiveSchedules,
  getDayName
} from "../services/coachScheduleAssignmentService";
import { supabase } from "../supabaseClient";

const formatTime = (value) => {
  if (!value) return "—";
  const [h, m] = String(value).split(":");
  const hour = Number(h);
  return Number.isNaN(hour) ? value : `${hour % 12 || 12}:${m || "00"} ${hour >= 12 ? "PM" : "AM"}`;
};

function CoachScheduleAssignment() {
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [academyId, setAcademyId] = useState("");
  const [centerId, setCenterId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [assignedFrom, setAssignedFrom] = useState(new Date().toISOString().slice(0, 10));
  const [assignedUntil, setAssignedUntil] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [filters, setFilters] = useState({ schedule: "", coach: "" });

  const canManage = isSuperAdmin(user) || isAcademyOwner(user);

  useEffect(() => { getCurrentUser().then(setUser); }, []);

  useEffect(() => {
    if (!user) return;
    if (isSuperAdmin(user)) {
      supabase.from("academies").select("id, academy_name").eq("is_active", true).order("academy_name")
        .then(({ data, error }) => { if (!error) { setAcademies(data || []); } });
    } else if (user.academy_id) {
      setAcademyId(user.academy_id);
      supabase.from("academies").select("id, academy_name").eq("id", user.academy_id).maybeSingle()
        .then(({ data }) => setAcademies(data ? [data] : []));
    }
  }, [user]);

  const loadReferenceData = async () => {
    if (!academyId) return;
    setLoading(true); setNotice(null);
    try {
      const [coachData, centerResult, batchResult, scheduleData, assignmentData] = await Promise.all([
        getActiveCoachesForAcademy(academyId),
        supabase.from("centers").select("id, center_name").eq("academy_id", academyId).eq("is_active", true).order("center_name"),
        supabase.from("batches").select("id, batch_name, age_group, center_id").eq("academy_id", academyId).eq("is_active", true).order("batch_name"),
        getActiveSchedules({ academyId }),
        getCoachScheduleAssignments({ academyId })
      ]);
      if (centerResult.error) throw centerResult.error;
      if (batchResult.error) throw batchResult.error;
      setCoaches(coachData); setCenters(centerResult.data || []); setBatches(batchResult.data || []);
      setSchedules(scheduleData); setAssignments(assignmentData);
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Unable to load coach schedule assignments." });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (academyId) loadReferenceData(); }, [academyId]);

  const visibleBatches = useMemo(() => centerId ? batches.filter((b) => b.center_id === centerId) : [], [batches, centerId]);
  const visibleSchedules = useMemo(() => schedules.filter((s) =>
    (!centerId || s.center_id === centerId) && (!batchId || s.batch_id === batchId)
  ), [schedules, centerId, batchId]);

  const resetForm = () => {
    setCoachId(""); setScheduleId(""); setAssignedFrom(new Date().toISOString().slice(0, 10));
    setAssignedUntil(""); setEditingId(null);
  };

  const saveAssignment = async () => {
    setNotice(null);
    if (!academyId || !coachId || !scheduleId || !assignedFrom) {
      setNotice({ type: "error", message: "Select a coach, session, and assignment start date." }); return;
    }
    if (assignedUntil && assignedUntil < assignedFrom) {
      setNotice({ type: "error", message: "Assignment end date cannot be before the start date." }); return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateCoachScheduleAssignment(editingId, { assignedFrom, assignedUntil: assignedUntil || null });
        setNotice({ type: "success", message: "Coach schedule assignment updated." });
      } else {
        await assignCoachToSchedule({ academyId, batchScheduleId: scheduleId, coachId, assignedFrom, assignedUntil: assignedUntil || null });
        setNotice({ type: "success", message: "Coach assigned to session successfully." });
      }
      resetForm(); await loadReferenceData();
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Unable to save coach schedule assignment." });
    } finally { setSaving(false); }
  };

  const startEdit = (item) => {
    const s = item.batch_schedules;
    setEditingId(item.id); setCoachId(item.coach_id); setScheduleId(item.batch_schedule_id);
    setCenterId(s?.center_id || ""); setBatchId(s?.batch_id || "");
    setAssignedFrom(item.assigned_from || ""); setAssignedUntil(item.assigned_until || "");
    window.setTimeout(() => document.getElementById("coach-schedule-assignment-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const removeAssignment = async (item) => {
    if (!window.confirm(`Remove ${item.coaches?.full_name || "this coach"} from this session?`)) return;
    setSaving(true); setNotice(null);
    try {
      await deactivateCoachScheduleAssignment(item.id);
      setNotice({ type: "success", message: "Coach schedule assignment removed." });
      if (editingId === item.id) resetForm();
      await loadReferenceData();
    } catch (error) { setNotice({ type: "error", message: error.message || "Unable to remove assignment." }); }
    finally { setSaving(false); }
  };

  const displayed = assignments.filter((item) => {
    const s = item.batch_schedules;
    return (!filters.schedule || item.batch_schedule_id === filters.schedule) &&
      (!filters.coach || item.coach_id === filters.coach);
  });

  const selectedSchedule = schedules.find((s) => s.id === scheduleId);

  return (
    <Layout>
      <main className="coach-schedule-assignment-page">
        <section className="csa-header">
          <div><span>Academy management</span><h1>Coach Schedule Assignment</h1><p>Assign one or more coaches to a specific recurring session.</p></div>
          <div className="csa-summary"><strong>{assignments.length}</strong><span>active assignments</span></div>
        </section>

        {notice && <div className={`csa-notice csa-notice-${notice.type}`} role="status">{notice.message}</div>}

        {canManage && academyId && (
          <section id="coach-schedule-assignment-form" className="csa-card">
            <div className="csa-card-title"><div><span>{editingId ? "Edit assignment" : "Create assignment"}</span><h2>{editingId ? "Edit Coach Session Assignment" : "Assign Coach to Session"}</h2></div></div>
            <div className="csa-grid">
              {isSuperAdmin(user) && <label><span>Academy *</span><select value={academyId} onChange={(e) => { setAcademyId(e.target.value); setCenterId(""); setBatchId(""); resetForm(); }}><option value="">Select Academy</option>{academies.map((a) => <option key={a.id} value={a.id}>{a.academy_name}</option>)}</select></label>}
              <label><span>Center *</span><select value={centerId} onChange={(e) => { setCenterId(e.target.value); setBatchId(""); setScheduleId(""); }}><option value="">Select Center</option>{centers.map((c) => <option key={c.id} value={c.id}>{c.center_name}</option>)}</select></label>
              <label><span>Batch *</span><select value={batchId} disabled={!centerId} onChange={(e) => { setBatchId(e.target.value); setScheduleId(""); }}><option value="">Select Batch</option>{visibleBatches.map((b) => <option key={b.id} value={b.id}>{b.batch_name}{b.age_group ? ` · ${b.age_group}` : ""}</option>)}</select></label>
              <label className="csa-wide"><span>Recurring Session *</span><select value={scheduleId} disabled={!batchId || editingId} onChange={(e) => setScheduleId(e.target.value)}><option value="">Select Session</option>{visibleSchedules.map((s) => <option key={s.id} value={s.id}>{getDayName(s.day_of_week)} · {formatTime(s.start_time)}–{formatTime(s.end_time)}{s.session_label ? ` · ${s.session_label}` : ""}</option>)}</select></label>
              <label><span>Coach *</span><select value={coachId} disabled={!!editingId} onChange={(e) => setCoachId(e.target.value)}><option value="">Select Coach</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label>
              <label><span>Assigned From *</span><input type="date" value={assignedFrom} onChange={(e) => setAssignedFrom(e.target.value)} /></label>
              <label><span>Assigned Until</span><input type="date" min={assignedFrom || undefined} value={assignedUntil} onChange={(e) => setAssignedUntil(e.target.value)} /></label>
              <div className="csa-actions"><button type="button" onClick={saveAssignment} disabled={saving}>{saving ? "Saving…" : editingId ? "Save Changes" : "Assign Coach"}</button>{editingId && <button type="button" className="csa-secondary" onClick={resetForm}>Cancel</button>}</div>
            </div>
            {selectedSchedule && <div className="csa-session-preview"><strong>Session:</strong> {selectedSchedule.batches?.batch_name} · {selectedSchedule.centers?.center_name} · {getDayName(selectedSchedule.day_of_week)} · {formatTime(selectedSchedule.start_time)}–{formatTime(selectedSchedule.end_time)}</div>}
          </section>
        )}

        <section className="csa-card">
          <div className="csa-list-header"><div><span>Current assignments</span><h2>Coach → Session</h2></div><div className="csa-filters"><select value={filters.schedule} onChange={(e) => setFilters((f) => ({...f, schedule: e.target.value}))}><option value="">All Sessions</option>{schedules.map((s) => <option key={s.id} value={s.id}>{getDayName(s.day_of_week)} · {formatTime(s.start_time)} · {s.session_label || s.batches?.batch_name}</option>)}</select><select value={filters.coach} onChange={(e) => setFilters((f) => ({...f, coach: e.target.value}))}><option value="">All Coaches</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></div></div>
          {loading ? <div className="csa-empty">Loading…</div> : displayed.length === 0 ? <div className="csa-empty">No active coach schedule assignments found.</div> : (
            <div className="csa-table-wrap"><table><thead><tr><th>Coach</th><th>Center</th><th>Batch</th><th>Session</th><th>Assigned From</th><th>Assigned Until</th><th>Actions</th></tr></thead><tbody>
              {displayed.map((item) => { const s=item.batch_schedules; return <tr key={item.id}><td>{item.coaches?.full_name || "—"}</td><td>{s?.centers?.center_name || "—"}</td><td>{s?.batches?.batch_name || "—"}</td><td>{getDayName(s?.day_of_week)} · {formatTime(s?.start_time)}–{formatTime(s?.end_time)}{s?.session_label ? ` · ${s.session_label}` : ""}</td><td>{item.assigned_from || "—"}</td><td>{item.assigned_until || "Open-ended"}</td><td><button type="button" className="csa-icon" onClick={() => startEdit(item)} disabled={saving} aria-label="Edit assignment">✎</button><button type="button" className="csa-icon csa-danger" onClick={() => removeAssignment(item)} disabled={saving} aria-label="Remove assignment">×</button></td></tr>; })}
            </tbody></table></div>
          )}
        </section>
      </main>
    </Layout>
  );
}
export default CoachScheduleAssignment;
