import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../supabaseClient";
import { getCurrentUser } from "../utils/auth";
import { getCoachAssignedBatchIds } from "../utils/dataScope";
import { isAcademyOwner, isCoach, isSuperAdmin } from "../utils/roles";

const scoreFields = [
  ["ball_control_score", "Ball control"],
  ["passing_score", "Passing"],
  ["dribbling_score", "Dribbling"],
  ["shooting_score", "Shooting"],
  ["defending_score", "Defending"],
  ["speed_score", "Speed"],
  ["stamina_score", "Stamina"],
  ["teamwork_score", "Teamwork"],
  ["discipline_score", "Discipline"],
];

const createEmptyForm = () => ({
  assessment_date: new Date().toISOString().slice(0, 10),
  ball_control_score: "",
  passing_score: "",
  dribbling_score: "",
  shooting_score: "",
  defending_score: "",
  speed_score: "",
  stamina_score: "",
  teamwork_score: "",
  discipline_score: "",
  coach_remarks: "",
  coach_id: "",
});

const formatDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
};

function CoachPerformanceAssessments() {
  const [coach, setCoach] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [academies, setAcademies] = useState([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [assessments, setAssessments] = useState([]);
  const [form, setForm] = useState(createEmptyForm);
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadCoachAndPlayers = async () => {
      try {
        setLoading(true);
        setError("");

        const loadedUser = await getCurrentUser();
        if (!loadedUser || !["super_admin", "academy_owner", "coach"].includes(loadedUser.role)) {
          throw new Error("Your account is not authorized to manage performance assessments.");
        }

        let coachRecord = null;
        let accessiblePlayers = [];

        if (isCoach(loadedUser)) {
          const { data, error: coachError } = await supabase
            .from("coaches")
            .select("id, full_name, academy_id")
            .eq("user_id", loadedUser.id)
            .maybeSingle();

          if (coachError) throw coachError;
          if (!data) throw new Error("No coach profile is linked to this account.");

          coachRecord = data;
          const batchIds = await getCoachAssignedBatchIds(loadedUser);

          if (batchIds.length > 0) {
            const { data: playerData, error: playersError } = await supabase
              .from("players")
              .select("id, full_name, academy_id, batch_id, batches!inner(batch_name, is_active)")
              .in("batch_id", batchIds)
              .eq("is_active", true)
              .eq("batches.is_active", true)
              .order("full_name", { ascending: true });

            if (playersError) throw playersError;
            accessiblePlayers = playerData || [];
          }
        } else {
          let playerQuery = supabase
            .from("players")
            .select("id, full_name, academy_id, batch_id, academies(academy_name), batches!inner(batch_name, is_active)")
            .eq("is_active", true)
            .eq("batches.is_active", true)
            .order("full_name", { ascending: true });

          let coachQuery = supabase
            .from("coaches")
            .select("id, full_name, academy_id, academies(academy_name)")
            .eq("is_active", true)
            .order("full_name", { ascending: true });

          if (isAcademyOwner(loadedUser)) {
            if (!loadedUser.academy_id) throw new Error("No academy is linked to this academy owner account.");
            playerQuery = playerQuery.eq("academy_id", loadedUser.academy_id);
            coachQuery = coachQuery.eq("academy_id", loadedUser.academy_id);
            setSelectedAcademyId(loadedUser.academy_id);
          }

          const [{ data: playerData, error: playersError }, { data: coachData, error: coachesError }] = await Promise.all([
            playerQuery,
            coachQuery,
          ]);

          if (playersError) throw playersError;
          if (coachesError) throw coachesError;

          accessiblePlayers = playerData || [];
          setCoaches(coachData || []);

          if (isSuperAdmin(loadedUser)) {
            const { data: academyData, error: academiesError } = await supabase
              .from("academies")
              .select("id, academy_name")
              .eq("is_active", true)
              .order("academy_name", { ascending: true });

            if (academiesError) throw academiesError;
            setAcademies(academyData || []);
          }
        }

        if (!isMounted) return;
        setCurrentUser(loadedUser);
        setCoach(coachRecord);
        setPlayers(accessiblePlayers);
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Performance assessment load error:", loadError);
        setError(loadError.message || "Unable to load performance assessment data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCoachAndPlayers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAssessmentHistory = async () => {
      if (!selectedPlayerId || !currentUser) {
        setAssessments([]);
        return;
      }

      try {
        setHistoryLoading(true);
        setError("");
        let query = supabase
          .from("player_performance_assessments")
          .select("id, assessment_date, ball_control_score, passing_score, dribbling_score, shooting_score, defending_score, speed_score, stamina_score, teamwork_score, discipline_score, coach_remarks, coach_id, coaches(full_name), created_at, updated_at")
          .eq("player_id", selectedPlayerId)
          .order("assessment_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (isCoach(currentUser)) query = query.eq("coach_id", coach.id);

        const { data, error: historyError } = await query;
        if (historyError) throw historyError;
        if (isMounted) setAssessments(data || []);
      } catch (historyLoadError) {
        if (!isMounted) return;
        console.error("Performance assessment history error:", historyLoadError);
        setAssessments([]);
        setError("Unable to load assessment history. Please try again.");
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    };

    loadAssessmentHistory();

    return () => {
      isMounted = false;
    };
  }, [selectedPlayerId, coach, currentUser]);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId);
  const accessibleCoaches = isSuperAdmin(currentUser) && selectedAcademyId ? coaches.filter((item) => item.academy_id === selectedAcademyId) : coaches;
  const selectedCoach = coaches.find((item) => item.id === form.coach_id);

  const resetForm = () => {
    setForm({ ...createEmptyForm(), coach_id: isCoach(currentUser) ? coach?.id || "" : "" });
    setEditingAssessmentId(null);
    setValidationErrors({});
  };

  const handleAcademyChange = (event) => {
    const academyId = event.target.value;
    setSelectedAcademyId(academyId);
    setSelectedPlayerId("");
    setAssessments([]);
    resetForm();
    setSuccess("");
  };

  const handlePlayerChange = (event) => {
    setSelectedPlayerId(event.target.value);
    resetForm();
    setSuccess("");
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
    setValidationErrors((currentErrors) => ({ ...currentErrors, [name]: "" }));
    setSuccess("");
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.assessment_date) {
      nextErrors.assessment_date = "Assessment date is required.";
    }

    scoreFields.forEach(([name, label]) => {
      const value = form[name];
      if (value === "" || value === null || value === undefined) return;

      const score = Number(value);
      if (!Number.isFinite(score)) {
        nextErrors[name] = `${label} must be a number.`;
      } else if (score < 0 || score > 10) {
        nextErrors[name] = `${label} must be between 0 and 10.`;
      }
    });

    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildAssessmentPayload = () => {
    const scores = scoreFields.reduce((payload, [name]) => ({
      ...payload,
      [name]: form[name] === "" || form[name] === null || form[name] === undefined ? null : Number(form[name]),
    }), {});

    return {
      assessment_date: form.assessment_date,
      ...scores,
      coach_remarks: form.coach_remarks.trim() || null,
      coach_id: isCoach(currentUser) ? coach.id : form.coach_id,
    };
  };

  const loadAssessmentHistory = async () => {
    if (!selectedPlayerId || !currentUser) return;

    let historyQuery = supabase
      .from("player_performance_assessments")
      .select(
        "id, assessment_date, ball_control_score, passing_score, dribbling_score, shooting_score, defending_score, speed_score, stamina_score, teamwork_score, discipline_score, coach_remarks, coach_id, coaches(full_name), created_at, updated_at"
      )
      .eq("player_id", selectedPlayerId)
      .order("assessment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (isCoach(currentUser)) {
      historyQuery = historyQuery.eq("coach_id", coach.id);
    }

    const { data, error: historyError } = await historyQuery;

    if (historyError) throw historyError;
    setAssessments(data || []);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSuccess("");
    setError("");

    if (!selectedPlayer) {
      setError("Select a player before saving an assessment.");
      return;
    }

    if (!validateForm()) return;

    if (!isCoach(currentUser) && !form.coach_id) {
      setError("Select the coach whose assessment this record represents.");
      return;
    }

    if (!isCoach(currentUser) && selectedCoach?.academy_id !== selectedPlayer.academy_id) {
      setError("The selected coach must belong to the same academy as the player.");
      return;
    }

    try {
      setSaving(true);
      const payload = buildAssessmentPayload();

      if (editingAssessmentId) {
        let updateQuery = supabase
          .from("player_performance_assessments")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingAssessmentId);

        const { error: updateError } = await updateQuery;

        if (updateError) throw updateError;
        setSuccess("Assessment updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("player_performance_assessments")
          .insert({
            ...payload,
            player_id: selectedPlayer.id,
            academy_id: selectedPlayer.academy_id,
          });

        if (insertError) throw insertError;
        setSuccess("Assessment saved successfully.");
      }

      resetForm();
      await loadAssessmentHistory();
    } catch (saveError) {
      console.error("Performance assessment save error:", saveError);
      setError("Unable to save the assessment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assessment) => {
    if (!window.confirm("Delete this performance assessment? This action cannot be undone.")) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      setSaving(true);
      let deleteQuery = supabase
        .from("player_performance_assessments")
        .delete()
        .eq("id", assessment.id);

      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;

      if (editingAssessmentId === assessment.id) {
        resetForm();
      }

      setSuccess("Assessment deleted successfully.");
      await loadAssessmentHistory();
    } catch (deleteError) {
      console.error("Performance assessment delete error:", deleteError);
      setError("Unable to delete the assessment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (assessment) => {
    const nextForm = scoreFields.reduce(
      (currentForm, [name]) => ({
        ...currentForm,
        [name]: assessment[name] ?? "",
      }),
      {
        assessment_date: assessment.assessment_date || "",
        coach_remarks: assessment.coach_remarks || "",
      }
    );

    setForm({ ...nextForm, coach_id: assessment.coach_id || "" });
    setEditingAssessmentId(assessment.id);
    setValidationErrors({});
    setSuccess("");
  };

  if (loading) {
    return <Layout><h2>Loading performance assessments...</h2></Layout>;
  }

  return (
    <Layout>
      <main style={styles.page}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Player Performance Assessments</h1>
            <p style={styles.subtitle}>{isCoach(currentUser) ? "Record and review assessments for your assigned active players." : "Create, review, edit and delete performance assessments within your authorized scope."}</p>
          </div>
        </header>

        {error ? <p role="alert" style={styles.error}>{error}</p> : null}
        {success ? <p role="status" style={styles.success}>{success}</p> : null}

        <section style={styles.card}>
          {!isCoach(currentUser) ? (
            <>
              <label htmlFor="assessment-academy" style={styles.label}>Select academy</label>
              <select id="assessment-academy" value={selectedAcademyId} onChange={handleAcademyChange} disabled={isAcademyOwner(currentUser)} style={{ ...styles.input, marginBottom: "14px" }}>
                <option value="">Select academy</option>
                {(isAcademyOwner(currentUser) ? [{ id: currentUser.academy_id, academy_name: "My academy" }] : academies).map((academy) => (
                  <option key={academy.id} value={academy.id}>{academy.academy_name}</option>
                ))}
              </select>
            </>
          ) : null}
          <label htmlFor="assessment-player" style={styles.label}>Select player</label>
          <select id="assessment-player" value={selectedPlayerId} onChange={handlePlayerChange} style={styles.input}>
            <option value="">Select an assigned player</option>
            {players.filter((player) => isCoach(currentUser) || !selectedAcademyId || player.academy_id === selectedAcademyId).map((player) => (
              <option key={player.id} value={player.id}>
                {player.full_name} — {player.batches?.batch_name || "No batch"}
              </option>
            ))}
          </select>
          {!players.length ? <p style={styles.message}>No players are currently available in your assigned batches.</p> : null}
        </section>

        {selectedPlayer ? (
          <>
            <section style={styles.card} aria-labelledby="assessment-form-heading">
              <p style={styles.eyebrow}>{editingAssessmentId ? "Edit mode" : "Create mode"}</p>
              <h2 id="assessment-form-heading" style={styles.sectionTitle}>
                {editingAssessmentId ? "Edit assessment" : "New assessment"}
              </h2>
              <p style={styles.message}>
                Player: <strong>{selectedPlayer.full_name}</strong> · Batch: <strong>{selectedPlayer.batches?.batch_name || "Not assigned"}</strong>
              </p>

              <form onSubmit={handleSubmit} style={styles.form} noValidate>
                {!isCoach(currentUser) ? (
                  <div style={styles.field}>
                    <label htmlFor="assessment-coach" style={styles.label}>Assessment coach</label>
                    <select id="assessment-coach" name="coach_id" value={form.coach_id} onChange={handleFormChange} style={styles.input}>
                      <option value="">Select coach</option>
                      {accessibleCoaches.map((item) => (
                        <option key={item.id} value={item.id}>{item.full_name}{item.academies?.academy_name ? " — " + item.academies.academy_name : ""}</option>
                      ))}
                    </select>
                    <span style={styles.helperText}>The selected coach remains the assessment attribution.</span>
                  </div>
                ) : null}

                <div style={styles.field}>
                  <label htmlFor="assessment-date" style={styles.label}>Assessment date</label>
                  <input id="assessment-date" name="assessment_date" type="date" value={form.assessment_date} onChange={handleFormChange} style={styles.input} aria-invalid={Boolean(validationErrors.assessment_date)} />
                  {validationErrors.assessment_date ? <span style={styles.fieldError}>{validationErrors.assessment_date}</span> : null}
                </div>

                <div style={styles.scoreGrid}>
                  {scoreFields.map(([name, label]) => (
                    <div key={name} style={styles.field}>
                      <label htmlFor={name} style={styles.label}>{label} (0–10)</label>
                      <input id={name} name={name} type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form[name]} onChange={handleFormChange} style={styles.input} aria-invalid={Boolean(validationErrors[name])} aria-describedby={validationErrors[name] ? `${name}-error` : undefined} />
                      {validationErrors[name] ? <span id={`${name}-error`} style={styles.fieldError}>{validationErrors[name]}</span> : null}
                    </div>
                  ))}
                </div>

                <div style={styles.field}>
                  <label htmlFor="coach-remarks" style={styles.label}>Coach remarks</label>
                  <textarea id="coach-remarks" name="coach_remarks" value={form.coach_remarks} onChange={handleFormChange} rows="4" style={{ ...styles.input, ...styles.textarea }} />
                </div>

                <div style={styles.actions}>
                  <button type="submit" disabled={saving} style={styles.primaryButton}>
                    {saving ? "Saving..." : editingAssessmentId ? "Update assessment" : "Save assessment"}
                  </button>
                  {editingAssessmentId ? <button type="button" onClick={resetForm} disabled={saving} style={styles.secondaryButton}>Cancel edit</button> : null}
                </div>
              </form>
            </section>

            <section style={styles.card} aria-labelledby="history-heading">
              <h2 id="history-heading" style={styles.sectionTitle}>Assessment history</h2>
              {historyLoading ? <p style={styles.message}>Loading assessment history...</p> : assessments.length ? (
                <div style={styles.historyList}>
                  {assessments.map((assessment) => (
                    <article key={assessment.id} style={styles.historyItem}>
                      <div style={styles.historyHeader}>
                        <strong>{formatDate(assessment.assessment_date)}</strong>
                        <div style={styles.historyActions}>
                          <button type="button" onClick={() => handleEdit(assessment)} disabled={saving} style={styles.editButton}>Edit</button>
                          <button type="button" onClick={() => handleDelete(assessment)} disabled={saving} style={styles.deleteButton}>Delete</button>
                        </div>
                      </div>
                      <div style={styles.historyMeta}><span><strong>Coach:</strong> {assessment.coaches?.full_name || "Not recorded"}</span></div>
                      <div style={styles.historyScores}>
                        {scoreFields.map(([name, label]) => (
                          <span key={name}><strong>{label}:</strong> {assessment[name] ?? "—"}</span>
                        ))}
                      </div>
                      {assessment.coach_remarks ? <p style={styles.remarks}>{assessment.coach_remarks}</p> : null}
                    </article>
                  ))}
                </div>
              ) : <p style={styles.message}>No performance assessments are available for this player yet.</p>}
            </section>
          </>
        ) : null}
      </main>
    </Layout>
  );
}

const styles = {
  page: { width: "100%", maxWidth: "1000px", margin: "0 auto", padding: "4px 0 30px", boxSizing: "border-box" },
  header: { marginBottom: "24px" },
  title: { margin: 0, color: "#0f172a", fontSize: "30px" },
  subtitle: { margin: "8px 0 0", color: "#475569" },
  card: { marginTop: "18px", padding: "24px", borderRadius: "12px", background: "#fff", boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)", boxSizing: "border-box" },
  eyebrow: { margin: "0 0 6px", color: "#2563eb", fontSize: "13px", fontWeight: "bold", letterSpacing: "0.05em", textTransform: "uppercase" },
  sectionTitle: { margin: "0 0 12px", color: "#0f172a", fontSize: "22px" },
  label: { display: "block", marginBottom: "6px", color: "#334155", fontSize: "14px", fontWeight: "bold" },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", boxSizing: "border-box", background: "#fff", color: "#0f172a", font: "inherit" },
  textarea: { resize: "vertical", minHeight: "96px" },
  form: { marginTop: "20px" },
  scoreGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "16px", margin: "18px 0" },
  field: { minWidth: 0 },
  fieldError: { display: "block", marginTop: "5px", color: "#b91c1c", fontSize: "13px" },
  actions: { display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "20px" },
  primaryButton: { padding: "10px 16px", border: 0, borderRadius: "8px", background: "#2563eb", color: "#fff", fontWeight: "bold", cursor: "pointer" },
  secondaryButton: { padding: "10px 16px", border: "1px solid #94a3b8", borderRadius: "8px", background: "#fff", color: "#334155", fontWeight: "bold", cursor: "pointer" },
  helperText: { display: "block", marginTop: "5px", color: "#64748b", fontSize: "13px" },
  historyActions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  historyMeta: { marginTop: "10px", color: "#475569", fontSize: "14px" },
  editButton: { padding: "7px 12px", border: "1px solid #2563eb", borderRadius: "7px", background: "#eff6ff", color: "#1d4ed8", fontWeight: "bold", cursor: "pointer" },
  deleteButton: { padding: "7px 12px", border: "1px solid #dc2626", borderRadius: "7px", background: "#fef2f2", color: "#b91c1c", fontWeight: "bold", cursor: "pointer" },
  error: { margin: "0 0 16px", padding: "12px 14px", borderRadius: "8px", background: "#fee2e2", color: "#991b1b" },
  success: { margin: "0 0 16px", padding: "12px 14px", borderRadius: "8px", background: "#dcfce7", color: "#166534" },
  message: { margin: "10px 0 0", color: "#475569", lineHeight: 1.5, overflowWrap: "anywhere" },
  historyList: { display: "flex", flexDirection: "column", gap: "12px" },
  historyItem: { padding: "16px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#f8fafc", minWidth: 0 },
  historyHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  historyScores: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap: "8px 16px", marginTop: "14px", color: "#334155", fontSize: "14px" },
  remarks: { margin: "14px 0 0", color: "#475569", lineHeight: 1.5, overflowWrap: "anywhere", whiteSpace: "pre-wrap" },
};

export default CoachPerformanceAssessments;
