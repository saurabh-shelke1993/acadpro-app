import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { logoutUser } from "../utils/auth";

const ParentPortal = () => {
  const [parent, setParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [attendanceByChildId, setAttendanceByChildId] = useState({});
  const [attendanceHistoryByChildId, setAttendanceHistoryByChildId] = useState({});
  const [paymentHistoryByChildId, setPaymentHistoryByChildId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadParentPortal = async () => {
      setLoading(true);
      setError("");

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
          "id, full_name, dob, player_status, gender, registration_number, joining_date, player_code, academy_id, center_id, batch_id, academies(academy_name), centers(center_name), batches(batch_name, age_group, start_time, end_time)"
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
        coach: null,
      }));

      const batchIds = [
        ...new Set(safeChildren.map((child) => child.batch_id).filter(Boolean)),
      ];

      if (batchIds.length > 0) {
        const { data: assignments } = await supabase
          .from("coach_batch_assignments")
          .select("batch_id, coach_id")
          .in("batch_id", batchIds)
          .eq("is_active", true);

        const coachIds = [
          ...new Set((assignments || []).map((assignment) => assignment.coach_id)),
        ].filter(Boolean);

        if (coachIds.length > 0) {
          const { data: coaches } = await supabase
            .from("coaches")
            .select("id, full_name")
            .in("id", coachIds);

          const coachById = new Map(
            (coaches || []).map((coach) => [coach.id, coach])
          );
          const coachByBatchId = new Map(
            (assignments || []).map((assignment) => [
              assignment.batch_id,
              coachById.get(assignment.coach_id) || null,
            ])
          );

          safeChildren.forEach((child) => {
            child.coach = coachByBatchId.get(child.batch_id) || null;
          });
        }
      }

      const childIds = safeChildren.map((child) => child.id);
      const nextAttendanceByChildId = {};
      const nextAttendanceHistoryByChildId = {};
      const nextPaymentHistoryByChildId = {};

      childIds.forEach((childId) => {
        nextAttendanceByChildId[childId] = {
          total: 0,
          present: 0,
          absent: 0,
          percentage: null,
        };
        nextAttendanceHistoryByChildId[childId] = [];
        nextPaymentHistoryByChildId[childId] = [];
      });

      if (childIds.length > 0) {
        const { data: attendanceRecords } = await supabase
          .from("attendance")
          .select("player_id, attendance_date, status, remarks")
          .in("player_id", childIds)
          .or("is_deleted.is.null,is_deleted.eq.false")
          .order("attendance_date", { ascending: false });

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

        if (!paymentsError) {
          (paymentRecords || []).forEach((record) => {
            const history = nextPaymentHistoryByChildId[record.player_id];
            if (history) history.push(record);
          });
        }
      }

      if (mounted) {
        setParent(parentRecord);
        setChildren(safeChildren);
        setAttendanceByChildId(nextAttendanceByChildId);
        setAttendanceHistoryByChildId(nextAttendanceHistoryByChildId);
        setPaymentHistoryByChildId(nextPaymentHistoryByChildId);
        setSelectedChildId(safeChildren[0]?.id || null);
        setLoading(false);
      }
    };

    loadParentPortal();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await logoutUser();
  };

  const selectedChild =
    children.find((child) => child.id === selectedChildId) || null;
  const selectedAttendance = selectedChild
    ? attendanceByChildId[selectedChild.id]
    : null;
  const selectedAttendanceHistory = selectedChild
    ? attendanceHistoryByChildId[selectedChild.id] || []
    : [];
  const selectedPaymentHistory = selectedChild
    ? paymentHistoryByChildId[selectedChild.id] || []
    : [];

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

  if (loading) {
    return <main style={styles.container}>Loading your parent portal…</main>;
  }

  return (
    <main style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Parent Portal</h1>
          <p style={styles.subtitle}>
            {parent ? `Welcome, ${parent.parent_name || "Parent"}` : "AcadPro"}
          </p>
        </div>
        <button type="button" onClick={handleLogout} style={styles.logoutButton}>
          Sign out
        </button>
      </header>

      {error ? (
        <section role="alert" style={styles.card}>
          <h2 style={styles.sectionTitle}>Unable to load portal</h2>
          <p style={styles.message}>{error}</p>
        </section>
      ) : children.length === 0 ? (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>No linked children yet</h2>
          <p style={styles.message}>
            Your login is valid, but no player profile is currently linked to it.
            Please contact your academy administrator.
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="children-heading">
            <h2 id="children-heading" style={styles.sectionTitle}>Your children</h2>
            <div style={styles.grid}>
              {children.map((child) => {
                const isSelected = child.id === selectedChildId;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => setSelectedChildId(child.id)}
                    aria-pressed={isSelected}
                    style={{
                      ...styles.childCard,
                      ...(isSelected ? styles.selectedChildCard : {}),
                    }}
                  >
                    <div style={styles.avatar} aria-hidden="true">
                      {(child.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <span style={styles.childName}>{child.full_name}</span>
                    <span style={styles.childCardHint}>
                      {isSelected ? "Selected child" : "View dashboard"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedChild && (
            <section aria-labelledby="selected-child-heading" style={styles.dashboardCard}>
              <p style={styles.eyebrow}>Selected child</p>
              <h2 id="selected-child-heading" style={styles.dashboardTitle}>
                {selectedChild.full_name}
              </h2>

              <div style={styles.detailsGrid}>
                <Detail label="Date of birth" value={formatDate(selectedChild.dob)} />
                <Detail label="Joining date" value={formatDate(selectedChild.joining_date)} />
                <Detail label="Status" value={selectedChild.player_status || "Not available"} />
                <Detail label="Gender" value={selectedChild.gender || "Not available"} />
                <Detail label="Registration number" value={selectedChild.registration_number || "Not available"} />
                <Detail label="Player code" value={selectedChild.player_code || "Not available"} />
              </div>

              <div style={styles.subsection}>
                <h3 style={styles.subsectionTitle}>Academy details</h3>
                <div style={styles.detailsGrid}>
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
                  <Detail label="Coach" value={selectedChild.coach?.full_name || "Not assigned"} />
                </div>
              </div>

              <div style={styles.subsection}>
                <h3 style={styles.subsectionTitle}>Attendance summary</h3>
                {selectedAttendance?.total > 0 ? (
                  <div style={styles.attendanceGrid}>
                    <Detail label="Total sessions" value={selectedAttendance.total} />
                    <Detail label="Present" value={selectedAttendance.present} />
                    <Detail label="Absent" value={selectedAttendance.absent} />
                    <Detail label="Attendance percentage" value={`${selectedAttendance.percentage}%`} />
                  </div>
                ) : (
                  <p style={styles.message}>
                    No attendance records are available for this child yet.
                  </p>
                )}
              </div>

              <div style={styles.subsection}>
                <h3 style={styles.subsectionTitle}>Attendance history</h3>
                {selectedAttendanceHistory.length > 0 ? (
                  <div style={styles.historyList}>
                    {selectedAttendanceHistory.map((record, index) => (
                      <div
                        key={`${record.attendance_date}-${index}`}
                        style={styles.historyRow}
                      >
                        <div>
                          <p style={styles.historyDate}>{formatDate(record.attendance_date)}</p>
                          {record.remarks ? (
                            <p style={styles.historyRemarks}>{record.remarks}</p>
                          ) : null}
                        </div>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(String(record.status).toLowerCase() === "present"
                              ? styles.presentBadge
                              : String(record.status).toLowerCase() === "absent"
                                ? styles.absentBadge
                                : {}),
                          }}
                        >
                          {record.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.message}>
                    No attendance history is available for this child yet.
                  </p>
                )}
              </div>

              <div style={styles.subsection}>
                <h3 style={styles.subsectionTitle}>Payment history</h3>
                {selectedPaymentHistory.length > 0 ? (
                  <div style={styles.historyList}>
                    {selectedPaymentHistory.map((payment) => (
                      <div key={payment.id} style={styles.historyRow}>
                        <div>
                          <p style={styles.historyDate}>
                            {formatDate(payment.payment_date)}
                          </p>
                          <p style={styles.paymentAmount}>
                            Amount paid: {formatAmount(payment.amount_paid)}
                          </p>
                          <p style={styles.historyRemarks}>
                            Payment mode: {payment.payment_mode || "Not recorded"}
                          </p>
                          {payment.receipt_number ? (
                            <p style={styles.historyRemarks}>
                              Receipt number: {payment.receipt_number}
                            </p>
                          ) : null}
                          {payment.transaction_reference ? (
                            <p style={styles.historyRemarks}>
                              Transaction reference: {payment.transaction_reference}
                            </p>
                          ) : null}
                          {payment.remarks ? (
                            <p style={styles.historyRemarks}>
                              Remarks: {payment.remarks}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.message}>
                    No payment history is available for this child yet.
                  </p>
                )}
              </div>

              <div style={styles.futureSections}>
                <div style={styles.futureSection}>Payments</div>
                <div style={styles.futureSection}>Profile</div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
};

const Detail = ({ label, value }) => (
  <div>
    <span style={styles.detailLabel}>{label}</span>
    <p style={styles.detailValue}>{value}</p>
  </div>
);

const styles = {
  container: { maxWidth: "1000px", margin: "0 auto", padding: "32px 20px", fontFamily: "Arial, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "28px" },
  title: { margin: 0, fontSize: "30px" },
  subtitle: { margin: "6px 0 0", color: "#666" },
  logoutButton: { padding: "10px 16px", border: "1px solid #ccc", borderRadius: "8px", background: "white", cursor: "pointer" },
  sectionTitle: { margin: "0 0 16px", fontSize: "22px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" },
  childCard: { display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", padding: "20px", border: "1px solid #e5e7eb", borderRadius: "14px", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", cursor: "pointer" },
  selectedChildCard: { border: "2px solid #1a73e8", padding: "19px", background: "#f5f9ff" },
  avatar: { width: "52px", height: "52px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#e8f0fe", color: "#1a73e8", fontSize: "24px", fontWeight: "bold", marginBottom: "14px" },
  childName: { fontSize: "20px", fontWeight: "bold" },
  childCardHint: { marginTop: "8px", color: "#666", fontSize: "14px" },
  dashboardCard: { marginTop: "28px", padding: "24px", border: "1px solid #e5e7eb", borderRadius: "14px", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" },
  eyebrow: { margin: "0 0 6px", color: "#666", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.06em" },
  dashboardTitle: { margin: "0 0 20px", fontSize: "26px" },
  detailsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" },
  attendanceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px" },
  detailLabel: { color: "#666", fontSize: "14px" },
  detailValue: { margin: "6px 0 0", fontSize: "16px", fontWeight: "bold" },
  subsection: { marginTop: "28px", paddingTop: "22px", borderTop: "1px solid #e5e7eb" },
  subsectionTitle: { margin: "0 0 16px", fontSize: "20px" },
  historyList: { display: "flex", flexDirection: "column", gap: "10px" },
  historyRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fafafa" },
  historyDate: { margin: 0, fontWeight: "bold" },
  paymentAmount: { margin: "5px 0 0", fontWeight: "bold" },
  historyRemarks: { margin: "5px 0 0", color: "#666", fontSize: "14px" },
  statusBadge: { padding: "5px 10px", borderRadius: "999px", background: "#e5e7eb", color: "#374151", fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap" },
  presentBadge: { background: "#dcfce7", color: "#166534" },
  absentBadge: { background: "#fee2e2", color: "#991b1b" },
  futureSections: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", margin: "24px 0 16px" },
  futureSection: { padding: "14px", border: "1px dashed #cbd5e1", borderRadius: "8px", color: "#64748b", background: "#f8fafc", textAlign: "center" },
  card: { padding: "24px", border: "1px solid #e5e7eb", borderRadius: "14px", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" },
  message: { margin: 0, color: "#555", lineHeight: 1.5 },
};

export default ParentPortal;
