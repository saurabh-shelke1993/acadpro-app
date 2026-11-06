/* global BigInt */
import { useEffect, useMemo, useState } from "react";
import { getPlayerScheduleEnrollments } from "../services/playerScheduleService";
import {
  SUBSCRIPTION_BILLING_ALIGNMENT as ALIGN,
  SUBSCRIPTION_PRORATION_METHOD as METHOD,
  calculateInitialMonthlyProration,
} from "../utils/subscriptionProration";
import "./SubscriptionFeePreview.css";

// Preview parser only. PS-L2 must read the owner's contracted price server-side.
const paiseForPlan = (amount) => {
  const raw = String(amount ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new RangeError("Invalid plan amount");
  const [whole, fraction = ""] = raw.split(".");
  if (fraction.slice(2).replace(/0/g, "") !== "") throw new RangeError("Amount has more than two decimal places");
  const result = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Plan amount out of range");
  return Number(result);
};
const money = (paise) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(paise / 100);

/** Read-only PS-L1P2 simulation; never writes fees, preferences or dues. */
export default function SubscriptionFeePreview({ player, plan, joinDate }) {
  const [alignment, setAlignment] = useState("");
  const [method, setMethod] = useState("");
  const [sessions, setSessions] = useState({ key: "", state: "idle", slots: [] });
  const playerId = player?.id || "";
  const academyId = player?.academy_id || "";
  const centerId = player?.center_id || "";
  const batchId = player?.batch_id || "";
  const key = [playerId, academyId, centerId, batchId].join("|");
  const sameAcademy = Boolean(academyId && plan?.academy_id && academyId === plan.academy_id);
  const needSessions = sameAcademy &&
    alignment === ALIGN.FIXED_CALENDAR_MONTH && method === METHOD.SCHEDULED_SESSIONS;

  useEffect(() => {
    if (!needSessions || !playerId || !centerId || !batchId) return undefined;
    let cancelled = false;
    setSessions({ key, state: "loading", slots: [] });
    getPlayerScheduleEnrollments({ academyId, centerId, batchId, playerId })
      .then((enrollments) => {
        if (cancelled) return;
        const slots = (enrollments || [])
          .filter((e) => e.academy_id === academyId && e.player_id === playerId &&
            e.is_active === true && e.batch_schedules?.is_active === true &&
            e.batch_schedules?.center_id === centerId && e.batch_schedules?.batch_id === batchId)
          .map((e) => ({
            scheduleId: e.batch_schedules.id,
            dayOfWeek: Number(e.batch_schedules.day_of_week),
            enrolledFrom: e.enrolled_from, enrolledUntil: e.enrolled_until, isActive: true,
          }));
        setSessions({ key, state: "ready", slots });
      })
      .catch(() => {
        if (!cancelled) setSessions({ key, state: "error", slots: [] });
      });
    return () => { cancelled = true; };
  }, [needSessions, playerId, academyId, centerId, batchId, key]);

  const { estimate, error } = useMemo(() => {
    if (!sameAcademy || !alignment || (alignment === ALIGN.FIXED_CALENDAR_MONTH && !method)) {
      return { estimate: null, error: "" };
    }
    if (needSessions && (sessions.key !== key || sessions.state !== "ready")) {
      return { estimate: null, error: "" };
    }
    try {
      return {
        estimate: calculateInitialMonthlyProration({
          billingAlignment: alignment, joinDate,
          agreedAmountPaise: paiseForPlan(plan.amount),
          prorationMethod: alignment === ALIGN.FIXED_CALENDAR_MONTH ? method : undefined,
          sessionSlots: needSessions ? sessions.slots : [],
        }),
        error: "",
      };
    } catch (err) {
      return { estimate: null, error: err.message || "Calculation unavailable" };
    }
  }, [sameAcademy, alignment, method, needSessions, sessions, key, joinDate, plan?.amount]);

  if (!player || !plan || plan.billing_cycle !== "monthly") return null;

  return (
    <section className="subscription-fee-preview" aria-label="First-period fee preview">
      <div className="subscription-fee-preview-header">
        <h3>First-period fee preview</h3><span>Simulation only</span>
      </div>
      <p className="subscription-fee-preview-warning">
        This calculation is not applied. <strong>Create subscription will not save the estimated end date, billing model, discount or payment due.</strong>
      </p>
      {!sameAcademy ? (
        <p role="alert">Preview unavailable: player and plan must belong to the same academy.</p>
      ) : (
        <>
          <div className="subscription-fee-preview-controls">
            <div>
              <label htmlFor="subscription-preview-alignment">Billing model (preview only)</label>
              <select id="subscription-preview-alignment" value={alignment} onChange={(e) => {
                setAlignment(e.target.value); setMethod("");
              }}>
                <option value="">Choose billing model</option>
                <option value={ALIGN.FIXED_CALENDAR_MONTH}>Fixed calendar month</option>
                <option value={ALIGN.ANNIVERSARY_MONTH}>Anniversary month</option>
              </select>
            </div>
            {alignment === ALIGN.FIXED_CALENDAR_MONTH && (
              <div>
                <label htmlFor="subscription-preview-method">Proration basis (preview only)</label>
                <select id="subscription-preview-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="">Choose calculation method</option>
                  <option value={METHOD.SCHEDULED_SESSIONS}>Scheduled training sessions</option>
                  <option value={METHOD.CALENDAR_DAYS}>Calendar days</option>
                </select>
              </div>
            )}
          </div>
          <div aria-live="polite">
            {!alignment && <p>Choose a billing model to see an estimate.</p>}
            {alignment === ALIGN.FIXED_CALENDAR_MONTH && !method &&
              <p>Choose a proration basis to calculate the estimate.</p>}
            {needSessions && (!centerId || !batchId) &&
              <p role="alert">Scheduled-session estimate requires an assigned center and batch.</p>}
            {needSessions && centerId && batchId && (sessions.key !== key || sessions.state === "loading") &&
              <p role="status">Loading player training sessions…</p>}
            {needSessions && sessions.key === key && sessions.state === "error" &&
              <p role="alert">Could not load assigned sessions; estimate unavailable.</p>}
            {error && <p role="alert">Estimate unavailable: {error}</p>}
            {estimate && (
              <>
                <dl className="subscription-fee-preview-metrics">
                  <div><dt>First period</dt><dd>{estimate.eligibleStartDate} – {estimate.firstPeriodEndDate}</dd></div>
                  <div><dt>Next renewal</dt><dd>{estimate.nextRenewalDate}</dd></div>
                  <div><dt>Full monthly rate</dt><dd>{money(estimate.agreedAmountPaise)}</dd></div>
                  {estimate.appliedMethod !== "none" && (
                    <div><dt>Proration basis</dt><dd>{estimate.eligibleCount} of {estimate.totalCount} {estimate.appliedMethod === METHOD.CALENDAR_DAYS ? "calendar days" : "scheduled sessions"}</dd></div>
                  )}
                  <div><dt>Estimated discount</dt><dd>{money(estimate.discountPaise)}</dd></div>
                  <div className="subscription-fee-preview-total"><dt>Estimated first-period fee</dt><dd>{money(estimate.firstPeriodAmountPaise)}</dd></div>
                </dl>
                {estimate.requiresReview && <p role="alert">
                  No eligible scheduled sessions remain; owner review is required. Do not generate a zero-value due.
                </p>}
              </>
            )}
          </div>
        </>
      )}
      <p className="subscription-fee-preview-note">
        Based on current schedule assignments only. Holidays and cancelled sessions are not excluded.
        Registration fees and future payment dues are not included. This is not a saved academy billing setting.
      </p>
    </section>
  );
}
