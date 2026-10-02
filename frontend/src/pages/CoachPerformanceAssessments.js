import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import "./CoachPerformanceAssessments.css";
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
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [form, setForm] = useState(createEmptyForm);
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [savedSummary, setSavedSummary] = useState(null);

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
    if (!playerPickerOpen) return undefined;

    const handlePickerKeyDown = (event) => {
      if (event.key === "Escape") setPlayerPickerOpen(false);
    };

    document.addEventListener("keydown", handlePickerKeyDown);
    return () => document.removeEventListener("keydown", handlePickerKeyDown);
  }, [playerPickerOpen]);

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
  const scopedPlayers = players.filter((player) => isCoach(currentUser) || !selectedAcademyId || player.academy_id === selectedAcademyId);
  const filteredPlayers = scopedPlayers.filter((player) => {
    const query = playerSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      player.full_name,
      player.batches?.batch_name,
      player.centers?.center_name,
    ].filter(Boolean).some((value) => value.toLowerCase().includes(query));
  });

  const resetForm = () => {
    setForm({ ...createEmptyForm(), coach_id: isCoach(currentUser) ? coach?.id || "" : "" });
    setEditingAssessmentId(null);
    setValidationErrors({});
  };

  const handleAcademyChange = (event) => {
    const academyId = event.target.value;
    setSelectedAcademyId(academyId);
    setSelectedPlayerId("");
    setPlayerSearch("");
    setPlayerPickerOpen(false);
    setAssessments([]);
    resetForm();
    setSuccess("");
    setSavedSummary(null);
  };

  const handlePlayerChange = (event) => {
    setSelectedPlayerId(event.target.value);
    setPlayerSearch("");
    setPlayerPickerOpen(false);
    resetForm();
    setSuccess("");
    setSavedSummary(null);
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

  const getAssessmentAverage = (assessment) => {
    const values = scoreFields.map(([name]) => assessment[name]).filter((value) => value !== null && value !== undefined && value !== "");
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
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

      const savedAverage = getAssessmentAverage(payload);
      setSavedSummary({
        playerName: selectedPlayer.full_name,
        assessmentDate: payload.assessment_date,
        coachName: selectedCoach?.full_name || coach?.full_name || "Assigned coach",
        average: savedAverage,
        mode: editingAssessmentId ? "updated" : "saved",
      });
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
      <main className="performance-page" style={styles.page}>
        <header className="performance-compact-header">
          <div>
            <span className="performance-eyebrow">Performance assessments</span>
            <h1>Player Performance Assessments</h1>
          </div>
          <span className="performance-header-badge">
            {assessments.length ? `${assessments.length} assessment${assessments.length === 1 ? "" : "s"}` : "Assessment workspace"}
          </span>
        </header>

        {error ? <p role="alert" style={styles.error}>{error}</p> : null}
        {success ? <p role="status" style={styles.success}>{success}</p> : null}

        <section className="performance-card assessment-scope-card" aria-labelledby="assessment-scope-heading">
          <div className="assessment-scope-heading">
            <div>
              <span className="performance-eyebrow">Assessment scope</span>
              <h2 id="assessment-scope-heading">Select player</h2>
            </div>
            {selectedPlayer ? <span className="assessment-scope-selected">{selectedPlayer.full_name}</span> : null}
          </div>
          <div className="assessment-scope-grid">
            {!isCoach(currentUser) ? (
              <div className="scope-field">
                <label htmlFor="assessment-academy">Academy</label>
                <select id="assessment-academy" value={selectedAcademyId} onChange={handleAcademyChange} disabled={isAcademyOwner(currentUser)}>
                  <option value="">Select academy</option>
                  {(isAcademyOwner(currentUser) ? [{ id: currentUser.academy_id, academy_name: "My academy" }] : academies).map((academy) => (
                    <option key={academy.id} value={academy.id}>{academy.academy_name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className={isCoach(currentUser) ? "scope-field scope-field-wide" : "scope-field"}>
              <label htmlFor="assessment-player-search">Player</label>
              <div className="player-picker">
                <button
                  type="button"
                  id="assessment-player-search"
                  className="player-picker-trigger"
                  onClick={() => setPlayerPickerOpen((open) => !open)}
                  aria-expanded={playerPickerOpen}
                  aria-haspopup="listbox"
                >
                  <span>{selectedPlayer ? `${selectedPlayer.full_name} — ${selectedPlayer.batches?.batch_name || "No batch"}` : "Search or select a player"}</span>
                  <span aria-hidden="true">⌄</span>
                </button>
                {playerPickerOpen ? (
                  <div className="player-picker-menu">
                    <input
                      autoFocus
                      type="search"
                      value={playerSearch}
                      onChange={(event) => setPlayerSearch(event.target.value)}
                      placeholder="Search player, batch or center..."
                      aria-label="Search players"
                    />
                    <div className="player-picker-results" role="listbox" aria-label="Players">
                      {filteredPlayers.length ? filteredPlayers.slice(0, 40).map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          role="option"
                          aria-selected={player.id === selectedPlayerId}
                          className={player.id === selectedPlayerId ? "player-picker-option player-picker-option-selected" : "player-picker-option"}
                          onClick={() => handlePlayerChange({ target: { value: player.id } })}
                        >
                          <strong>{player.full_name}</strong>
                          <span>{player.batches?.batch_name || "No batch"}{player.centers?.center_name ? ` · ${player.centers.center_name}` : ""}</span>
                        </button>
                      )) : (
                        <p className="player-picker-empty">No players match your search.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {!scopedPlayers.length ? <p className="performance-message">No players are currently available in your authorized scope.</p> : null}
        </section>

        {selectedPlayer ? (
          <>
            {savedSummary ? (
              <section className="assessment-saved-summary" role="status" aria-live="polite">
                <div className="saved-summary-icon">✓</div>
                <div className="saved-summary-copy"><strong>Assessment {savedSummary.mode} successfully</strong><span>{savedSummary.playerName} · {formatDate(savedSummary.assessmentDate)} · {savedSummary.coachName}</span></div>
                <div className="saved-summary-score"><strong>{savedSummary.average === null ? "—" : savedSummary.average.toFixed(1)}</strong><span>/ 10 average</span></div>
                <button type="button" className="saved-summary-dismiss" onClick={() => setSavedSummary(null)} aria-label="Dismiss save confirmation">×</button>
              </section>
            ) : null}

            <section className="performance-card assessment-form-card" aria-labelledby="assessment-form-heading">
              <div className="assessment-form-heading">
                <div>
                  <span className="performance-eyebrow">{editingAssessmentId ? "Edit assessment" : "New assessment"}</span>
                  <h2 id="assessment-form-heading">{editingAssessmentId ? "Update performance assessment" : "Record performance assessment"}</h2>
                </div>
                <div className="assessment-player-context">
                  <strong>{selectedPlayer.full_name}</strong>
                  <span>{selectedPlayer.batches?.batch_name || "No batch"}{selectedPlayer.centers?.center_name ? " · " + selectedPlayer.centers.center_name : ""}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="assessment-form" noValidate>
                <div className="assessment-meta-grid">
                  <div className="assessment-meta-field">
                    <label htmlFor="assessment-coach">Assessment coach</label>
                    {!isCoach(currentUser) ? (
                      <select id="assessment-coach" name="coach_id" value={form.coach_id} onChange={handleFormChange}>
                        <option value="">Select coach</option>
                        {accessibleCoaches.map((item) => (
                          <option key={item.id} value={item.id}>{item.full_name}{item.academies?.academy_name ? " — " + item.academies.academy_name : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="assessment-readonly-field">
                        <span className="assessment-avatar">{(coach?.full_name || "C").charAt(0).toUpperCase()}</span>
                        <span><strong>{coach?.full_name || "Assigned coach"}</strong><small>Logged-in coach</small></span>
                      </div>
                    )}
                  </div>
                  <div className="assessment-meta-field">
                    <label htmlFor="assessment-date">Assessment date</label>
                    <input id="assessment-date" name="assessment_date" type="date" value={form.assessment_date} onChange={handleFormChange} aria-invalid={Boolean(validationErrors.assessment_date)} />
                    {validationErrors.assessment_date ? <span className="field-error">{validationErrors.assessment_date}</span> : null}
                  </div>
                  <div className="assessment-completion">
                    <span>Score coverage</span>
                    <strong>{scoreFields.filter(([name]) => form[name] !== "" && form[name] !== null).length}/9 metrics</strong>
                  </div>
                </div>

                <div className="score-entry-header">
                  <div><span className="performance-eyebrow">Assessment score</span><h3>Rate player performance</h3></div>
                  <span className="score-scale">0–10 scale · decimals allowed</span>
                </div>

                <div className="score-matrix">
                  <div className="score-card">
                    <span className="score-card-category">Technical</span>
                    <label htmlFor="ball_control_score">Ball control</label>
                    <div className="score-input-wrap">
                      <input id="ball_control_score" name="ball_control_score" type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form.ball_control_score} onChange={handleFormChange} aria-invalid={Boolean(validationErrors.ball_control_score)} aria-describedby={validationErrors.ball_control_score ? "ball_control_score-error" : undefined} />
                      <span>/10</span>
                    </div>
                    {validationErrors.ball_control_score ? <span id="ball_control_score-error" className="field-error">{validationErrors.ball_control_score}</span> : null}
                  </div>
                  <div className="score-card">
                    <span className="score-card-category">Technical</span>
                    <label htmlFor="passing_score">Passing</label>
                    <div className="score-input-wrap">
                      <input id="passing_score" name="passing_score" type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form.passing_score} onChange={handleFormChange} aria-invalid={Boolean(validationErrors.passing_score)} aria-describedby={validationErrors.passing_score ? "passing_score-error" : undefined} />
                      <span>/10</span>
                    </div>
                    {validationErrors.passing_score ? <span id="passing_score-error" className="field-error">{validationErrors.passing_score}</span> : null}
                  </div>
                  <div className="score-card">
                    <span className="score-card-category">Technical</span>
                    <label htmlFor="dribbling_score">Dribbling</label>
                    <div className="score-input-wrap">
                      <input id="dribbling_score" name="dribbling_score" type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form.dribbling_score} onChange={handleFormChange} aria-invalid={Boolean(validationErrors.dribbling_score)} aria-describedby={validationErrors.dribbling_score ? "dribbling_score-error" : undefined} />
                      <span>/10</span>
                    </div>
                    {validationErrors.dribbling_score ? <span id="dribbling_score-error" className="field-error">{validationErrors.dribbling_score}</span> : null}
                  </div>
                  <div className="score-card">
                    <span className="score-card-category">Technical</span>
                    <label htmlFor="shooting_score">Shooting</label>
                    <div className="score-input-wrap">
                      <input id="shooting_score" name="shooting_score" type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form.shooting_score} onChange={handleFormChange} aria-invalid={Boolean(validationErrors.shooting_score)} aria-describedby={validationErrors.shooting_score ? "shooting_score-error" : undefined} />
                      <span>/10</span>
                    </div>
                    {validationErrors.shooting_score ? <span id="shooting_score-error" className="field-error">{validationErrors.shooting_score}</span> : null}
                  </div>
                  <div className="score-card">
                    <span className="score-card-category">Technical</span>
                    <label htmlFor="defending_score">Defending</label>
                    <div className="score-input-wrap">
                      <input id="defending_score" name="defending_score" type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form.defending_score} onChange={handleFormChange} aria-invalid={Boolean(validationErrors.defending_score)} aria-describedby={validationErrors.defending_score ? "defending_score-error" : undefined} />
                      <span>/10</span>
                    </div>
                    {validationErrors.defending_score ? <span id="defending_score-error" className="field-error">{validationErrors.defending_score}</span> : null}
                  </div>
                  <div className="score-card">
                    <span className="score-card-category">Physical</span>
                    <label htmlFor="speed_score">Speed</label>
                    <div className="score-input-wrap">
                      <input id="speed_score" name="speed_score" type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form.speed_score} onChange={handleFormChange} aria-invalid={Boolean(validationErrors.speed_score)} aria-describedby={validationErrors.speed_score ? "speed_score-error" : undefined} />
                      <span>/10</span>
                    </div>
                    {validationErrors.speed_score ? <span id="speed_score-error" className="field-error">{validationErrors.speed_score}</span> : null}
                  </div>
                  <div className="score-card">
                    <span className="score-card-category">Physical</span>
                    <label htmlFor="stamina_score">Stamina</label>
                    <div className="score-input-wrap">
                      <input id="stamina_score" name="stamina_score" type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form.stamina_score} onChange={handleFormChange} aria-invalid={Boolean(validationErrors.stamina_score)} aria-describedby={validationErrors.stamina_score ? "stamina_score-error" : undefined} />
                      <span>/10</span>
                    </div>
                    {validationErrors.stamina_score ? <span id="stamina_score-error" className="field-error">{validationErrors.stamina_score}</span> : null}
                  </div>
                  <div className="score-card">
                    <span className="score-card-category">Team & discipline</span>
                    <label htmlFor="teamwork_score">Teamwork</label>
                    <div className="score-input-wrap">
                      <input id="teamwork_score" name="teamwork_score" type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form.teamwork_score} onChange={handleFormChange} aria-invalid={Boolean(validationErrors.teamwork_score)} aria-describedby={validationErrors.teamwork_score ? "teamwork_score-error" : undefined} />
                      <span>/10</span>
                    </div>
                    {validationErrors.teamwork_score ? <span id="teamwork_score-error" className="field-error">{validationErrors.teamwork_score}</span> : null}
                  </div>
                  <div className="score-card">
                    <span className="score-card-category">Team & discipline</span>
                    <label htmlFor="discipline_score">Discipline</label>
                    <div className="score-input-wrap">
                      <input id="discipline_score" name="discipline_score" type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form.discipline_score} onChange={handleFormChange} aria-invalid={Boolean(validationErrors.discipline_score)} aria-describedby={validationErrors.discipline_score ? "discipline_score-error" : undefined} />
                      <span>/10</span>
                    </div>
                    {validationErrors.discipline_score ? <span id="discipline_score-error" className="field-error">{validationErrors.discipline_score}</span> : null}
                  </div>
                </div>

                <div className="remarks-field">
                  <div className="remarks-heading">
                    <label htmlFor="coach-remarks">Coach remarks</label>
                    <span>Optional · observations, strengths or focus areas</span>
                  </div>
                  <textarea id="coach-remarks" name="coach_remarks" value={form.coach_remarks} onChange={handleFormChange} rows="3" placeholder="Add coaching observations, strengths or areas to work on..." />
                </div>

                <div className="assessment-form-actions">
                  <div className="assessment-action-hint"><strong>{editingAssessmentId ? "Editing existing assessment" : "Ready to save"}</strong><span>{scoreFields.filter(([name]) => form[name] !== "" && form[name] !== null).length}/9 scores entered</span></div>
                  <div className="assessment-action-buttons">
                  <button type="submit" disabled={saving} className="primary-button">
                    {saving ? "Saving..." : editingAssessmentId ? "Update assessment" : "Save assessment"}
                  </button>
                  {editingAssessmentId ? <button type="button" onClick={resetForm} disabled={saving} className="secondary-button">Cancel edit</button> : null}
                  </div>
                </div>
              </form>
            </section>

            <section className="performance-card assessment-history-card" aria-labelledby="history-heading">
              <div className="assessment-history-heading">
                <div>
                  <span className="performance-eyebrow">Progress over time</span>
                  <h2 id="history-heading">Assessment history</h2>
                </div>
                <span className="assessment-history-count">{assessments.length} record{assessments.length === 1 ? "" : "s"}</span>
              </div>
              {historyLoading ? <p className="performance-message">Loading assessment history...</p> : assessments.length ? (
                <div className="assessment-history-list">
                  {assessments.map((assessment) => {
                    const expanded = expandedHistoryId === assessment.id;
                    return (
                      <article key={assessment.id} className={expanded ? "assessment-history-item expanded" : "assessment-history-item"}>
                        <button type="button" className="assessment-history-summary" onClick={() => setExpandedHistoryId(expanded ? null : assessment.id)} aria-expanded={expanded}>
                          <span><strong>{formatDate(assessment.assessment_date)}</strong><small>{assessment.coaches?.full_name || "Coach not recorded"}</small></span>
                          <span className="history-overall">{(() => {
                            const scores = scoreFields.map(([name]) => assessment[name]).filter((value) => value !== null && value !== undefined && value !== "");
                            const average = scores.length ? scores.reduce((sum, value) => sum + Number(value), 0) / scores.length : null;
                            return average === null ? "—" : average.toFixed(1);
                          })()}<small>/ 10</small></span>
                          <span className="history-summary-remarks">{assessment.coach_remarks || "No remarks"}</span>
                          <span className="history-chevron" aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
                        </button>
                        {expanded ? (
                          <div className="assessment-history-details">
                            <div className="history-score-grid">
                              {scoreFields.map(([name,label]) => <span key={name}><strong>{label}</strong>{assessment[name] ?? "—"}</span>)}
                            </div>
                            {assessment.coach_remarks ? <p className="history-remarks">{assessment.coach_remarks}</p> : null}
                            <div className="history-actions">
                              <button type="button" onClick={() => handleEdit(assessment)} disabled={saving} className="edit-button">Edit</button>
                              <button type="button" onClick={() => handleDelete(assessment)} disabled={saving} className="delete-button">Delete</button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : <p className="performance-message">No performance assessments are available for this player yet.</p>}
            </section>
          </>
        ) : null}
      </main>
    </Layout>
  );
}

const styles = {
  page: { width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "4px 0 30px", boxSizing: "border-box" },
  error: { margin: "0 0 12px", padding: "10px 13px", borderRadius: "8px", background: "#fee2e2", color: "#991b1b" },
  success: { margin: "0 0 12px", padding: "10px 13px", borderRadius: "8px", background: "#dcfce7", color: "#166534" },
  message: { margin: "8px 0 0", color: "#475569", lineHeight: 1.5, overflowWrap: "anywhere" },
};

export default CoachPerformanceAssessments;
