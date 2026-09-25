import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Layout from "../components/Layout";
import { supabase } from "../supabaseClient";
import { getCurrentUser } from "../utils/auth";
import { getCoachAssignedBatchIds } from "../utils/dataScope";
import { isAcademyOwner, isCoach, isParent, isSuperAdmin } from "../utils/roles";

const skillFields = [
  { key: "ball_control_score", label: "Ball control", category: "technical" },
  { key: "passing_score", label: "Passing", category: "technical" },
  { key: "dribbling_score", label: "Dribbling", category: "technical" },
  { key: "shooting_score", label: "Shooting", category: "technical" },
  { key: "defending_score", label: "Defending", category: "technical" },
  { key: "speed_score", label: "Speed", category: "fitness" },
  { key: "stamina_score", label: "Stamina", category: "fitness" },
  { key: "teamwork_score", label: "Teamwork", category: "teamwork" },
  { key: "discipline_score", label: "Discipline", category: "discipline" },
];

const assessmentColumns = [
  "id",
  "assessment_date",
  "ball_control_score",
  "passing_score",
  "dribbling_score",
  "shooting_score",
  "defending_score",
  "speed_score",
  "stamina_score",
  "teamwork_score",
  "discipline_score",
  "coach_remarks",
  "created_at",
].join(", ");

const playerColumns =
  "id, full_name, academy_id, batch_id, academies(academy_name), batches!inner(batch_name, is_active)";

const getReportCopy = (user) => {
  if (isSuperAdmin(user)) {
    return {
      emptyMessage: "No active players are currently available across the academies you can access.",
      playerPrompt: "Select a player",
      subtitle: "View performance insights across all academies.",
    };
  }

  if (isAcademyOwner(user)) {
    return {
      emptyMessage: "No active players are currently available in your academy.",
      playerPrompt: "Select a player from your academy",
      subtitle: "View performance insights for your academy.",
    };
  }

  if (isParent(user)) {
    return {
      emptyMessage: "No linked players are currently available for this account.",
      playerPrompt: "Select a linked player",
      subtitle: "View performance insights for your linked player(s).",
    };
  }

  return {
    emptyMessage: "No players are currently available in your active assigned batches.",
    playerPrompt: "Select an assigned player",
    subtitle: "View performance insights for your assigned batches.",
  };
};

const toValidScore = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
};

const calculateAverage = (values) => {
  const validValues = values.filter((value) => value !== null);
  if (!validValues.length) return null;
  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
};

const getAssessmentAverage = (assessment, fields = skillFields) =>
  calculateAverage(fields.map(({ key }) => toValidScore(assessment[key])));

const getCategoryAverage = (assessment, category) =>
  getAssessmentAverage(
    assessment,
    skillFields.filter((skill) => skill.category === category)
  );

const formatScore = (score) =>
  score === null || score === undefined ? "—" : Number(score).toFixed(1);

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

const getSkillGroups = (assessment) => {
  if (!assessment) return { strengths: [], improvementAreas: [] };

  return skillFields.reduce(
    (groups, skill) => {
      const score = toValidScore(assessment[skill.key]);
      if (score === null) return groups;
      if (score >= 8) groups.strengths.push(skill.label);
      if (score < 6) groups.improvementAreas.push(skill.label);
      return groups;
    },
    { strengths: [], improvementAreas: [] }
  );
};

function PlayerPerformanceReport() {
  const [currentUser, setCurrentUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadAccessiblePlayers = async () => {
      try {
        setLoading(true);
        setError("");

        const currentUser = await getCurrentUser();
        if (!currentUser || !["super_admin", "academy_owner", "coach", "parent"].includes(currentUser.role)) {
          throw new Error("Your account is not authorized to view performance reports.");
        }

        let accessiblePlayers = [];

        if (isSuperAdmin(currentUser)) {
          const { data, error: playersError } = await supabase
            .from("players")
            .select(playerColumns)
            .eq("is_active", true)
            .eq("batches.is_active", true)
            .order("full_name", { ascending: true });

          if (playersError) throw playersError;
          accessiblePlayers = data || [];
        } else if (isAcademyOwner(currentUser)) {
          if (!currentUser.academy_id) {
            throw new Error("No academy is linked to this academy owner account.");
          }

          const { data, error: playersError } = await supabase
            .from("players")
            .select(playerColumns)
            .eq("academy_id", currentUser.academy_id)
            .eq("is_active", true)
            .eq("batches.is_active", true)
            .order("full_name", { ascending: true });

          if (playersError) throw playersError;
          accessiblePlayers = data || [];
        } else if (isCoach(currentUser)) {
          const { data: coachRecord, error: coachError } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          if (coachError) throw coachError;
          if (!coachRecord) {
            throw new Error("No coach profile is linked to this account.");
          }

          const batchIds = await getCoachAssignedBatchIds(currentUser);
          if (batchIds.length) {
            const { data, error: playersError } = await supabase
              .from("players")
              .select("id, full_name, academy_id, batch_id, academies(academy_name), batches!inner(batch_name, is_active)")
              .in("batch_id", batchIds)
              .eq("is_active", true)
              .eq("batches.is_active", true)
              .order("full_name", { ascending: true });

            if (playersError) throw playersError;
            accessiblePlayers = data || [];
          }
        } else if (isParent(currentUser)) {
          const { data: parentRecord, error: parentError } = await supabase
            .from("parents")
            .select("id")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          if (parentError) throw parentError;
          if (!parentRecord) {
            throw new Error("No parent profile is linked to this account.");
          }

          const { data, error: playersError } = await supabase
            .from("players")
            .select(playerColumns)
            .eq("parent_id", parentRecord.id)
            .eq("is_active", true)
            .eq("batches.is_active", true)
            .order("full_name", { ascending: true });

          if (playersError) throw playersError;
          accessiblePlayers = data || [];
        }

        if (!isMounted) return;
        setCurrentUser(currentUser);
        setPlayers(accessiblePlayers);
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Player performance report load error:", loadError);
        setError(loadError.message || "Unable to load accessible players.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAccessiblePlayers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAssessments = async () => {
      if (!selectedPlayerId) {
        setAssessments([]);
        return;
      }

      if (!players.some((player) => player.id === selectedPlayerId)) {
        setAssessments([]);
        setError("The selected player is not available in your report scope.");
        return;
      }

      try {
        setAssessmentLoading(true);
        setError("");
        const { data, error: assessmentsError } = await supabase
          .from("player_performance_assessments")
          .select(assessmentColumns)
          .eq("player_id", selectedPlayerId)
          .order("assessment_date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false });

        if (assessmentsError) throw assessmentsError;
        if (isMounted) setAssessments(data || []);
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Player performance report assessment load error:", loadError);
        setAssessments([]);
        setError("Unable to load performance assessments. Please try again.");
      } finally {
        if (isMounted) setAssessmentLoading(false);
      }
    };

    loadAssessments();

    return () => {
      isMounted = false;
    };
  }, [players, selectedPlayerId]);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || null;
  const latestAssessment = assessments[0] || null;
  const latestOverall = latestAssessment ? getAssessmentAverage(latestAssessment) : null;
  const latestTechnical = latestAssessment
    ? getCategoryAverage(latestAssessment, "technical")
    : null;
  const latestFitness = latestAssessment
    ? getCategoryAverage(latestAssessment, "fitness")
    : null;
  const latestTeamwork = latestAssessment
    ? toValidScore(latestAssessment.teamwork_score)
    : null;
  const latestDiscipline = latestAssessment
    ? toValidScore(latestAssessment.discipline_score)
    : null;
  const latestSkillData = latestAssessment
    ? skillFields
      .map((skill) => ({ label: skill.label, score: toValidScore(latestAssessment[skill.key]) }))
      .filter((skill) => skill.score !== null)
    : [];
  const trendData = assessments
    .slice()
    .reverse()
    .map((assessment) => ({
      assessment_date: assessment.assessment_date,
      label: formatDate(assessment.assessment_date),
      average: getAssessmentAverage(assessment),
    }))
    .filter((assessment) => assessment.average !== null);
  const { strengths, improvementAreas } = getSkillGroups(latestAssessment);
  const reportCopy = getReportCopy(currentUser);

  if (loading) {
    return <Layout><h2>Loading player performance report...</h2></Layout>;
  }

  return (
    <Layout>
      <main style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.title}>Player Performance Report</h1>
          <p style={styles.subtitle}>{reportCopy.subtitle}</p>
        </header>

        {error ? <p role="alert" style={styles.error}>{error}</p> : null}

        <section style={styles.card}>
          <label htmlFor="report-player" style={styles.label}>Select player</label>
          <select
            id="report-player"
            value={selectedPlayerId}
            onChange={(event) => setSelectedPlayerId(event.target.value)}
            style={styles.input}
          >
            <option value="">{reportCopy.playerPrompt}</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.full_name} — {player.batches?.batch_name || "No batch"}
              </option>
            ))}
          </select>
          {!players.length ? <p style={styles.message}>{reportCopy.emptyMessage}</p> : null}
        </section>

        {selectedPlayer ? (
          <>
            <section style={styles.card} aria-labelledby="player-overview-heading">
              <h2 id="player-overview-heading" style={styles.sectionTitle}>Player overview</h2>
              <div style={styles.overviewGrid}>
                <OverviewItem label="Player" value={selectedPlayer.full_name} />
                <OverviewItem label="Batch" value={selectedPlayer.batches?.batch_name || "Not assigned"} />
                <OverviewItem label="Academy" value={selectedPlayer.academies?.academy_name || "Not available"} />
                <OverviewItem label="Available assessments" value={String(assessments.length)} />
                <OverviewItem label="Most recent assessment" value={latestAssessment ? formatDate(latestAssessment.assessment_date) : "—"} />
              </div>
            </section>

            {assessmentLoading ? <section style={styles.card}><p style={styles.message}>Loading performance assessments...</p></section> : assessments.length ? (
              <>
                <section style={styles.card} aria-labelledby="kpi-heading">
                  <h2 id="kpi-heading" style={styles.sectionTitle}>Latest assessment overview</h2>
                  <div style={styles.kpiGrid}>
                    <KpiCard label="Overall average" value={formatScore(latestOverall)} />
                    <KpiCard label="Technical skills" value={formatScore(latestTechnical)} />
                    <KpiCard label="Fitness" value={formatScore(latestFitness)} />
                    <KpiCard label="Teamwork" value={formatScore(latestTeamwork)} />
                    <KpiCard label="Discipline" value={formatScore(latestDiscipline)} />
                  </div>
                  <p style={styles.caption}>Scores use a 0–10 scale. Missing scores are excluded from averages.</p>
                </section>

                <section style={styles.chartGrid}>
                  <article style={styles.card} aria-labelledby="skill-chart-heading">
                    <h2 id="skill-chart-heading" style={styles.sectionTitle}>Skill-wise scores</h2>
                    {latestSkillData.length ? (
                      <>
                        <div style={styles.chart} aria-label="Horizontal bar chart of latest assessment skill scores on a zero to ten scale">
                          <ResponsiveContainer width="100%" height={Math.max(280, latestSkillData.length * 38)}>
                            <BarChart data={latestSkillData} layout="vertical" margin={{ top: 4, right: 24, left: 20, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" domain={[0, 10]} allowDecimals={false} />
                              <YAxis type="category" dataKey="label" width={94} />
                              <Tooltip formatter={(value) => [formatScore(value), "Score"]} />
                              <Bar dataKey="score" name="Score" fill="#2563eb" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={styles.skillValues} aria-label="Latest skill score values">
                          {latestSkillData.map((skill) => <span key={skill.label}>{skill.label}: <strong>{formatScore(skill.score)}</strong></span>)}
                        </div>
                      </>
                    ) : <p style={styles.message}>No skill scores are available in the latest assessment.</p>}
                  </article>

                  <article style={styles.card} aria-labelledby="trend-chart-heading">
                    <h2 id="trend-chart-heading" style={styles.sectionTitle}>Performance trend</h2>
                    {trendData.length > 1 ? (
                      <div style={styles.chart} aria-label="Line chart of overall average scores by assessment date on a zero to ten scale">
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={trendData} margin={{ top: 10, right: 18, left: 0, bottom: 22 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" angle={-25} textAnchor="end" height={56} tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 10]} tickCount={6} />
                            <Tooltip formatter={(value) => [formatScore(value), "Overall average"]} />
                            <Line type="monotone" dataKey="average" name="Overall average" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : trendData.length === 1 ? (
                      <p style={styles.message}>One valid assessment is available: overall average {formatScore(trendData[0].average)} on {trendData[0].label}.</p>
                    ) : <p style={styles.message}>No assessments with skill scores are available for a performance trend.</p>}
                  </article>
                </section>

                <section style={styles.chartGrid}>
                  <article style={styles.card}>
                    <h2 style={styles.sectionTitle}>Strengths</h2>
                    {strengths.length ? <p style={styles.message}>{strengths.join(", ")}</p> : <p style={styles.message}>No standout strengths recorded yet.</p>}
                  </article>
                  <article style={styles.card}>
                    <h2 style={styles.sectionTitle}>Improvement areas</h2>
                    {improvementAreas.length ? <p style={styles.message}>{improvementAreas.join(", ")}</p> : <p style={styles.message}>No specific improvement areas identified.</p>}
                  </article>
                </section>

                <section style={styles.card} aria-labelledby="remarks-heading">
                  <h2 id="remarks-heading" style={styles.sectionTitle}>Latest coach remarks</h2>
                  <p style={styles.remarks}>{latestAssessment.coach_remarks || "No coach remarks recorded."}</p>
                </section>

                <section style={styles.card} aria-labelledby="history-heading">
                  <h2 id="history-heading" style={styles.sectionTitle}>Assessment history</h2>
                  <div style={styles.historyList}>
                    {assessments.map((assessment) => (
                      <article key={assessment.id} style={styles.historyItem}>
                        <strong>{formatDate(assessment.assessment_date)}</strong>
                        <div style={styles.historyGrid}>
                          <OverviewItem label="Overall average" value={formatScore(getAssessmentAverage(assessment))} />
                          <OverviewItem label="Technical average" value={formatScore(getCategoryAverage(assessment, "technical"))} />
                          <OverviewItem label="Fitness average" value={formatScore(getCategoryAverage(assessment, "fitness"))} />
                          <OverviewItem label="Teamwork" value={formatScore(toValidScore(assessment.teamwork_score))} />
                          <OverviewItem label="Discipline" value={formatScore(toValidScore(assessment.discipline_score))} />
                        </div>
                        {assessment.coach_remarks ? <p style={styles.remarks}>{assessment.coach_remarks}</p> : null}
                      </article>
                    ))}
                  </div>
                </section>
              </>
            ) : <section style={styles.card}><p style={styles.message}>No performance assessments are available for this player yet.</p></section>}
          </>
        ) : null}
      </main>
    </Layout>
  );
}

const OverviewItem = ({ label, value }) => (
  <div style={styles.overviewItem}>
    <span style={styles.overviewLabel}>{label}</span>
    <strong style={styles.overviewValue}>{value}</strong>
  </div>
);

const KpiCard = ({ label, value }) => (
  <div style={styles.kpiCard}>
    <span style={styles.overviewLabel}>{label}</span>
    <strong style={styles.kpiValue}>{value}</strong>
  </div>
);

const styles = {
  page: { width: "100%", maxWidth: "1100px", margin: "0 auto", padding: "4px 0 30px", boxSizing: "border-box" },
  header: { marginBottom: "24px" },
  title: { margin: 0, color: "#0f172a", fontSize: "30px" },
  subtitle: { margin: "8px 0 0", color: "#475569", lineHeight: 1.5 },
  card: { minWidth: 0, marginTop: "18px", padding: "24px", borderRadius: "12px", background: "#fff", boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)", boxSizing: "border-box" },
  sectionTitle: { margin: "0 0 14px", color: "#0f172a", fontSize: "22px" },
  label: { display: "block", marginBottom: "6px", color: "#334155", fontSize: "14px", fontWeight: "bold" },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", boxSizing: "border-box", background: "#fff", color: "#0f172a", font: "inherit" },
  error: { margin: "0 0 16px", padding: "12px 14px", borderRadius: "8px", background: "#fee2e2", color: "#991b1b" },
  message: { margin: 0, color: "#475569", lineHeight: 1.5, overflowWrap: "anywhere" },
  caption: { margin: "14px 0 0", color: "#64748b", fontSize: "14px" },
  overviewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: "16px" },
  overviewItem: { minWidth: 0 },
  overviewLabel: { display: "block", color: "#64748b", fontSize: "13px" },
  overviewValue: { display: "block", marginTop: "5px", color: "#1e293b", overflowWrap: "anywhere" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: "14px" },
  kpiCard: { padding: "16px", border: "1px solid #dbeafe", borderRadius: "10px", background: "#f8fbff" },
  kpiValue: { display: "block", marginTop: "8px", color: "#1d4ed8", fontSize: "26px" },
  chartGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))", gap: "18px" },
  chart: { width: "100%", minWidth: 0 },
  skillValues: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(135px, 100%), 1fr))", gap: "8px 14px", marginTop: "16px", color: "#475569", fontSize: "14px" },
  remarks: { margin: "12px 0 0", color: "#475569", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  historyList: { display: "flex", flexDirection: "column", gap: "12px" },
  historyItem: { padding: "16px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#f8fafc", minWidth: 0 },
  historyGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(135px, 100%), 1fr))", gap: "12px", marginTop: "14px" },
};

export default PlayerPerformanceReport;
