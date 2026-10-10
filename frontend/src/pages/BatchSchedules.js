import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../supabaseClient";
import { getLoggedInUser, isAcademyOwner, isSuperAdmin } from "../utils/auth";
import {
  getAccessibleAcademies,
  getAccessibleCenters,
  getAccessibleBatches
} from "../utils/dataScope";
import {
  createBatchSchedule,
  deactivateBatchSchedule,
  getAccessibleBatchSchedules,
  getDayName,
  updateBatchSchedule
} from "../services/batchScheduleService";
import "./BatchSchedules.css";

const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"]
];

const initialForm = {
  academyId: "",
  centerId: "",
  batchId: "",
  dayOfWeek: "1",
  startTime: "",
  endTime: "",
  sessionLabel: ""
};

const BatchSchedules = () => {
  const [user, setUser] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [centers, setCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [filters, setFilters] = useState({ academyId: "", centerId: "", batchId: "" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canManage = isSuperAdmin(user) || isAcademyOwner(user);

  const loadReferenceData = useCallback(async () => {
    if (!user) return;

    const [academyData, centerData, batchData] = await Promise.all([
      getAccessibleAcademies(user),
      getAccessibleCenters(user),
      getAccessibleBatches(user)
    ]);

    setAcademies(academyData || []);
    setCenters(centerData || []);
    setBatches(batchData || []);
  }, [user]);

  const loadSchedules = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const data = await getAccessibleBatchSchedules(filters);
      setSchedules(data);
    } catch (err) {
      console.error("Failed to load batch schedules:", err);
      setSchedules([]);
      setError(err.message || "Unable to load batch schedules.");
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useEffect(() => {
    getLoggedInUser().then(setUser);
  }, []);

  useEffect(() => {
    if (user) loadReferenceData();
  }, [user, loadReferenceData]);

  useEffect(() => {
    if (user) loadSchedules();
  }, [user, loadSchedules]);

  const filteredCenters = useMemo(
    () => centers.filter((center) => !form.academyId || center.academy_id === form.academyId),
    [centers, form.academyId]
  );

  const filteredBatches = useMemo(
    () => batches.filter((batch) => {
      if (form.academyId && batch.academy_id !== form.academyId) return false;
      if (form.centerId && batch.center_id !== form.centerId) return false;
      return true;
    }),
    [batches, form.academyId, form.centerId]
  );

  const handleFormAcademyChange = (academyId) => {
    setForm((current) => ({
      ...current,
      academyId,
      centerId: "",
      batchId: ""
    }));
  };

  const handleFormCenterChange = (centerId) => {
    setForm((current) => ({
      ...current,
      centerId,
      batchId: ""
    }));
  };

  const handleFilterAcademyChange = (academyId) => {
    setFilters((current) => ({
      academyId,
      centerId: "",
      batchId: ""
    }));
  };

  const handleFilterCenterChange = (centerId) => {
    setFilters((current) => ({
      ...current,
      centerId,
      batchId: ""
    }));
  };

  const resetForm = () => {
    setForm({
      ...initialForm,
      academyId: isSuperAdmin(user) ? "" : user?.academy_id || ""
    });
    setEditingId(null);
  };

  const validateForm = () => {
    if (!form.academyId || !form.centerId || !form.batchId ||
        !form.dayOfWeek || !form.startTime || !form.endTime) {
      return "Please fill all required fields.";
    }

    if (form.startTime >= form.endTime) {
      return "End time must be after start time.";
    }

    return "";
  };

  const handleSave = async () => {
    if (!canManage) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        academyId: form.academyId,
        batchId: form.batchId,
        centerId: form.centerId,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        sessionLabel: form.sessionLabel
      };

      if (editingId) {
        await updateBatchSchedule(editingId, payload);
      } else {
        await createBatchSchedule(payload);
      }

      resetForm();
      await loadSchedules();
    } catch (err) {
      console.error("Failed to save batch schedule:", err);
      setError(err.message || "Unable to save batch schedule.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (schedule) => {
    setError("");
    setEditingId(schedule.id);
    setForm({
      academyId: schedule.academy_id || "",
      centerId: schedule.center_id || "",
      batchId: schedule.batch_id || "",
      dayOfWeek: String(schedule.day_of_week),
      startTime: String(schedule.start_time || "").slice(0, 5),
      endTime: String(schedule.end_time || "").slice(0, 5),
      sessionLabel: schedule.session_label || ""
    });
  };

  const handleDeactivate = async (schedule) => {
    if (!canManage) return;

    const confirmed = window.confirm(
      `Deactivate the ${getDayName(schedule.day_of_week)} ${schedule.start_time?.slice(0, 5)} session for ${schedule.batches?.batch_name || "this batch"}?`
    );

    if (!confirmed) return;

    setError("");

    try {
      await deactivateBatchSchedule(schedule.id);
      if (editingId === schedule.id) resetForm();
      await loadSchedules();
    } catch (err) {
      console.error("Failed to deactivate batch schedule:", err);
      setError(err.message || "Unable to deactivate batch schedule.");
    }
  };

  return (
    <Layout>
      <div className="batch-schedules-page">
        <section className="batch-schedules-header">
          <div>
            <span className="batch-schedules-eyebrow">Academy operations</span>
            <h1>Batch Schedules</h1>
            <p>Manage recurring sessions for each logical batch.</p>
          </div>
          <div className="batch-schedules-count">
            <strong>{schedules.length}</strong>
            <span>active sessions</span>
          </div>
        </section>

        {error ? (
          <div className="batch-schedules-alert" role="alert">{error}</div>
        ) : null}

        <section className="batch-schedules-card">
          <div className="batch-schedules-section-heading">
            <div>
              <span className="batch-schedules-kicker">Filters</span>
              <h2>Find sessions</h2>
            </div>
          </div>

          <div className="batch-schedules-grid">
            {isSuperAdmin(user) ? (
              <div className="batch-schedules-field">
                <label htmlFor="schedule-filter-academy">Academy</label>
                <select
                  id="schedule-filter-academy"
                  value={filters.academyId}
                  onChange={(e) => handleFilterAcademyChange(e.target.value)}
                >
                  <option value="">All academies</option>
                  {academies.map((academy) => (
                    <option key={academy.id} value={academy.id}>{academy.academy_name}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="batch-schedules-field">
              <label htmlFor="schedule-filter-center">Center</label>
              <select
                id="schedule-filter-center"
                value={filters.centerId}
                onChange={(e) => handleFilterCenterChange(e.target.value)}
              >
                <option value="">All centers</option>
                {centers
                  .filter((center) => !filters.academyId || center.academy_id === filters.academyId)
                  .map((center) => (
                    <option key={center.id} value={center.id}>{center.center_name}</option>
                  ))}
              </select>
            </div>

            <div className="batch-schedules-field">
              <label htmlFor="schedule-filter-batch">Batch</label>
              <select
                id="schedule-filter-batch"
                value={filters.batchId}
                onChange={(e) => setFilters((current) => ({ ...current, batchId: e.target.value }))}
              >
                <option value="">All batches</option>
                {batches
                  .filter((batch) =>
                    (!filters.academyId || batch.academy_id === filters.academyId) &&
                    (!filters.centerId || batch.center_id === filters.centerId)
                  )
                  .map((batch) => (
                    <option key={batch.id} value={batch.id}>{batch.batch_name}</option>
                  ))}
              </select>
            </div>
          </div>
        </section>

        {canManage ? (
          <section className="batch-schedules-card">
            <div className="batch-schedules-section-heading">
              <div>
                <span className="batch-schedules-kicker">{editingId ? "Edit session" : "New session"}</span>
                <h2>{editingId ? "Update recurring session" : "Add recurring session"}</h2>
              </div>
            </div>

            <div className="batch-schedules-form-grid">
              {isSuperAdmin(user) ? (
                <div className="batch-schedules-field">
                  <label htmlFor="schedule-form-academy">Academy *</label>
                  <select
                    id="schedule-form-academy"
                    value={form.academyId}
                    onChange={(e) => handleFormAcademyChange(e.target.value)}
                  >
                    <option value="">Select academy</option>
                    {academies.map((academy) => (
                      <option key={academy.id} value={academy.id}>{academy.academy_name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="batch-schedules-field">
                <label htmlFor="schedule-form-center">Center *</label>
                <select
                  id="schedule-form-center"
                  value={form.centerId}
                  onChange={(e) => handleFormCenterChange(e.target.value)}
                >
                  <option value="">Select center</option>
                  {filteredCenters.map((center) => (
                    <option key={center.id} value={center.id}>{center.center_name}</option>
                  ))}
                </select>
              </div>

              <div className="batch-schedules-field">
                <label htmlFor="schedule-form-batch">Batch *</label>
                <select
                  id="schedule-form-batch"
                  value={form.batchId}
                  onChange={(e) => setForm((current) => ({ ...current, batchId: e.target.value }))}
                >
                  <option value="">Select batch</option>
                  {filteredBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_name}{batch.age_group ? ` · ${batch.age_group}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="batch-schedules-field">
                <label htmlFor="schedule-form-day">Day *</label>
                <select
                  id="schedule-form-day"
                  value={form.dayOfWeek}
                  onChange={(e) => setForm((current) => ({ ...current, dayOfWeek: e.target.value }))}
                >
                  {DAYS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="batch-schedules-field">
                <label htmlFor="schedule-form-start">Start time *</label>
                <input
                  id="schedule-form-start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((current) => ({ ...current, startTime: e.target.value }))}
                />
              </div>

              <div className="batch-schedules-field">
                <label htmlFor="schedule-form-end">End time *</label>
                <input
                  id="schedule-form-end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((current) => ({ ...current, endTime: e.target.value }))}
                />
              </div>

              <div className="batch-schedules-field batch-schedules-field-wide">
                <label htmlFor="schedule-form-label">Session label</label>
                <input
                  id="schedule-form-label"
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Morning / Evening"
                  value={form.sessionLabel}
                  onChange={(e) => setForm((current) => ({ ...current, sessionLabel: e.target.value }))}
                />
              </div>
            </div>

            <div className="batch-schedules-actions">
              <button
                type="button"
                className="batch-schedules-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : editingId ? "Update Session" : "Add Session"}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="batch-schedules-card batch-schedules-results">
          <div className="batch-schedules-results-heading">
            <div>
              <span className="batch-schedules-kicker">Recurring sessions</span>
              <h2>Schedule directory</h2>
            </div>
            <span>{loading ? "Loading..." : `${schedules.length} session${schedules.length === 1 ? "" : "s"}`}</span>
          </div>

          <div className="batch-schedules-table-wrap">
            <table className="batch-schedules-table">
              <thead>
                <tr>
                  <th>Academy</th>
                  <th>Center</th>
                  <th>Batch</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Session</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {!loading && schedules.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 7 : 6} className="batch-schedules-empty">
                      <strong>No active schedules found.</strong>
                      <span>Create a recurring session above to get started.</span>
                    </td>
                  </tr>
                ) : schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>{schedule.academies?.academy_name || "—"}</td>
                    <td>{schedule.centers?.center_name || "—"}</td>
                    <td>
                      <strong>{schedule.batches?.batch_name || "—"}</strong>
                      {schedule.batches?.age_group ? <span className="batch-schedules-muted"> · {schedule.batches.age_group}</span> : null}
                    </td>
                    <td>{getDayName(schedule.day_of_week)}</td>
                    <td>{String(schedule.start_time || "").slice(0, 5)} – {String(schedule.end_time || "").slice(0, 5)}</td>
                    <td>{schedule.session_label || "—"}</td>
                    {canManage ? (
                      <td>
                        <div className="batch-schedules-row-actions">
                          <button type="button" onClick={() => handleEdit(schedule)}>Edit</button>
                          <button
                            type="button"
                            className="batch-schedules-danger"
                            onClick={() => handleDeactivate(schedule)}
                          >
                            Deactivate
                          </button>
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

export default BatchSchedules;
