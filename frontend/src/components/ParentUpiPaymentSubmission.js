import { useEffect, useMemo, useState } from "react";
import { getAcademyPaymentSettings } from "../services/academyPaymentSettingsService";
import {
  formatSubmissionStatus,
  getParentPaymentSubmissions,
  submitParentUpiPayment,
} from "../services/parentPaymentSubmissionService";
import "./ParentUpiPaymentSubmission.css";

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatAmount = (value) =>
  Number(value || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

function ParentUpiPaymentSubmission({ playerId, academyId, pendingDues = [] }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [selectedDueId, setSelectedDueId] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(getLocalDate);
  const [parentNote, setParentNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const eligibleDues = useMemo(
    () => pendingDues.filter((due) => Number(due.remaining_amount) > 0 && due.due_status !== "paid"),
    [pendingDues]
  );
  const selectedDue = eligibleDues.find((due) => due.id === selectedDueId) || null;

  const loadData = async () => {
    if (!playerId || !academyId) {
      setEnabled(false);
      setSubmissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [settings, claims] = await Promise.all([
        getAcademyPaymentSettings(academyId),
        getParentPaymentSubmissions(playerId),
      ]);
      setEnabled(Boolean(settings?.is_enabled));
      setSubmissions(claims);
      setError("");
    } catch {
      setEnabled(false);
      setSubmissions([]);
      setError("Payment submission details could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!playerId || !academyId) {
        setEnabled(false);
        setSubmissions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [settings, claims] = await Promise.all([
          getAcademyPaymentSettings(academyId),
          getParentPaymentSubmissions(playerId),
        ]);
        if (!active) return;
        setEnabled(Boolean(settings?.is_enabled));
        setSubmissions(claims);
        setError("");
      } catch {
        if (active) {
          setEnabled(false);
          setSubmissions([]);
          setError("Payment submission details could not be loaded. Please try again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [playerId, academyId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!selectedDue) {
      setError("Select an outstanding fee due.");
      return;
    }
    if (Number(amount) > Number(selectedDue.remaining_amount)) {
      setError("Claim amount cannot exceed the current remaining due.");
      return;
    }
    setSaving(true);
    try {
      await submitParentUpiPayment({
        dueId: selectedDueId,
        amount,
        transactionReference,
        paymentDate,
        parentNote,
      });
      setAmount("");
      setTransactionReference("");
      setParentNote("");
      setPaymentDate(getLocalDate());
      setSelectedDueId("");
      setNotice("Payment claim submitted. The academy must verify it; your fee balance has not changed.");
      await loadData();
    } catch (submitError) {
      setError(submitError.message || "Payment claim could not be submitted.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="parent-upi-submission" aria-label="Submit UPI payment">
        <p>Loading payment submission options…</p>
      </section>
    );
  }
  if (!enabled && submissions.length === 0) return null;

  return (
    <section className="parent-upi-submission" aria-labelledby="parent-upi-submit-heading">
      <div className="parent-upi-submission-heading">
        <div>
          <span className="parent-upi-submission-eyebrow">Already paid by UPI?</span>
          <h2 id="parent-upi-submit-heading">Submit payment for verification</h2>
          <p>Enter the transaction details so the academy can verify your payment.</p>
        </div>
      </div>

      {error ? <p className="parent-upi-submission-alert is-error" role="alert">{error}</p> : null}
      {notice ? <p className="parent-upi-submission-alert is-success" role="status">{notice}</p> : null}

      {!enabled ? (
        <p className="parent-upi-submission-disclaimer">
          New UPI payment claims are currently disabled by the academy. Your existing claim history remains available below.
        </p>
      ) : eligibleDues.length === 0 ? (
        <div className="parent-upi-submission-empty">
          <strong>No outstanding fee dues</strong>
          <p>There are no eligible fee dues for this child right now.</p>
        </div>
      ) : (
        <form className="parent-upi-submission-form" onSubmit={handleSubmit}>
          <label>
            <span>Fee due</span>
            <select
              value={selectedDueId}
              onChange={(event) => {
                setSelectedDueId(event.target.value);
                setAmount("");
              }}
              required
            >
              <option value="">Select an outstanding due</option>
              {eligibleDues.map((due) => (
                <option key={due.id} value={due.id}>
                  {String(due.due_type || "Fee").replaceAll("_", " ")} · Due {formatDate(due.due_date)} · Remaining {formatAmount(due.remaining_amount)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Amount paid (₹)</span>
            <input
              type="number"
              min="0.01"
              max={selectedDue ? Number(selectedDue.remaining_amount).toFixed(2) : undefined}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 2500"
              required
            />
            {selectedDue ? <small>Remaining due: {formatAmount(selectedDue.remaining_amount)}</small> : null}
          </label>
          <label>
            <span>UPI transaction reference / UTR</span>
            <input
              type="text"
              minLength="3"
              maxLength="120"
              value={transactionReference}
              onChange={(event) => setTransactionReference(event.target.value)}
              placeholder="Enter the reference from your UPI app"
              required
            />
          </label>
          <label>
            <span>Payment date</span>
            <input
              type="date"
              value={paymentDate}
              max={getLocalDate()}
              onChange={(event) => setPaymentDate(event.target.value)}
              required
            />
          </label>
          <label className="parent-upi-submission-note">
            <span>Note (optional)</span>
            <textarea
              value={parentNote}
              onChange={(event) => setParentNote(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Any additional details for the academy"
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? "Submitting…" : "Submit payment for verification"}
          </button>
        </form>
      )}

      <p className="parent-upi-submission-disclaimer">
        Submitting a claim does not update the fee balance or create a receipt. The academy must review the transaction and record the collection separately.
      </p>

      {submissions.length > 0 ? (
        <div className="parent-upi-submission-history">
          <h3>Submitted payment claims</h3>
          <div className="parent-upi-submission-list">
            {submissions.map((submission) => (
              <article key={submission.id} className="parent-upi-submission-row">
                <div>
                  <strong>{formatAmount(submission.amount)}</strong>
                  <span>UTR: {submission.transaction_reference}</span>
                  <small>Paid {formatDate(submission.payment_date)} · Submitted {formatDate(submission.created_at?.slice(0, 10))}</small>
                  {submission.review_note ? <small>Academy note: {submission.review_note}</small> : null}
                </div>
                <span className={`parent-upi-submission-status status-${submission.status}`}>
                  {formatSubmissionStatus(submission.status)}
                </span>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ParentUpiPaymentSubmission;
