import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { logoutUser } from "../utils/auth";
import Layout from "../components/Layout";
import "./ParentPortal.css";

const ParentPortal = () => {
  const [parent, setParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [attendanceByChildId, setAttendanceByChildId] = useState({});
  const [attendanceHistoryByChildId, setAttendanceHistoryByChildId] = useState({});
  const [paymentHistoryByChildId, setPaymentHistoryByChildId] = useState({});
  const [pendingDuesByChildId, setPendingDuesByChildId] = useState({});
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

      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser();

      if (sessionError || !user) {
        if (mounted) {
          setError("Your session could not be verified. Please sign in again.");
          setLoading(false);
        }
        return;
      }

      const { data: parentRecord, error: parentError } = await supabase
        .from("parents")
        .select("id, parent_name, email, user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (parentError || !parentRecord) {
        if (mounted) {
          setError(
            parentError
              ? "We could not load your parent profile."
              : "No parent profile is linked to this login. Please contact your academy administrator."
          );
          setLoading(false);
        }
        return;
      }

      const { data: childRecords, error: childrenError } = await supabase
        .from("players")
        .select(
          "id, full_name, dob, player_status, gender, registration_number, joining_date, player_code, academy_id, center_id, batch_id, academies(academy_name, academy_logo), centers(center_name), batches(batch_name, age_group, start_time, end_time)"
        )
        .eq("parent_id", parentRecord.id)
        .order("full_name", { ascending: true });

      if (childrenError) {
        if (mounted) {
          setError("We could not load your linked children.");
          setLoading(false);
        }
        return;
      }

      const safeChildren = (childRecords || []).map((child) => ({
        ...child,
        academy: child.academies || null,
        center: child.centers || null,
        batch: child.batches || null,
        coaches: [],
      }));

      const batchIds = [
        ...new Set(safeChildren.map((child) => child.batch_id).filter(Boolean)),
      ];

      if (batchIds.length > 0) {
        const { data: coachRecords, error: coachesError } = await supabase.rpc(
          "get_parent_child_coaches"
        );

        if (coachesError) {
          console.error(
            "Unable to load parent coach assignments:",
            coachesError
          );
        } else {
          const coachesByBatchId = new Map();

          (coachRecords || []).forEach((coachRecord) => {
            if (!coachRecord?.batch_id || !coachRecord?.coach_id) return;

            const batchCoaches = coachesByBatchId.get(coachRecord.batch_id) || [];
            batchCoaches.push({
              id: coachRecord.coach_id,
              full_name: coachRecord.coach_name,
            });
            coachesByBatchId.set(coachRecord.batch_id, batchCoaches);
          });

          safeChildren.forEach((child) => {
            child.coaches = coachesByBatchId.get(child.batch_id) || [];
          });
        }
      }

      const childIds = safeChildren.map((child) => child.id);
      const nextAttendanceByChildId = {};
      const nextAttendanceHistoryByChildId = {};
      const nextPaymentHistoryByChildId = {};
      const nextPendingDuesByChildId = {};

      childIds.forEach((childId) => {
        nextAttendanceByChildId[childId] = {
          total: 0,
          present: 0,
          absent: 0,
          percentage: null,
        };
        nextAttendanceHistoryByChildId[childId] = [];
        nextPaymentHistoryByChildId[childId] = [];
        nextPendingDuesByChildId[childId] = [];
      });

      if (childIds.length > 0) {
        const { data: attendanceRecords, error: attendanceError } = await supabase
          .from("attendance")
          .select("player_id, attendance_date, status, remarks")
          .in("player_id", childIds)
          .or("is_deleted.is.null,is_deleted.eq.false")
          .order("attendance_date", { ascending: false });

        if (attendanceError) {
          console.error("Unable to load parent attendance:", attendanceError);
        }

        (attendanceRecords || []).forEach((record) => {
          const summary = nextAttendanceByChildId[record.player_id];
          const history = nextAttendanceHistoryByChildId[record.player_id];
          if (!summary || !history) return;

          const status = String(record.status || "").toLowerCase();
          summary.total += 1;
          if (status === "present") summary.present += 1;
          if (status === "absent") summary.absent += 1;

          history.push({
            attendance_date: record.attendance_date,
            status: record.status || "Not recorded",
            remarks: record.remarks || "",
          });
        });

        Object.values(nextAttendanceByChildId).forEach((summary) => {
          summary.percentage =
            summary.total > 0
              ? Math.round((summary.present / summary.total) * 100)
              : null;
        });

        const { data: paymentRecords, error: paymentsError } = await supabase
          .from("payments")
          .select(
            "id, player_id, payment_date, amount_paid, payment_mode, transaction_reference, receipt_number, remarks, due_id"
          )
          .in("player_id", childIds)
          .order("payment_date", { ascending: false });

        if (paymentsError) {
          console.error("Unable to load parent payment history:", paymentsError);
        } else {
          (paymentRecords || []).forEach((record) => {
            const history = nextPaymentHistoryByChildId[record.player_id];
            if (history) history.push(record);
          });
        }

        const { data: dueRecords, error: duesError } = await supabase
          .from("payment_dues")
          .select(
            "id, player_id, subscription_id, due_type, due_date, total_amount, paid_amount, remaining_amount, due_status, remarks"
          )
          .in("player_id", childIds)
          .order("due_date", { ascending: true });

        if (duesError) {
          console.error("Unable to load parent payment dues:", duesError);
        } else {
          (dueRecords || []).forEach((record) => {
            const remainingAmount = Number(record.remaining_amount);
            const dueStatus = String(record.due_status || "").toLowerCase();
            const isClearlySettled = ["paid", "settled", "fully paid", "fully_paid"].includes(dueStatus);
            const isOutstanding =
              remainingAmount > 0 ||
              (record.remaining_amount === null && !isClearlySettled);
            const dues = nextPendingDuesByChildId[record.player_id];

            if (isOutstanding && dues) dues.push(record);
          });
        }

        const nextSecondaryErrors = [];
        if (attendanceError) nextSecondaryErrors.push("Attendance data could not be loaded.");
        if (paymentsError) nextSecondaryErrors.push("Payment history could not be loaded.");
        if (duesError) nextSecondaryErrors.push("Outstanding dues could not be loaded.");

        if (mounted && nextSecondaryErrors.length > 0) {
          setSecondaryErrors(nextSecondaryErrors);
        }
      }

      if (mounted) {
        setParent(parentRecord);
        setChildren(safeChildren);
        setAttendanceByChildId(nextAttendanceByChildId);
        setAttendanceHistoryByChildId(nextAttendanceHistoryByChildId);
        setPaymentHistoryByChildId(nextPaymentHistoryByChildId);
        setPendingDuesByChildId(nextPendingDuesByChildId);
        setSelectedChildId(safeChildren[0]?.id || null);
        setLoading(false);
      }
    };

    loadParentPortal();

    return () => {
      mounted = false;
    };
  }, [loadAttempt]);

  const handleLogout = async () => {
    await logoutUser();
  };

  const retryLoad = () => {
    setLoadAttempt((attempt) => attempt + 1);
  };

  const selectedChild =
    children.find((child) => child.id === selectedChildId) || null;
  const selectedAttendance = selectedChild
    ? attendanceByChildId[selectedChild.id]
    : null;
  const selectedPaymentHistory = selectedChild
    ? paymentHistoryByChildId[selectedChild.id] || []
    : [];
  const selectedPendingDues = selectedChild
    ? pendingDuesByChildId[selectedChild.id] || []
    : [];
  const totalOutstandingAmount = selectedPendingDues.reduce(
    (total, due) => total + (Number(due.remaining_amount) || 0),
    0
  );

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

  const formatAmount = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })
      : value || "Not recorded";
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  if (loading) {
    return (
      <Layout>
        <main className="parent-portal-page parent-portal-loading">
          <div className="parent-portal-loading-card">
            <div className="parent-portal-loading-spinner" aria-hidden="true" />
            <h1>Loading your parent portal</h1>
            <p>Loading your profile, children, attendance and financial information…</p>
          </div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="parent-portal-page">
      <header className="parent-portal-header">
        <div>
          <h1 className="parent-portal-title">Parent Portal</h1>
          <p className="parent-portal-subtitle">
            {parent ? `Welcome, ${parent.parent_name || "Parent"}` : "AcadPro"}
          </p>
        </div>
        <div className="parent-portal-header-actions">
          <div
            className="parent-portal-child-count"
            aria-label={children.length + " linked " + (children.length === 1 ? "child" : "children")}
          >
            <strong>{children.length}</strong>
            <span>{children.length === 1 ? "child" : "children"} linked</span>
          </div>
          <button type="button" onClick={handleLogout} className="parent-portal-logout">
            Sign out
          </button>
        </div>
      </header>

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
                    <div className="parent-portal-child-topline">
                      <div className="parent-portal-child-avatar" aria-hidden="true">
                        {(child.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                      {isSelected ? (
                        <span className="parent-portal-selected-badge">Selected</span>
                      ) : null}
                    </div>
                    <span className="parent-portal-child-name">{child.full_name}</span>
                    <span className="parent-portal-child-meta">
                      {child.center?.center_name || child.academy?.academy_name || "Academy profile"}
                    </span>
                    <span className="parent-portal-child-batch">
                      {child.batch?.batch_name || "Batch not assigned"}
                    </span>
                    <span className="parent-portal-child-hint">
                      {isSelected ? "Currently viewing dashboard" : "Select to view dashboard"}
                    </span>
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

              <div className="parent-portal-profile-meta">
                <div>
                  <span>Player code</span>
                  <strong>{selectedChild.player_code || "Not available"}</strong>
                </div>
                <div>
                  <span>Registration number</span>
                  <strong>{selectedChild.registration_number || "Not available"}</strong>
                </div>
              </div>

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

                    <div
                      className="parent-portal-attendance-progress"
                      role="progressbar"
                      aria-label={"Attendance rate " + selectedAttendance.percentage + "%"}
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={Number(selectedAttendance.percentage) || 0}
                    >
                      <div
                        className="parent-portal-attendance-progress-bar"
                        style={{ width: Math.min(Math.max(Number(selectedAttendance.percentage) || 0, 0), 100) + "%" }}
                      />
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

              <div className="parent-portal-subsection parent-portal-financial-summary-section">
                <div className="parent-portal-subsection-heading parent-portal-financial-heading">
                  <div>
                    <p className="parent-portal-section-kicker">Financial status</p>
                    <h3 className="parent-portal-subsection-title">Fees &amp; payments</h3>
                    <p className="parent-portal-section-description">
                      A quick view of this child's current fee position.
                    </p>
                  </div>
                  <div className={`parent-portal-outstanding-summary${totalOutstandingAmount > 0 ? " has-outstanding" : ""}`}>
                    <span>Outstanding</span>
                    <strong>{formatAmount(totalOutstandingAmount)}</strong>
                  </div>
                </div>

                <div className="parent-portal-financial-grid parent-portal-financial-summary-grid">
                  <div className="parent-portal-financial-card">
                    <span className="parent-portal-financial-card-label">Pending dues</span>
                    <strong>{selectedPendingDues.length}</strong>
                    <span className="parent-portal-financial-card-meta">
                      {selectedPendingDues.length === 1 ? "fee requires attention" : "fees require attention"}
                    </span>
                  </div>
                  <div className="parent-portal-financial-card">
                    <span className="parent-portal-financial-card-label">Payments recorded</span>
                    <strong>{selectedPaymentHistory.length}</strong>
                    <span className="parent-portal-financial-card-meta">
                      {selectedPaymentHistory.length === 1 ? "payment in history" : "payments in history"}
                    </span>
                  </div>
                  <div className="parent-portal-financial-card is-clear">
                    <span className="parent-portal-financial-card-label">Payment status</span>
                    <strong>{totalOutstandingAmount > 0 ? "Due" : "Clear"}</strong>
                    <span className="parent-portal-financial-card-meta">
                      {totalOutstandingAmount > 0 ? "Outstanding balance remains" : "No outstanding balance"}
                    </span>
                  </div>
                </div>

                </div>
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
