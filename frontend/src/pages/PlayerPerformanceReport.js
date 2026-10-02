import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import "./PlayerPerformanceReport.css";
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
  "player_id",
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
  "id, full_name, academy_id, center_id, batch_id, academies(academy_name), centers(center_name), batches!inner(batch_name, age_group, start_time, end_time, is_active)";

const getReportCopy = (user) => {
  if (isSuperAdmin(user)) {
    return {
      emptyMessage: "No active players are currently available across the academies you can access.",
      subtitle: "Filter the player scope, then review the top 5 latest performance scores.",
    };
  }

  if (isAcademyOwner(user)) {
    return {
      emptyMessage: "No active players are currently available in your academy.",
      subtitle: "Filter by center and batch, then review player performance.",
    };
  }

  if (isParent(user)) {
    return {
      emptyMessage: "No linked players are currently available for this account.",
      subtitle: "View performance insights for your linked player(s).",
    };
  }

  return {
    emptyMessage: "No players are currently available in your active assigned batches.",
    subtitle: "Filter your assigned scope, then review player performance.",
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

const formatTime = (value) => {
  if (!value) return "—";
  const parts = String(value).split(":");
  const hour = Number(parts[0]);
  if (Number.isNaN(hour)) return value;
  return `${hour % 12 || 12}:${parts[1] || "00"} ${hour >= 12 ? "PM" : "AM"}`;
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
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [assessments, setAssessments] = useState([]);
  const [latestAssessments, setLatestAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [openAssessmentId, setOpenAssessmentId] = useState(null);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let isMounted = true;

    const loadAccessiblePlayers = async () => {
      try {
        setLoading(true);
        setError("");

        const user = await getCurrentUser();
        if (!user || !["super_admin", "academy_owner", "coach", "parent"].includes(user.role)) {
          throw new Error("Your account is not authorized to view performance reports.");
        }

        let accessiblePlayers = [];

        if (isSuperAdmin(user)) {
          const { data, error: playersError } = await supabase
            .from("players")
            .select(playerColumns)
            .eq("is_active", true)
            .eq("batches.is_active", true)
            .order("full_name", { ascending: true });

          if (playersError) throw playersError;
          accessiblePlayers = data || [];
        } else if (isAcademyOwner(user)) {
          if (!user.academy_id) {
            throw new Error("No academy is linked to this academy owner account.");
          }

          const { data, error: playersError } = await supabase
            .from("players")
            .select(playerColumns)
            .eq("academy_id", user.academy_id)
            .eq("is_active", true)
            .eq("batches.is_active", true)
            .order("full_name", { ascending: true });

          if (playersError) throw playersError;
          accessiblePlayers = data || [];
        } else if (isCoach(user)) {
          const { data: coachRecord, error: coachError } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (coachError) throw coachError;
          if (!coachRecord) throw new Error("No coach profile is linked to this account.");

          const batchIds = await getCoachAssignedBatchIds(user);
          if (batchIds.length) {
            const { data, error: playersError } = await supabase
              .from("players")
              .select(playerColumns)
              .in("batch_id", batchIds)
              .eq("is_active", true)
              .eq("batches.is_active", true)
              .order("full_name", { ascending: true });

            if (playersError) throw playersError;
            accessiblePlayers = data || [];
          }
        } else if (isParent(user)) {
          const { data: parentRecord, error: parentError } = await supabase
            .from("parents")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (parentError) throw parentError;
          if (!parentRecord) throw new Error("No parent profile is linked to this account.");

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
        setCurrentUser(user);
        setPlayers(accessiblePlayers);

        if (isSuperAdmin(user)) {
          setSelectedAcademyId("");
        } else if (isAcademyOwner(user)) {
          setSelectedAcademyId(user.academy_id || "");
        } else {
          setSelectedAcademyId(accessiblePlayers[0]?.academy_id || "");
        }

        const requestedPlayerId = searchParams.get("player");
        if (requestedPlayerId && accessiblePlayers.some((player) => player.id === requestedPlayerId)) {
          setSelectedPlayerId(requestedPlayerId);
        }
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
  }, [searchParams]);

  const academyOptions = useMemo(() => {
    const map = new Map();
    players.forEach((player) => {
      if (player.academy_id && player.academies?.academy_name) {
        map.set(player.academy_id, player.academies.academy_name);
      }
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  const centerOptions = useMemo(() => {
    const scope = selectedAcademyId
      ? players.filter((player) => player.academy_id === selectedAcademyId)
      : [];

    const map = new Map();
    scope.forEach((player) => {
      if (player.center_id && player.centers?.center_name) {
        map.set(player.center_id, player.centers.center_name);
      }
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, selectedAcademyId]);

  const batchOptions = useMemo(() => {
    if (!selectedCenterId) return [];

    const scope = players.filter((player) =>
      (!selectedAcademyId || player.academy_id === selectedAcademyId) &&
      player.center_id === selectedCenterId
    );

    const map = new Map();
    scope.forEach((player) => {
      if (player.batch_id && player.batches?.batch_name) {
        map.set(player.batch_id, player.batches.batch_name);
      }
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, selectedAcademyId, selectedCenterId]);

  const scopedPlayers = useMemo(() => {
    if (isSuperAdmin(currentUser) && !selectedAcademyId) return [];

    return players.filter((player) =>
      (!selectedAcademyId || player.academy_id === selectedAcademyId) &&
      (!selectedCenterId || player.center_id === selectedCenterId) &&
      (!selectedBatchId || player.batch_id === selectedBatchId)
    );
  }, [players, currentUser, selectedAcademyId, selectedCenterId, selectedBatchId]);

  useEffect(() => {
    if (selectedCenterId && !centerOptions.some((center) => center.id === selectedCenterId)) {
      setSelectedCenterId("");
      setSelectedBatchId("");
    }
  }, [centerOptions, selectedCenterId]);

  useEffect(() => {
    if (selectedBatchId && !batchOptions.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId("");
    }
  }, [batchOptions, selectedBatchId]);

  useEffect(() => {
    if (selectedPlayerId && !scopedPlayers.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId("");
    }
  }, [scopedPlayers, selectedPlayerId]);

  useEffect(() => {
    let isMounted = true;

    const loadLatestAssessments = async () => {
      const playerIds = scopedPlayers.map((player) => player.id);

      if (!playerIds.length) {
        setLatestAssessments([]);
        return;
      }

      try {
        setPerformanceLoading(true);
        setError("");

        const { data, error: assessmentsError } = await supabase
          .from("player_performance_assessments")
          .select(assessmentColumns)
          .in("player_id", playerIds)
          .order("assessment_date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false });

        if (assessmentsError) throw assessmentsError;

        const latestByPlayer = new Map();
        (data || []).forEach((assessment) => {
          if (!latestByPlayer.has(assessment.player_id)) {
            latestByPlayer.set(assessment.player_id, assessment);
          }
        });

        const ranked = scopedPlayers
          .map((player) => {
            const assessment = latestByPlayer.get(player.id);
            return {
              player,
              assessment,
              average: assessment ? getAssessmentAverage(assessment) : null,
            };
          })
          .filter((item) => item.average !== null)
          .sort((a, b) => {
            if (b.average !== a.average) return b.average - a.average;
            return a.player.full_name.localeCompare(b.player.full_name);
          })
          .slice(0, 5);

        if (isMounted) setLatestAssessments(ranked);
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Top performance load error:", loadError);
        setLatestAssessments([]);
        setError("Unable to load the latest performance results. Please try again.");
      } finally {
        if (isMounted) setPerformanceLoading(false);
      }
    };

    loadLatestAssessments();

    return () => {
      isMounted = false;
    };
  }, [scopedPlayers]);

  useEffect(() => {
    setOpenAssessmentId(null);
  }, [selectedPlayerId]);

  useEffect(() => {
    let isMounted = true;

    const loadSelectedPlayerAssessments = async () => {
      if (!selectedPlayerId || !players.some((player) => player.id === selectedPlayerId)) {
        setAssessments([]);
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

    loadSelectedPlayerAssessments();

    return () => {
      isMounted = false;
    };
  }, [players, selectedPlayerId]);

  const playerOptions = scopedPlayers;
  const selectedPlayer = scopedPlayers.find((player) => player.id === selectedPlayerId) || null;
  const latestAssessment = assessments[0] || null;
  const latestOverall = latestAssessment ? getAssessmentAverage(latestAssessment) : null;
  const latestTechnical = latestAssessment ? getCategoryAverage(latestAssessment, "technical") : null;
  const latestFitness = latestAssessment ? getCategoryAverage(latestAssessment, "fitness") : null;
  const latestTeamwork = latestAssessment ? toValidScore(latestAssessment.teamwork_score) : null;
  const latestDiscipline = latestAssessment ? toValidScore(latestAssessment.discipline_score) : null;

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
  const filterCount = [selectedAcademyId, selectedCenterId, selectedBatchId, selectedPlayerId].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedAcademyId(isAcademyOwner(currentUser) ? currentUser.academy_id || "" : "");
    setSelectedCenterId("");
    setSelectedBatchId("");
    setSelectedPlayerId("");
  };

  const selectTopPlayer = (playerId) => {
    setSelectedPlayerId(playerId);
  };

  if (loading) {
    return <Layout><h2>Loading player performance report...</h2></Layout>;
  }

  return (
    <Layout>
      <main className="performance-page">
        <header className="performance-header">
          <div>
            <div className="performance-eyebrow">Performance</div>
            <h1>Player Performance Report</h1>
            <p>{reportCopy.subtitle}</p>
          </div>
          {selectedPlayer ? (
            <div className="performance-header-badge">
              {assessments.length} assessment{assessments.length === 1 ? "" : "s"}
            </div>
          ) : null}
        </header>

        {error ? <p role="alert" className="performance-error">{error}</p> : null}

        <section className="performance-filter-card" aria-label="Performance report filters">
          <div className="performance-filter-heading">
            <div>
              <span className="performance-section-eyebrow">Report scope</span>
              <h2>Filter performance</h2>
            </div>
            {filterCount > 0 ? (
              <button type="button" className="performance-filter-reset" onClick={resetFilters}>
                Reset filters
              </button>
            ) : null}
          </div>

          <div className="performance-filter-grid">
            {isSuperAdmin(currentUser) ? (
              <label>
                <span>Academy</span>
                <select
                  value={selectedAcademyId}
                  onChange={(event) => {
                    setSelectedAcademyId(event.target.value);
                    setSelectedCenterId("");
                    setSelectedBatchId("");
                    setSelectedPlayerId("");
                  }}
                >
                  <option value="">All academies</option>
                  {academyOptions.map((academy) => (
                    <option key={academy.id} value={academy.id}>{academy.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {!isParent(currentUser) ? (
              <label>
                <span>Center</span>
                <select
                  value={selectedCenterId}
                  onChange={(event) => {
                    setSelectedCenterId(event.target.value);
                    setSelectedBatchId("");
                    setSelectedPlayerId("");
                  }}
                  disabled={isSuperAdmin(currentUser) ? !selectedAcademyId || !centerOptions.length : !centerOptions.length}
                >
                  <option value="">All centers</option>
                  {centerOptions.map((center) => (
                    <option key={center.id} value={center.id}>{center.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {!isParent(currentUser) ? (
              <label>
                <span>Batch</span>
                <select
                  value={selectedBatchId}
                  onChange={(event) => {
                    setSelectedBatchId(event.target.value);
                    setSelectedPlayerId("");
                  }}
                  disabled={!selectedCenterId || !batchOptions.length}
                >
                  <option value="">All batches</option>
                  {batchOptions.map((batch) => (
                    <option key={batch.id} value={batch.id}>{batch.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="performance-player-filter">
              <span>Player</span>
              <select
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
                disabled={!playerOptions.length}
              >
                <option value="">Select a player</option>
                {playerOptions.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="performance-filter-summary">
            <strong>{scopedPlayers.length}</strong>
            <span>player{scopedPlayers.length === 1 ? "" : "s"} in current scope</span>
            {selectedAcademyId ? (
              <span className="performance-scope-chip">
                {players.find((player) => player.academy_id === selectedAcademyId)?.academies?.academy_name || "Selected academy"}
              </span>
            ) : null}
            {selectedCenterId ? (
              <span className="performance-scope-chip">
                {centerOptions.find((center) => center.id === selectedCenterId)?.name}
              </span>
            ) : null}
            {selectedBatchId ? (
              <span className="performance-scope-chip">
                {batchOptions.find((batch) => batch.id === selectedBatchId)?.name}
              </span>
            ) : null}
          </div>
        </section>

        <section className="performance-top-section" aria-labelledby="top-performance-heading">
          <div className="performance-section-header">
            <div>
              <span className="performance-section-eyebrow">Latest assessment</span>
              <h2 id="top-performance-heading">Top 5 Performance</h2>
              <p>Ranked by the latest available overall skill average in the selected scope.</p>
            </div>
            <span className="performance-result-count">{latestAssessments.length} result{latestAssessments.length === 1 ? "" : "s"}</span>
          </div>

          {performanceLoading ? (
            <div className="performance-empty-card"><strong>Loading performance results…</strong><span>Calculating the latest scores for the selected players.</span></div>
          ) : latestAssessments.length ? (
            <div className="performance-top-grid">
              {latestAssessments.map((item, index) => (
                <button
                  type="button"
                  key={item.player.id}
                  className={"performance-top-player " + (selectedPlayerId === item.player.id ? "performance-top-player-selected" : "")}
                  onClick={() => selectTopPlayer(item.player.id)}
                >
                  <span className="performance-rank">{index + 1}</span>
                  <span className="performance-top-player-main">
                    <strong>{item.player.full_name}</strong>
                    <small>{item.player.batches?.batch_name || "No batch"} · {item.player.centers?.center_name || "No center"}</small>
                  </span>
                  <span className="performance-top-score">
                    <strong>{formatScore(item.average)}</strong>
                    <small>/ 10</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="performance-empty-card">
              <strong>
                {isSuperAdmin(currentUser) && !selectedAcademyId
                  ? "Select an academy to view performance results."
                  : scopedPlayers.length
                    ? "No performance assessments found in this scope."
                    : "No players match the selected filters."}
              </strong>
              <span>
                {isSuperAdmin(currentUser) && !selectedAcademyId
                  ? "Choose an academy first. Center and batch filters will then narrow the result set."
                  : scopedPlayers.length
                    ? "Assessments are required before a player can appear in the Top 5."
                    : "Change the academy, center, or batch filters."}
              </span>
            </div>
          )}
        </section>

        {selectedPlayer ? (
          <>
            <section className="performance-player-identity" aria-labelledby="player-identity-heading">
              <div className="performance-player-avatar" aria-hidden="true">
                {selectedPlayer.full_name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join("")}
              </div>
              <div className="performance-player-identity-main">
                <span className="performance-section-eyebrow">Selected player</span>
                <h2 id="player-identity-heading">{selectedPlayer.full_name}</h2>
                <p>
                  {selectedPlayer.batches?.batch_name || "No batch"} ·{" "}
                  {selectedPlayer.centers?.center_name || "No center"} ·{" "}
                  {selectedPlayer.academies?.academy_name || "No academy"}
                </p>
              </div>
              <div className="performance-player-meta">
                <span>Last assessed</span>
                <strong>{latestAssessment ? formatDate(latestAssessment.assessment_date) : "Not assessed"}</strong>
              </div>
            </section>

            {assessmentLoading ? (
              <section className="performance-report-layout">
                <div className="performance-report-main">
                  <section className="performance-card performance-loading-card">
                    <p className="performance-message">Loading performance assessments...</p>
                  </section>
                </div>
                <aside className="performance-report-sidebar" aria-label="Performance snapshot">
                  <div className="performance-snapshot">
                    <span className="performance-section-eyebrow">Performance snapshot</span>
                    <strong className="performance-snapshot-loading">Loading…</strong>
                  </div>
                </aside>
              </section>
            ) : assessments.length ? (
              <section className="performance-report-layout">
                <div className="performance-report-main">
                  <section className="performance-card performance-kpi-card" aria-labelledby="kpi-heading">
                    <div className="performance-card-heading">
                      <div>
                        <span className="performance-section-eyebrow">Latest assessment</span>
                        <h2 id="kpi-heading">Performance overview</h2>
                      </div>
                      <span className="performance-assessment-count">
                        {assessments.length} assessment{assessments.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="kpi-grid">
                      <KpiCard label="Overall average" value={formatScore(latestOverall)} />
                      <KpiCard label="Technical skills" value={formatScore(latestTechnical)} />
                      <KpiCard label="Fitness" value={formatScore(latestFitness)} />
                      <KpiCard label="Teamwork" value={formatScore(latestTeamwork)} />
                      <KpiCard label="Discipline" value={formatScore(latestDiscipline)} />
                    </div>
                    <p className="performance-caption">Scores use a 0–10 scale. Missing scores are excluded from averages.</p>
                  </section>

                  <section className="performance-chart-grid" aria-label="Performance analysis">
                    <article className="performance-card performance-chart-card" aria-labelledby="skill-chart-heading">
                      <div className="performance-card-heading">
                        <div>
                          <span className="performance-section-eyebrow">Latest assessment</span>
                          <h2 id="skill-chart-heading">Skill-wise scores</h2>
                        </div>
                      </div>
                      {latestSkillData.length ? (
                        <>
                          <div className="performance-chart performance-skill-chart" aria-label="Horizontal bar chart of latest assessment skill scores on a zero to ten scale">
                            <ResponsiveContainer width="100%" height={285}>
                              <BarChart data={latestSkillData} layout="vertical" margin={{ top: 4, right: 18, left: 12, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 10]} allowDecimals={false} />
                                <YAxis type="category" dataKey="label" width={84} />
                                <Tooltip formatter={(value) => [formatScore(value), "Score"]} />
                                <Bar dataKey="score" name="Score" fill="#2563eb" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="skill-values" aria-label="Latest skill score values">
                            {latestSkillData.map((skill) => (
                              <span key={skill.label}>{skill.label}: <strong>{formatScore(skill.score)}</strong></span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="performance-message">No skill scores are available in the latest assessment.</p>
                      )}
                    </article>

                    <article className="performance-card performance-chart-card" aria-labelledby="trend-chart-heading">
                      <div className="performance-card-heading">
                        <div>
                          <span className="performance-section-eyebrow">Progress</span>
                          <h2 id="trend-chart-heading">Performance trend</h2>
                        </div>
                      </div>
                      {trendData.length > 1 ? (
                        <div className="performance-chart performance-trend-chart" aria-label="Line chart of overall average scores by assessment date on a zero to ten scale">
                          <ResponsiveContainer width="100%" height={285}>
                            <LineChart data={trendData} margin={{ top: 10, right: 12, left: 0, bottom: 22 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="label" angle={-25} textAnchor="end" height={56} tick={{ fontSize: 11 }} />
                              <YAxis domain={[0, 10]} tickCount={6} />
                              <Tooltip formatter={(value) => [formatScore(value), "Overall average"]} />
                              <Line type="monotone" dataKey="average" name="Overall average" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : trendData.length === 1 ? (
                        <div className="performance-single-trend">
                          <strong>{formatScore(trendData[0].average)} / 10</strong>
                          <span>Overall average on {trendData[0].label}</span>
                        </div>
                      ) : (
                        <p className="performance-message">No assessments with skill scores are available for a performance trend.</p>
                      )}
                    </article>
                  </section>

                  <section className="performance-card" aria-labelledby="remarks-heading">
                    <div className="performance-card-heading">
                      <div>
                        <span className="performance-section-eyebrow">Coach feedback</span>
                        <h2 id="remarks-heading">Latest coach remarks</h2>
                      </div>
                    </div>
                    <p className="performance-remarks">{latestAssessment.coach_remarks || "No coach remarks recorded."}</p>
                  </section>

                  <section className="performance-card performance-history-card" aria-labelledby="history-heading">
                    <div className="performance-card-heading">
                      <div>
                        <span className="performance-section-eyebrow">Progress over time</span>
                        <h2 id="history-heading">Assessment history</h2>
                      </div>
                      <span className="performance-assessment-count">
                        {assessments.length} record{assessments.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="history-list">
                      {assessments.map((assessment) => {
                        const isOpen = openAssessmentId === assessment.id;
                        return (
                          <article key={assessment.id} className={"history-item " + (isOpen ? "history-item-open" : "")}>
                            <button
                              type="button"
                              className="history-summary"
                              onClick={() => setOpenAssessmentId(isOpen ? null : assessment.id)}
                              aria-expanded={isOpen}
                              aria-controls={"assessment-" + assessment.id}
                            >
                              <span className="history-summary-date">{formatDate(assessment.assessment_date)}</span>
                              <span className="history-summary-score">
                                <strong>{formatScore(getAssessmentAverage(assessment))}</strong>
                                <small>/ 10</small>
                              </span>
                              <span className="history-summary-metrics">
                                <span>Technical {formatScore(getCategoryAverage(assessment, "technical"))}</span>
                                <span>Fitness {formatScore(getCategoryAverage(assessment, "fitness"))}</span>
                                <span>Teamwork {formatScore(toValidScore(assessment.teamwork_score))}</span>
                                <span>Discipline {formatScore(toValidScore(assessment.discipline_score))}</span>
                              </span>
                              <span className="history-summary-chevron" aria-hidden="true">{isOpen ? "⌃" : "⌄"}</span>
                            </button>
                            {isOpen ? (
                              <div id={"assessment-" + assessment.id} className="history-details">
                                <div className="history-grid">
                                  <OverviewItem label="Overall average" value={formatScore(getAssessmentAverage(assessment))} />
                                  <OverviewItem label="Technical average" value={formatScore(getCategoryAverage(assessment, "technical"))} />
                                  <OverviewItem label="Fitness average" value={formatScore(getCategoryAverage(assessment, "fitness"))} />
                                  <OverviewItem label="Teamwork" value={formatScore(toValidScore(assessment.teamwork_score))} />
                                  <OverviewItem label="Discipline" value={formatScore(toValidScore(assessment.discipline_score))} />
                                </div>
                                {assessment.coach_remarks ? (
                                  <p className="performance-remarks">{assessment.coach_remarks}</p>
                                ) : (
                                  <p className="performance-history-no-remarks">No coach remarks recorded for this assessment.</p>
                                )}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <aside className="performance-report-sidebar" aria-label="Performance snapshot">
                  <div className="performance-snapshot">
                    <div className="performance-snapshot-header">
                      <div>
                        <span className="performance-section-eyebrow">Quick view</span>
                        <h2>Performance snapshot</h2>
                      </div>
                      <span className="performance-snapshot-date">{formatDate(latestAssessment.assessment_date)}</span>
                    </div>

                    <div className="performance-snapshot-score">
                      <strong>{formatScore(latestOverall)}</strong>
                      <span>/ 10</span>
                    </div>
                    <p className="performance-snapshot-label">Overall average</p>

                    <div className="performance-snapshot-metrics">
                      <SnapshotMetric label="Technical" score={latestTechnical} />
                      <SnapshotMetric label="Fitness" score={latestFitness} />
                      <SnapshotMetric label="Teamwork" score={latestTeamwork} />
                      <SnapshotMetric label="Discipline" score={latestDiscipline} />
                    </div>

                    <div className="performance-snapshot-section">
                      <span className="performance-snapshot-section-title">Strengths</span>
                      {strengths.length ? (
                        <ul className="performance-snapshot-list">
                          {strengths.map((strength) => <li key={strength}>{strength}</li>)}
                        </ul>
                      ) : (
                        <span className="performance-snapshot-muted">No standout strengths yet.</span>
                      )}
                    </div>

                    <div className="performance-snapshot-section">
                      <span className="performance-snapshot-section-title">Focus areas</span>
                      {improvementAreas.length ? (
                        <ul className="performance-snapshot-list performance-snapshot-list-focus">
                          {improvementAreas.map((area) => <li key={area}>{area}</li>)}
                        </ul>
                      ) : (
                        <span className="performance-snapshot-muted">No specific focus areas identified.</span>
                      )}
                    </div>

                    <div className="performance-snapshot-section">
                      <span className="performance-snapshot-section-title">Latest coach remark</span>
                      <p className="performance-snapshot-remarks">
                        {latestAssessment.coach_remarks || "No coach remarks recorded."}
                      </p>
                    </div>
                  </div>
                </aside>
              </section>
            ) : (
              <section className="performance-empty-card performance-no-assessment">
                <strong>No performance assessments are available for this player yet.</strong>
                <span>Create an assessment to populate the player report.</span>
              </section>
            )}
          </>
        ) : null}
      </main>
    </Layout>
  );
}

const OverviewItem = ({ label, value }) => (
  <div className="overview-item">
    <span className="overview-label">{label}</span>
    <strong className="overview-value">{value}</strong>
  </div>
);

const KpiCard = ({ label, value }) => (
  <div className="kpi-card">
    <span className="overview-label">{label}</span>
    <strong className="kpi-value">{value}</strong>
  </div>
);

const SnapshotMetric = ({ label, score }) => (
  <div className="performance-snapshot-metric">
    <div className="performance-snapshot-metric-heading">
      <span>{label}</span>
      <strong>{formatScore(score)}</strong>
    </div>
    <div className="performance-score-track" aria-hidden="true">
      <span style={{ width: `${score === null || score === undefined ? 0 : Math.max(0, Math.min(10, Number(score))) * 10}%` }} />
    </div>
  </div>
);

export default PlayerPerformanceReport;
