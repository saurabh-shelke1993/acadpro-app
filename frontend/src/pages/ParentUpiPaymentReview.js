import { useCallback, useEffect, useState } from "react";
import Layout from "../components/Layout";
import {
  formatSubmissionStatus,
  getAcademyPaymentSubmissions,
  recordAcceptedParentUpiPayment,
  reviewParentUpiPayment,
} from "../services/parentPaymentSubmissionService";
import "./ParentUpiPaymentReview.css";

const formatAmount = (value) =>
  Number(value || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });

const formatDate = (value, includeTime = false) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + (includeTime ? ` ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "");
};

function ParentUpiPaymentReview() {
  const user = JSON.parse(localStorage.getItem("acadpro_user") || "null");
  const canReview = user?.role === "academy_owner";
  const [filter, setFilter] = useState("pending");
  const [submissions, setSubmissions] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAcademyPaymentSubmissions(filter);
      setSubmissions(data);
    } catch (loadError) {
      setError(loadError.message || "Payment claims could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);

  const handleRecordPayment = async (submission) => {
    const confirmed = window.confirm(
      `Record ₹${Number(submission.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in the payment ledger, update the fee balance, and generate a receipt for this accepted UPI claim? This action cannot be repeated.`
    );
    if (!confirmed) return;

    setBusyId(submission.id);
    setError("");
    setNotice("");
    try {
      const result = await recordAcceptedParentUpiPayment(submission.id);
      setNotice(
        `Payment recorded successfully. Receipt: ${result?.receipt_number || "generated"}.`
      );
      await loadSubmissions();
    } catch (recordError) {
      setError(recordError.message || "The accepted claim could not be recorded.");
    } finally {
      setBusyId("");
    }
  };

  const handleReview = async (submission, decision) => {
    const note = reviewNotes[submission.id] || "";
    if (decision === "rejected" && note.trim().length < 3) {
      setError("Enter a rejection reason of at least 3 characters.");
      return;
    }
    const confirmed = window.confirm(
      decision === "accepted"
        ? "Accept this payment claim as verified? This will not update the fee balance or create a receipt."
        : "Reject this payment claim?"
    );
    if (!confirmed) return;

    setBusyId(submission.id);
    setError("");
    setNotice("");
    try {
      await reviewParentUpiPayment(submission.id, decision, note);
      setNotice(
        decision === "accepted"
          ? "Claim accepted. The payment ledger and fee balance are unchanged; use “Record payment & issue receipt” to post the verified claim."
          : "Claim rejected."
      );
      await loadSubmissions();
    } catch (reviewError) {
      setError(reviewError.message || "The claim could not be reviewed.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <Layout>
      <main className="parent-upi-review-page">
        <header className="parent-upi-review-heading">
          <div>
            <span>Finance · UPI</span>
            <h1>Parent UPI Payment Claims</h1>
            <p>Review parent-submitted UPI transaction references for your academy.</p>
          </div>
          <label>
            <span>Claim status</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="recorded">Recorded</option>
              <option value="all">All claims</option>
            </select>
          </label>
        </header>

        <div className="parent-upi-review-integrity-note">
          <strong>Financial integrity:</strong> Accepting only verifies the claim. The Academy Owner must explicitly record an accepted claim to create one ledger payment, update the fee balance, and issue a receipt.
        </div>

        {error ? <p className="parent-upi-review-alert is-error" role="alert">{error}</p> : null}
        {notice ? <p className="parent-upi-review-alert is-success" role="status">{notice}</p> : null}

        {loading ? (
          <div className="parent-upi-review-empty">Loading payment claims…</div>
        ) : submissions.length === 0 ? (
          <div className="parent-upi-review-empty">
            <strong>No claims found</strong>
            <p>There are no claims for the selected status.</p>
          </div>
        ) : (
          <div className="parent-upi-review-list">
            {submissions.map((submission) => {
              const player = submission.players?.full_name || "Player";
              const due = submission.payment_dues || {};
              const parent = submission.parents?.parent_name || "Parent";
              return (
                <article key={submission.id} className="parent-upi-review-card">
                  <div className="parent-upi-review-card-top">
                    <div>
                      <span className="parent-upi-review-kicker">{parent} · {player}</span>
                      <h2>{formatAmount(submission.amount)}</h2>
                      <p>{String(due.due_type || "Fee").replaceAll("_", " ")} · Due {formatDate(due.due_date)}</p>
                    </div>
                    <span className={`parent-upi-review-status status-${submission.status}`}>
                      {formatSubmissionStatus(submission.status)}
                    </span>
                  </div>
                  <dl className="parent-upi-review-details">
                    <div><dt>UPI reference / UTR</dt><dd>{submission.transaction_reference}</dd></div>
                    <div><dt>Payment date</dt><dd>{formatDate(submission.payment_date)}</dd></div>
                    <div><dt>Submitted</dt><dd>{formatDate(submission.created_at, true)}</dd></div>
                    <div><dt>Due remaining at current view</dt><dd>{formatAmount(due.remaining_amount ?? (Number(due.total_amount) - Number(due.paid_amount || 0)))}</dd></div>
                  </dl>
                  {submission.parent_note ? (
                    <p className="parent-upi-review-note"><strong>Parent note:</strong> {submission.parent_note}</p>
                  ) : null}
                  {submission.review_note ? (
                    <p className="parent-upi-review-note"><strong>Review note:</strong> {submission.review_note}</p>
                  ) : null}
                  {submission.status === "recorded" ? (
                    <p className="parent-upi-review-note">
                      <strong>Receipt:</strong> {submission.payments?.receipt_number || "Recorded"}
                      {submission.recorded_at ? ` · Recorded ${formatDate(submission.recorded_at, true)}` : ""}
                    </p>
                  ) : null}

                  {canReview && submission.status === "accepted" ? (
                    <div className="parent-upi-review-actions">
                      <p>This claim is verified. Recording creates the ledger payment and receipt and updates the outstanding balance.</p>
                      <button
                        type="button"
                        disabled={busyId === submission.id}
                        onClick={() => handleRecordPayment(submission)}
                      >
                        {busyId === submission.id ? "Recording…" : "Record payment & issue receipt"}
                      </button>
                    </div>
                  ) : null}

                  {canReview && submission.status === "pending" ? (
                    <div className="parent-upi-review-actions">
                      <label>
                        <span>Review note {filter === "rejected" ? "(required for rejection)" : "(optional)"}</span>
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={reviewNotes[submission.id] || ""}
                          onChange={(event) => setReviewNotes((current) => ({
                            ...current,
                            [submission.id]: event.target.value,
                          }))}
                          placeholder="Record what you verified, or explain rejection"
                        />
                      </label>
                      <div>
                        <button
                          type="button"
                          disabled={busyId === submission.id}
                          onClick={() => handleReview(submission, "accepted")}
                        >
                          {busyId === submission.id ? "Saving…" : "Accept claim"}
                        </button>
                        <button
                          type="button"
                          className="is-reject"
                          disabled={busyId === submission.id}
                          onClick={() => handleReview(submission, "rejected")}
                        >
                          Reject claim
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </Layout>
  );
}

export default ParentUpiPaymentReview;
