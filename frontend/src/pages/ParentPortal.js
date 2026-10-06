import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import "./ParentPortal.css";
import {
  getAttendanceSummaries,
  getParentContext,
} from "../services/parentPortalService";

const ParentPortal = () => {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [attendanceByChildId, setAttendanceByChildId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [secondaryErrors, setSecondaryErrors] = useState([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const loadParentPortal = async () => {
      setLoading(true);
      setError("");
      setSecondaryErrors([]);

      try {
        const { children, coachError } = await getParentContext();
        const childIds = children.map((child) => child.id);

        const attendanceResult = await getAttendanceSummaries(childIds);

        if (!mounted) return;

        const nextSecondaryErrors = [];
        if (coachError) nextSecondaryErrors.push("Coach assignments could not be loaded.");
        if (attendanceResult.error) nextSecondaryErrors.push("Attendance data could not be loaded.");

        setChildren(children);
        setAttendanceByChildId(attendanceResult.summaries);
        setSecondaryErrors(nextSecondaryErrors);
        setSelectedChildId(children[0]?.id || null);
        setLoading(false);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError.message || "We could not load your parent portal.");
        setLoading(false);
      }
    };

    loadParentPortal();

    return () => {
      mounted = false;
    };
  }, [loadAttempt]);


  const retryLoad = () => {
    setLoadAttempt((attempt) => attempt + 1);
  };

  const selectedChild =
    children.find((child) => child.id === selectedChildId) || null;
  const selectedAttendance = selectedChild
    ? attendanceByChildId[selectedChild.id]
    : null;
  const formatDate = (value) => {
    if (!value) return "Not available";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (value) => (value ? value.slice(0, 5) : "Not available");

  if (loading) {
    return (
      <Layout>
        <main className="parent-portal-page parent-portal-loading">
          <div className="parent-portal-loading-card">
            <div className="parent-portal-loading-spinner" aria-hidden="true" />
            <h1>Loading your parent portal</h1>
            <p>Loading your profile, children and attendance…</p>
          </div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="parent-portal-page">

      {secondaryErrors.length > 0 ? (
        <section className="parent-portal-data-warning" role="status" aria-live="polite">
          <div className="parent-portal-data-warning-icon" aria-hidden="true">!</div>
          <div className="parent-portal-data-warning-content">
            <strong>Some portal data is temporarily unavailable</strong>
            <p>{secondaryErrors.join(" ")}</p>
          </div>
          <button type="button" onClick={retryLoad} className="parent-portal-secondary-button">
            Retry
          </button>
        </section>
      ) : null}

      {error ? (
        <section role="alert" className="parent-portal-state-card parent-portal-error-state">
          <div className="parent-portal-state-icon parent-portal-state-icon-error" aria-hidden="true">!</div>
          <div className="parent-portal-state-content">
            <p className="parent-portal-section-kicker">Something went wrong</p>
            <h2 className="parent-portal-section-title">Unable to load portal</h2>
            <p className="parent-portal-message">{error}</p>
            <button type="button" onClick={retryLoad} className="parent-portal-secondary-button">
              Try again
            </button>
          </div>
        </section>
      ) : children.length === 0 ? (
        <section className="parent-portal-state-card parent-portal-empty-state">
          <div className="parent-portal-state-icon" aria-hidden="true">⌂</div>
          <div className="parent-portal-state-content">
            <p className="parent-portal-section-kicker">Family profile</p>
            <h2 className="parent-portal-section-title">No linked children yet</h2>
            <p className="parent-portal-message">
            Your login is valid, but no player profile is currently linked to it.
            Please contact your academy administrator.
            </p>
            <button type="button" onClick={retryLoad} className="parent-portal-secondary-button">
              Refresh
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="parent-portal-topbar" aria-labelledby="parent-portal-title">
            <div>
              <p className="parent-portal-section-kicker">Parent portal</p>
              <h1 id="parent-portal-title" className="parent-portal-topbar-title">Family dashboard</h1>
            </div>
            {selectedChild ? (
              <div className="parent-portal-topbar-child">
                <span>Viewing</span>
                <strong>{selectedChild.full_name}</strong>
                <span>{selectedChild.center?.center_name || selectedChild.academy?.academy_name || "Academy profile"}</span>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="children-heading">
            <h2 id="children-heading" className="parent-portal-section-title">Your children</h2>
            <div className="parent-portal-children-grid">
              {children.map((child) => {
                const isSelected = child.id === selectedChildId;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => setSelectedChildId(child.id)}
                    aria-pressed={isSelected}
                    className={`parent-portal-child-card${isSelected ? " is-selected" : ""}`}
                  >
                    <div className="parent-portal-child-avatar" aria-hidden="true">
                      {(child.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="parent-portal-child-selection-content">
                      <span className="parent-portal-child-name">{child.full_name}</span>
                      <span className="parent-portal-child-context">
                        {child.center?.center_name || child.academy?.academy_name || "Academy profile"}
                        <span aria-hidden="true">•</span>
                        {child.batch?.batch_name || "Batch not assigned"}
                      </span>
                    </div>
                    {isSelected ? (
                      <span className="parent-portal-selected-badge">Selected</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          {selectedChild && (
            <section aria-labelledby="selected-child-heading" className="parent-portal-dashboard-card">
              <div className="parent-portal-profile-hero">
                <div className="parent-portal-profile-avatar">
                  {selectedChild.academy?.academy_logo ? (
                    <img
                      src={selectedChild.academy.academy_logo}
                      alt={`Academy logo`}
                    />
                  ) : (
                    <span aria-hidden="true">
                      {(selectedChild.full_name || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="parent-portal-profile-identity">
                  <p className="parent-portal-eyebrow">Selected child</p>
                  <h2 id="selected-child-heading" className="parent-portal-dashboard-title">
                    {selectedChild.full_name}
                  </h2>
                  <p className="parent-portal-profile-context">
                    {selectedChild.academy?.academy_name || "Academy not available"}
                    <span aria-hidden="true">•</span>
                    {selectedChild.center?.center_name || "Center not assigned"}
                  </p>
                </div>
                <span className={`parent-portal-player-status parent-portal-player-status-${String(selectedChild.player_status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                  {selectedChild.player_status || "Status unavailable"}
                </span>
              </div>

              <div className="parent-portal-profile-grid">
              <div className="parent-portal-subsection parent-portal-profile-section">
                <div className="parent-portal-subsection-heading">
                  <div>
                    <p className="parent-portal-section-kicker">Player profile</p>
                    <h3 className="parent-portal-subsection-title">Personal information</h3>
                  </div>
                </div>
                <div className="parent-portal-details-grid">
                  <Detail label="Date of birth" value={formatDate(selectedChild.dob)} />
                  <Detail label="Joining date" value={formatDate(selectedChild.joining_date)} />
                  <Detail label="Gender" value={selectedChild.gender || "Not available"} />
                  <Detail label="Player status" value={selectedChild.player_status || "Not available"} />
                </div>
              </div>

              <div className="parent-portal-subsection parent-portal-profile-section">
                <div className="parent-portal-subsection-heading">
                  <div>
                    <p className="parent-portal-section-kicker">Training profile</p>
                    <h3 className="parent-portal-subsection-title">Academy &amp; training</h3>
                  </div>
                </div>
                <div className="parent-portal-details-grid">
                  <Detail label="Academy" value={selectedChild.academy?.academy_name || "Not available"} />
                  <Detail label="Center" value={selectedChild.center?.center_name || "Not assigned"} />
                  <Detail label="Batch" value={selectedChild.batch?.batch_name || "Not assigned"} />
                  <Detail label="Age group" value={selectedChild.batch?.age_group || "Not available"} />
                  <Detail
                    label="Training time"
                    value={
                      selectedChild.batch
                        ? `${formatTime(selectedChild.batch.start_time)} – ${formatTime(selectedChild.batch.end_time)}`
                        : "Not available"
                    }
                  />
                  <Detail
                    label="Coaches"
                    value={
                      selectedChild.coaches.length > 0
                        ? selectedChild.coaches
                            .map((coach) => coach.full_name)
                            .filter(Boolean)
                            .join(", ")
                        : "Not assigned"
                    }
                  />
                </div>
              </div>
              </div>
              <div className="parent-portal-subsection parent-portal-attendance-section">
                <div className="parent-portal-subsection-heading">
                  <div>
                    <p className="parent-portal-section-kicker">Training attendance</p>
                    <h3 className="parent-portal-subsection-title">Attendance summary</h3>
                  </div>
                  {selectedAttendance?.total > 0 ? (
                    <span className="parent-portal-attendance-rate">
                      {selectedAttendance.percentage}% attendance
                    </span>
                  ) : null}
                </div>

                {selectedAttendance?.total > 0 ? (
                  <>
                    <div className="parent-portal-attendance-layout">
                      <div className="parent-portal-attendance-summary">
                    <div className="parent-portal-attendance-grid">
                      <div className="parent-portal-attendance-stat">
                        <span>Total sessions</span>
                        <strong>{selectedAttendance.total}</strong>
                      </div>
                      <div className="parent-portal-attendance-stat is-present">
                        <span>Present</span>
                        <strong>{selectedAttendance.present}</strong>
                      </div>
                      <div className="parent-portal-attendance-stat is-absent">
                        <span>Absent</span>
                        <strong>{selectedAttendance.absent}</strong>
                      </div>
                      <div className="parent-portal-attendance-stat is-rate">
                        <span>Attendance rate</span>
                        <strong>{selectedAttendance.percentage}%</strong>
                      </div>
                      </div>
                    </div>

                      <div className="parent-portal-attendance-chart-wrap">
                        <div
                          className="parent-portal-attendance-chart"
                          style={{
                            background: `conic-gradient(var(--ap-primary-600) ${Number(selectedAttendance.percentage) || 0}%, var(--ap-danger-100) 0)`
                          }}
                          role="img"
                          aria-label={`Attendance chart: ${selectedAttendance.percentage}% present and ${100 - Number(selectedAttendance.percentage)}% absent`}
                        >
                          <div className="parent-portal-attendance-chart-center">
                            <strong>{selectedAttendance.percentage}%</strong>
                            <span>Attendance</span>
                          </div>
                        </div>
                        <div className="parent-portal-attendance-chart-legend">
                          <span><i className="is-present" aria-hidden="true" /> Present <strong>{selectedAttendance.present}</strong></span>
                          <span><i className="is-absent" aria-hidden="true" /> Absent <strong>{selectedAttendance.absent}</strong></span>
                        </div>
                      </div>
                    </div>


                  </>
                ) : (
                  <div className="parent-portal-attendance-empty">
                    <span className="parent-portal-attendance-empty-icon" aria-hidden="true">✓</span>
                    <div>
                      <strong>No attendance records yet</strong>
                      <p className="parent-portal-message">
                        Attendance information will appear here once sessions are recorded for this child.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="parent-portal-subsection parent-portal-performance-section">
                <div className="parent-portal-performance">
                  <div className="parent-portal-performance-icon" aria-hidden="true">★</div>
                  <div className="parent-portal-performance-content">
                    <p className="parent-portal-section-kicker">Development</p>
                    <h3 className="parent-portal-performance-title">Player Performance</h3>
                    <p className="parent-portal-performance-message">
                      Review performance assessments, skill trends, coach remarks, strengths, and improvement areas for {selectedChild.full_name}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/player-performance-report?player=${encodeURIComponent(selectedChild.id)}`)}
                    className="parent-portal-performance-button"
                  >
                    View Performance
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
      </main>
    </Layout>
  );
};

const Detail = ({ label, value }) => (
  <div>
    <span className="parent-portal-detail-label">{label}</span>
    <p className="parent-portal-detail-value">{value}</p>
  </div>
);


export default ParentPortal;
