import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import "./ParentFinancialOverview.css";

const ParentFinancialOverview = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [parent, setParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [pendingDues, setPendingDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [printingReceiptId, setPrintingReceiptId] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadParent = async () => {
      setLoading(true);
      setError("");

      const { data: { user } = {}, error: sessionError } = await supabase.auth.getUser();
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
          "id, full_name, player_status, academy_id, center_id, batch_id, academies(academy_name, academy_logo), centers(center_name), batches(batch_name, age_group, start_time, end_time)"
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
      }));

      if (mounted) {
        setParent(parentRecord);
        setChildren(safeChildren);
        const requestedChildId = searchParams.get("child");
        const nextChildId =
          safeChildren.some((child) => child.id === requestedChildId)
            ? requestedChildId
            : safeChildren[0]?.id || "";
        setSelectedChildId(nextChildId);
        setLoading(false);
      }
    };

    loadParent();

    return () => {
      mounted = false;
    };
  }, [loadAttempt, searchParams]);

  useEffect(() => {
    let mounted = true;

    const loadFinancialData = async () => {
      if (!selectedChildId) {
        setPaymentHistory([]);
        setPendingDues([]);
        return;
      }

      const [paymentsResult, duesResult] = await Promise.all([
        supabase
          .from("payments")
          .select(
            "id, player_id, payment_date, amount_paid, payment_mode, transaction_reference, receipt_number, remarks, due_id"
          )
          .eq("player_id", selectedChildId)
          .order("payment_date", { ascending: false }),
        supabase
          .from("payment_dues")
          .select(
            "id, player_id, subscription_id, due_type, due_date, total_amount, paid_amount, remaining_amount, due_status, remarks"
          )
          .eq("player_id", selectedChildId)
          .order("due_date", { ascending: true }),
      ]);

      if (!mounted) return;

      if (paymentsResult.error) {
        console.error("Unable to load parent payment history:", paymentsResult.error);
      }
      if (duesResult.error) {
        console.error("Unable to load parent payment dues:", duesResult.error);
      }

      const outstanding = (duesResult.data || []).filter((due) => {
        const remaining = Number(due.remaining_amount);
        const status = String(due.due_status || "").toLowerCase();
        const settled = ["paid", "settled", "fully paid", "fully_paid"].includes(status);
        return remaining > 0 || (due.remaining_amount === null && !settled);
      });

      setPaymentHistory(paymentsResult.data || []);
      setPendingDues(outstanding);
    };

    loadFinancialData();

    return () => {
      mounted = false;
    };
  }, [selectedChildId]);

  const selectedChild = children.find((child) => child.id === selectedChildId) || null;
  const totalOutstanding = useMemo(
    () => pendingDues.reduce((total, due) => total + (Number(due.remaining_amount) || 0), 0),
    [pendingDues]
  );

  const formatDate = (value, includeTime = false) => {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) + (includeTime ? " " + date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "");
  };

  const formatAmount = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })
      : "Not recorded";
  };

  const formatDueType = (value) =>
    String(value || "Due").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const printReceipt = (payment) => {
    if (!payment?.receipt_number) return;

    setPrintingReceiptId(payment.id);

    const popup = window.open("", "_blank", "width=760,height=900");
    if (!popup) {
      setPrintingReceiptId(null);
      window.alert("Please allow pop-ups to print or save the receipt.");
      return;
    }

    const childName = selectedChild?.full_name || "Player";
    const academyName = selectedChild?.academy?.academy_name || "AcadPro";
    const amount = formatAmount(payment.amount_paid);
    const paymentDate = formatDate(payment.payment_date, true);

    popup.document.write(
      `<!doctype html><html><head><title>${escapeHtml(payment.receipt_number)}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:40px;color:#0f172a}
        .receipt{max-width:680px;margin:auto;border:1px solid #dbe3ef;border-radius:12px;padding:32px}
        h1{margin:0 0 6px;font-size:24px}.muted{color:#64748b;font-size:13px}
        .title{margin:28px 0 16px;font-size:18px;font-weight:700}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}
        .item{border:1px solid #e2e8f0;border-radius:8px;padding:12px}
        .label{display:block;color:#64748b;font-size:11px;margin-bottom:5px}.value{font-weight:700}
        .amount{font-size:20px}.footer{margin-top:28px;color:#64748b;font-size:12px}
        @media print{body{margin:0}.receipt{border:0}}
      </style></head><body>
      <div class="receipt">
        <h1>Payment Receipt</h1>
        <div class="muted">${escapeHtml(academyName)}</div>
        <div class="title">Receipt ${escapeHtml(payment.receipt_number)}</div>
        <div class="grid">
          <div class="item"><span class="label">Player</span><span class="value">${escapeHtml(childName)}</span></div>
          <div class="item"><span class="label">Amount</span><span class="value amount">${escapeHtml(amount)}</span></div>
          <div class="item"><span class="label">Payment Date</span><span class="value">${escapeHtml(paymentDate)}</span></div>
          <div class="item"><span class="label">Payment Mode</span><span class="value">${payment.payment_mode || "—"}</span></div>
          <div class="item"><span class="label">Transaction Reference</span><span class="value">${payment.transaction_reference || "—"}</span></div>
          <div class="item"><span class="label">Receipt Number</span><span class="value">${escapeHtml(payment.receipt_number)}</span></div>
        </div>
        <div class="footer">Generated from AcadPro. Use the browser print dialog to print or save as PDF.</div>
      </div>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`
    );
    popup.document.close();
    setTimeout(() => setPrintingReceiptId(null), 500);
  };

  if (loading) {
    return (
      <Layout>
        <main className="parent-finance-page parent-finance-loading">
          <div className="parent-finance-loading-card">
            <div className="parent-finance-spinner" aria-hidden="true" />
            <h1>Loading financial overview</h1>
            <p>Loading your child's dues, payments and receipts…</p>
          </div>
        </main>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <main className="parent-finance-page">
          <section className="parent-finance-state-card">
            <span className="parent-finance-state-icon" aria-hidden="true">!</span>
            <div>
              <span className="parent-finance-kicker">Financial overview</span>
              <h1>Unable to load financial information</h1>
              <p>{error}</p>
              <button type="button" onClick={() => setLoadAttempt((value) => value + 1)}>
                Try again
              </button>
            </div>
          </section>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="parent-finance-page">
        <header className="parent-finance-header">
          <div>
            <span className="parent-finance-kicker">My Family</span>
            <h1>Financial Overview</h1>
            <p>Track fees, outstanding dues, payments and receipts for your child.</p>
          </div>
          <div className="parent-finance-header-meta">
            <strong>{parent?.parent_name || "Parent"}</strong>
            <span>{children.length} {children.length === 1 ? "child" : "children"} linked</span>
          </div>
        </header>

        {children.length > 0 ? (
          <>
            <section className="parent-finance-child-switcher" aria-labelledby="finance-child-heading">
              <div>
                <span className="parent-finance-kicker">Selected child</span>
                <h2 id="finance-child-heading">{selectedChild?.full_name || "Select a child"}</h2>
                {selectedChild ? (
                  <p>
                    {selectedChild.academy?.academy_name || "Academy"} · {selectedChild.center?.center_name || "Center"} · {selectedChild.batch?.batch_name || "Batch"}
                  </p>
                ) : null}
              </div>
              <select
                aria-label="Select child"
                value={selectedChildId}
                onChange={(event) => {
                  const childId = event.target.value;
                  setSelectedChildId(childId);
                  setSearchParams(childId ? { child: childId } : {});
                }}
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>{child.full_name}</option>
                ))}
              </select>
            </section>

            <section className="parent-finance-kpi-grid" aria-label="Financial summary">
              <div className={`parent-finance-kpi parent-finance-kpi-outstanding${totalOutstanding > 0 ? " has-outstanding" : ""}`}>
                <span>Outstanding</span>
                <strong>{formatAmount(totalOutstanding)}</strong>
                <small>{pendingDues.length} {pendingDues.length === 1 ? "pending due" : "pending dues"}</small>
              </div>
              <div className="parent-finance-kpi">
                <span>Payments recorded</span>
                <strong>{paymentHistory.length}</strong>
                <small>{paymentHistory.length === 1 ? "payment" : "payments"} in history</small>
              </div>
              <div className={`parent-finance-kpi ${totalOutstanding > 0 ? "is-due" : "is-clear"}`}>
                <span>Payment status</span>
                <strong>{totalOutstanding > 0 ? "Due" : "Clear"}</strong>
                <small>{totalOutstanding > 0 ? "Outstanding balance remains" : "No outstanding balance"}</small>
              </div>
            </section>

            <section className="parent-finance-section" aria-labelledby="outstanding-heading">
              <div className="parent-finance-section-heading">
                <div>
                  <span className="parent-finance-kicker">Fees</span>
                  <h2 id="outstanding-heading">Outstanding dues</h2>
                  <p>Fees that still have a remaining balance.</p>
                </div>
                <span className="parent-finance-count">{pendingDues.length}</span>
              </div>

              {pendingDues.length > 0 ? (
                <div className="parent-finance-due-list">
                  {pendingDues.map((due) => (
                    <article key={due.id} className="parent-finance-due-card">
                      <div className="parent-finance-card-topline">
                        <div>
                          <strong>{formatDueType(due.due_type)}</strong>
                          <span>Due date: {formatDate(due.due_date)}</span>
                        </div>
                        <span className={`parent-finance-status parent-finance-status-${String(due.due_status || "pending").toLowerCase()}`}>
                          {due.due_status || "Pending"}
                        </span>
                      </div>
                      <div className="parent-finance-amount-grid">
                        <div><span>Total</span><strong>{formatAmount(due.total_amount)}</strong></div>
                        <div><span>Paid</span><strong>{formatAmount(due.paid_amount)}</strong></div>
                        <div className="is-remaining"><span>Remaining</span><strong>{formatAmount(due.remaining_amount)}</strong></div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="parent-finance-empty">
                  <strong>No outstanding dues</strong>
                  <p>Your child's current fee balance is clear.</p>
                </div>
              )}
            </section>

            <section className="parent-finance-section" aria-labelledby="payment-history-heading">
              <div className="parent-finance-section-heading">
                <div>
                  <span className="parent-finance-kicker">Ledger</span>
                  <h2 id="payment-history-heading">Payment history</h2>
                  <p>Recorded payments and their transaction references.</p>
                </div>
                <span className="parent-finance-count">{paymentHistory.length}</span>
              </div>

              {paymentHistory.length > 0 ? (
                <div className="parent-finance-payment-list">
                  {paymentHistory.map((payment) => (
                    <article key={payment.id} className="parent-finance-payment-card">
                      <div className="parent-finance-card-topline">
                        <div>
                          <strong>{formatDate(payment.payment_date, true)}</strong>
                          <span>{payment.payment_mode || "Payment"}</span>
                        </div>
                        <strong className="parent-finance-payment-amount">{formatAmount(payment.amount_paid)}</strong>
                      </div>
                      <div className="parent-finance-payment-grid">
                        <div><span>Transaction</span><strong>{payment.transaction_reference || "Not available"}</strong></div>
                        <div><span>Receipt</span><strong>{payment.receipt_number || "Not issued"}</strong></div>
                        <div><span>Remarks</span><strong>{payment.remarks || "—"}</strong></div>
                      </div>
                      {payment.receipt_number ? (
                        <button
                          type="button"
                          className="parent-finance-receipt-button"
                          onClick={() => printReceipt(payment)}
                          disabled={printingReceiptId === payment.id}
                        >
                          {printingReceiptId === payment.id ? "Preparing receipt…" : "Print / Save PDF"}
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="parent-finance-empty">
                  <strong>No payments recorded</strong>
                  <p>Payment transactions will appear here after collection.</p>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="parent-finance-state-card">
            <span className="parent-finance-state-icon" aria-hidden="true">⌂</span>
            <div>
              <span className="parent-finance-kicker">Family profile</span>
              <h2>No linked children yet</h2>
              <p>Your login is valid, but no player profile is currently linked to it.</p>
            </div>
          </section>
        )}
      </main>
    </Layout>
  );
};

export default ParentFinancialOverview;
