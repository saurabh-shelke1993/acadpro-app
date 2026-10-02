import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import "./ParentFinancialOverview.css";
import { getChildFinancialData, getParentContext } from "../services/parentPortalService";

const ParentFinancialOverview = () => {
  const [searchParams, setSearchParams] = useSearchParams();
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

      try {
        const { children } = await getParentContext();

        if (!mounted) return;

        const requestedChildId = searchParams.get("child");
        const nextChildId =
          children.some((child) => child.id === requestedChildId)
            ? requestedChildId
            : children[0]?.id || "";

        setChildren(children);
        setSelectedChildId(nextChildId);
        setLoading(false);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError.message || "We could not load your parent profile.");
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

      const result = await getChildFinancialData(selectedChildId);

      if (!mounted) return;

      if (result.errors.length > 0) {
        console.error("Unable to load parent financial data:", result.errors);
      }

      setPaymentHistory(result.paymentHistory);
      setPendingDues(result.pendingDues);
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

  const [expandedPaymentIds, setExpandedPaymentIds] = useState(() => new Set());
  const [showAllPayments, setShowAllPayments] = useState(false);

  const sortedPendingDues = useMemo(
    () =>
      [...pendingDues].sort((a, b) => {
        const aDate = a?.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
        const bDate = b?.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
        return aDate - bDate;
      }),
    [pendingDues]
  );

  const sortedPaymentHistory = useMemo(
    () =>
      [...paymentHistory].sort((a, b) => {
        const aDate = a?.payment_date ? new Date(a.payment_date).getTime() : 0;
        const bDate = b?.payment_date ? new Date(b.payment_date).getTime() : 0;
        return bDate - aDate;
      }),
    [paymentHistory]
  );

  const nextDue = sortedPendingDues[0] || null;
  const lastPayment = sortedPaymentHistory[0] || null;
  const visiblePayments = showAllPayments ? sortedPaymentHistory : sortedPaymentHistory.slice(0, 5);
  const hasMorePayments = sortedPaymentHistory.length > 5;

  const togglePaymentDetails = (paymentId) => {
    setExpandedPaymentIds((current) => {
      const next = new Set(current);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  };

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
        {children.length > 0 ? (
          <>
            <header className="parent-finance-page-heading">
              <div>
                <span className="parent-finance-kicker">My Family</span>
                <h1>Financial Overview</h1>
                <p>Fees, dues and payments for your child.</p>
              </div>
              <label className="parent-finance-child-selector">
                <span>Child</span>
                <select
                  aria-label="Select child"
                  value={selectedChildId}
                  onChange={(event) => {
                    const childId = event.target.value;
                    setExpandedPaymentIds(new Set());
                    setShowAllPayments(false);
                    setSelectedChildId(childId);
                    setSearchParams(childId ? { child: childId } : {});
                  }}
                >
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>{child.full_name}</option>
                  ))}
                </select>
              </label>
            </header>

            {selectedChild ? (
              <section className="parent-finance-child-context" aria-label="Selected child">
                <div>
                  <span className="parent-finance-kicker">Selected child</span>
                  <h2>{selectedChild.full_name}</h2>
                  <p>
                    {selectedChild.academy?.academy_name || "Academy"} · {selectedChild.center?.center_name || "Center"} · {selectedChild.batch?.batch_name || "Batch"}
                  </p>
                </div>
                <span className={`parent-finance-child-status parent-finance-child-status-${String(selectedChild.player_status || "active").toLowerCase().replace(/\s+/g, "-")}`}>
                  {selectedChild.player_status || "Active"}
                </span>
              </section>
            ) : null}

            <section className="parent-finance-summary-grid" aria-label="Financial snapshot">
              <article className={`parent-finance-summary-card parent-finance-summary-outstanding${totalOutstanding > 0 ? " has-value" : ""}`}>
                <span>Outstanding</span>
                <strong>{formatAmount(totalOutstanding)}</strong>
                <small>
                  {pendingDues.length > 0
                    ? `${pendingDues.length} ${pendingDues.length === 1 ? "pending due" : "pending dues"}`
                    : "All dues cleared"}
                </small>
              </article>

              <article className="parent-finance-summary-card">
                <span>Next due</span>
                <strong>{nextDue ? formatAmount(nextDue.remaining_amount) : "₹0.00"}</strong>
                <small>{nextDue ? `Due ${formatDate(nextDue.due_date)}` : "Nothing due right now"}</small>
              </article>

              <article className="parent-finance-summary-card">
                <span>Last payment</span>
                <strong>{lastPayment ? formatAmount(lastPayment.amount_paid) : "—"}</strong>
                <small>{lastPayment ? formatDate(lastPayment.payment_date, true) : "No payments recorded"}</small>
              </article>
            </section>

            <section className="parent-finance-section parent-finance-dues-section" aria-labelledby="outstanding-heading">
              <div className="parent-finance-section-heading">
                <div>
                  <span className="parent-finance-kicker">Fees</span>
                  <h2 id="outstanding-heading">Outstanding dues</h2>
                </div>
                <span className="parent-finance-count">{pendingDues.length}</span>
              </div>

              {sortedPendingDues.length > 0 ? (
                <div className="parent-finance-due-list">
                  {sortedPendingDues.map((due) => (
                    <article key={due.id} className="parent-finance-due-row">
                      <div className="parent-finance-due-main">
                        <strong>{formatDueType(due.due_type)}</strong>
                        <span>Due {formatDate(due.due_date)}</span>
                      </div>
                      <span className={`parent-finance-status parent-finance-status-${String(due.due_status || "pending").toLowerCase()}`}>
                        {due.due_status || "Pending"}
                      </span>
                      <div className="parent-finance-due-total">
                        <span>Total</span>
                        <strong>{formatAmount(due.total_amount)}</strong>
                      </div>
                      <div className="parent-finance-due-paid">
                        <span>Paid</span>
                        <strong>{formatAmount(due.paid_amount)}</strong>
                      </div>
                      <div className="parent-finance-due-remaining">
                        <span>Remaining</span>
                        <strong>{formatAmount(due.remaining_amount)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="parent-finance-empty parent-finance-empty-success">
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
                </div>
                <span className="parent-finance-count">{paymentHistory.length}</span>
              </div>

              {sortedPaymentHistory.length > 0 ? (
                <>
                  <div className="parent-finance-payment-table" role="table" aria-label="Payment history">
                    <div className="parent-finance-payment-table-header" role="row">
                      <span>Date</span>
                      <span>Mode</span>
                      <span>Amount</span>
                      <span>Receipt</span>
                      <span aria-hidden="true"></span>
                    </div>

                    {visiblePayments.map((payment) => {
                      const isExpanded = expandedPaymentIds.has(payment.id);
                      return (
                        <div key={payment.id} className="parent-finance-payment-item">
                          <button
                            type="button"
                            className={`parent-finance-payment-row${isExpanded ? " is-expanded" : ""}`}
                            onClick={() => togglePaymentDetails(payment.id)}
                            aria-expanded={isExpanded}
                          >
                            <span>{formatDate(payment.payment_date)}</span>
                            <span>{payment.payment_mode || "Payment"}</span>
                            <strong className={payment.amount_paid < 0 ? "is-negative" : ""}>
                              {formatAmount(payment.amount_paid)}
                            </strong>
                            <span>{payment.receipt_number || "—"}</span>
                            <span className="parent-finance-payment-chevron" aria-hidden="true">{isExpanded ? "⌃" : "⌄"}</span>
                          </button>

                          {isExpanded ? (
                            <div className="parent-finance-payment-details">
                              <div>
                                <span>Transaction</span>
                                <strong>{payment.transaction_reference || "Not available"}</strong>
                              </div>
                              <div>
                                <span>Remarks</span>
                                <strong>{payment.remarks || "—"}</strong>
                              </div>
                              <div>
                                <span>Payment date</span>
                                <strong>{formatDate(payment.payment_date, true)}</strong>
                              </div>
                              {payment.receipt_number ? (
                                <button
                                  type="button"
                                  className="parent-finance-receipt-button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    printReceipt(payment);
                                  }}
                                  disabled={printingReceiptId === payment.id}
                                >
                                  {printingReceiptId === payment.id ? "Preparing receipt…" : "Print / Save PDF"}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {hasMorePayments ? (
                    <button
                      type="button"
                      className="parent-finance-view-all-button"
                      onClick={() => setShowAllPayments((current) => !current)}
                    >
                      {showAllPayments ? "Show recent payments" : `View all ${paymentHistory.length} payments`}
                    </button>
                  ) : null}
                </>
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
