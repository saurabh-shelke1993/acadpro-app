import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { getCoachDashboardData } from "../services/dashboardService";
import { getCurrentUser } from "../utils/auth";
import "./CoachDashboard.css";

const formatDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
};

function CoachDashboard() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const currentUser = await getCurrentUser();
      if (!currentUser) throw new Error("Unable to load the current user.");

      const dashboardData = await getCoachDashboardData(currentUser);
      setUser(currentUser);
      setData(dashboardData);
    } catch (loadError) {
      console.error("Coach dashboard load error:", loadError);
      setError(loadError.message || "Unable to load your coaching dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="coach-dashboard-page coach-dashboard-error">
          <h2>Loading your coaching dashboard…</h2>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="coach-dashboard-page coach-dashboard-error">
          <span className="coach-dashboard-section-kicker">Coach workspace</span>
          <h1>Coach Dashboard</h1>
          <p role="alert">{error}</p>
          <button type="button" className="coach-dashboard-refresh" onClick={loadDashboard}>
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  const today = data.today;

  return (
    <Layout>
      <div className="coach-dashboard-page">
        <header className="coach-dashboard-header">
          <div>
            <span className="coach-dashboard-eyebrow">Coach workspace</span>
            <h1 className="coach-dashboard-title">
              Good morning, {user?.full_name || "Coach"}
            </h1>
            <p className="coach-dashboard-subtitle">
              Your assigned batches, today&apos;s attendance, and player follow-ups in one place.
            </p>
          </div>

          <div className="coach-dashboard-header-meta">
            <span className="coach-dashboard-role">Coach</span>
            <span className="coach-dashboard-helper">{today.dateLabel}</span>
            <button
              type="button"
              className="coach-dashboard-refresh"
              onClick={loadDashboard}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </header>

        <section className="coach-dashboard-section">
          <div className="coach-dashboard-section-heading">
            <div>
              <span className="coach-dashboard-section-kicker">Today</span>
              <h2>Attendance at a glance</h2>
            </div>
            <span className="coach-dashboard-helper">
              Assigned batches only
            </span>
          </div>

          <div className="coach-dashboard-kpis">
            <div className="coach-dashboard-kpi">
              <span className="coach-dashboard-kpi-label">Assigned players</span>
              <strong className="coach-dashboard-kpi-value">{data.totals.players}</strong>
              <span className="coach-dashboard-kpi-note">{data.totals.batches} assigned batches</span>
            </div>
            <div className="coach-dashboard-kpi">
              <span className="coach-dashboard-kpi-label">Present today</span>
              <strong className="coach-dashboard-kpi-value">{today.present}</strong>
              <span className="coach-dashboard-kpi-note">{today.absent} absent</span>
            </div>
            <div className="coach-dashboard-kpi">
              <span className="coach-dashboard-kpi-label">Attendance coverage</span>
              <strong className="coach-dashboard-kpi-value">{today.coverage}%</strong>
              <span className="coach-dashboard-kpi-note">
                {today.recordedBatches} of {data.totals.batches} batches recorded
              </span>
            </div>
            <div className="coach-dashboard-kpi">
              <span className="coach-dashboard-kpi-label">7-day attendance</span>
              <strong className="coach-dashboard-kpi-value">{data.attendance.rate}%</strong>
              <span className="coach-dashboard-kpi-note">
                {data.attendance.records} attendance records
              </span>
            </div>
          </div>
        </section>

        <section className="coach-dashboard-section">
          <div className="coach-dashboard-section-heading">
            <div>
              <span className="coach-dashboard-section-kicker">My coaching</span>
              <h2>My Batches</h2>
            </div>
            <span className="coach-dashboard-helper">Assigned batches only</span>
          </div>

          <div className="coach-dashboard-batches">
            {data.batches.length ? data.batches.map((batch) => (
              <article className="coach-batch-card" key={batch.id}>
                <div className="coach-batch-card-header">
                  <div>
                    <h3 className="coach-batch-name">{batch.name}</h3>
                    <p className="coach-batch-center">{batch.centerName}</p>
                  </div>
                  <span className={`coach-batch-status ${batch.attendanceRecorded
                    ? "coach-batch-status-recorded"
                    : "coach-batch-status-pending"}`}>
                    {batch.attendanceRecorded ? "Recorded" : "Pending"}
                  </span>
                </div>

                <div className="coach-batch-stats">
                  <div className="coach-batch-stat">
                    <span>Players</span>
                    <strong>{batch.playerCount}</strong>
                  </div>
                  <div className="coach-batch-stat">
                    <span>Present</span>
                    <strong>{batch.present}</strong>
                  </div>
                  <div className="coach-batch-stat">
                    <span>Absent</span>
                    <strong>{batch.absent}</strong>
                  </div>
                </div>

                <div className="coach-batch-card-footer">
                  <span className="coach-dashboard-helper">
                    {batch.attendanceRecorded
                      ? "Attendance is on record"
                      : "Attendance still needed"}
                  </span>
                  <Link
                    className="coach-dashboard-link"
                    to={`/coach-attendance?batchId=${batch.id}`}
                  >
                    {batch.attendanceRecorded ? "Review attendance →" : "Mark attendance →"}
                  </Link>
                </div>
              </article>
            )) : (
              <div className="coach-dashboard-panel coach-dashboard-empty">
                No active batches are assigned to you.
              </div>
            )}
          </div>
        </section>

        <section className="coach-dashboard-section coach-dashboard-attention-grid">
          <div className="coach-dashboard-panel">
            <div className="coach-dashboard-panel-header">
              <h3>Players needing attention</h3>
              <p>Attendance patterns from the last 7 days in your assigned scope.</p>
            </div>

            {data.attentionPlayers.length ? (
              <ul className="coach-attention-list">
                {data.attentionPlayers.map((player) => (
                  <li key={`${player.id}-attention`}>
                    <Link
                      className="coach-attention-item"
                      to={`/players?batchId=${player.batchId}`}
                    >
                      <span className="coach-attention-main">
                        <strong>{player.name}</strong>
                        <span>{player.batchName} · {player.reason}</span>
                      </span>
                      <span className="coach-attention-value">{player.rate}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="coach-dashboard-empty">
                No attendance attention items right now.
              </div>
            )}
          </div>

          <div className="coach-dashboard-panel">
            <div className="coach-dashboard-panel-header">
              <h3>Assigned-batch attendance trend</h3>
              <p>7-day attendance rate across your assigned batches.</p>
            </div>

            <div className="coach-dashboard-trend">
              <div className="coach-trend-bars">
                {data.trend.map((item) => (
                  <div
                    className="coach-trend-bar-wrap"
                    key={item.date}
                    title={`${item.label}: ${item.rate}%`}
                  >
                    <div
                      className="coach-trend-bar"
                      style={{ height: `${Math.max(item.rate, item.rate > 0 ? 8 : 2)}%` }}
                    />
                  </div>
                ))}
              </div>

              <div className="coach-trend-labels">
                {data.trend.map((item) => (
                  <span key={`${item.date}-label`}>{item.label}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="coach-dashboard-section coach-dashboard-performance-grid">
          <div className="coach-dashboard-panel">
            <div className="coach-dashboard-panel-header">
              <h3>Recent player performance</h3>
              <p>Latest assessments recorded by you.</p>
            </div>

            {data.recentAssessments.length ? (
              <ul className="coach-performance-list">
                {data.recentAssessments.map((assessment) => (
                  <li className="coach-performance-item" key={assessment.id}>
                    <span>
                      <strong>{assessment.playerName}</strong>
                      <span>{formatDate(assessment.assessmentDate)}</span>
                    </span>
                    <span className="coach-performance-score">
                      {assessment.average === null ? "—" : `${assessment.average}/10`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="coach-dashboard-empty">
                No recent performance assessments found.
              </div>
            )}
          </div>

          <div className="coach-dashboard-panel">
            <div className="coach-dashboard-panel-header">
              <h3>Quick actions</h3>
              <p>Common coaching tasks.</p>
            </div>

            <div className="coach-quick-actions" style={{ padding: "18px" }}>
              <Link className="coach-dashboard-action" to="/coach-attendance">
                Mark attendance
              </Link>
              <Link className="coach-dashboard-action" to="/players">
                My players
              </Link>
              <Link className="coach-dashboard-action" to="/attendance-history">
                Attendance history
              </Link>
              <Link className="coach-dashboard-action" to="/coach-performance-assessments">
                Record performance
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export default CoachDashboard;
