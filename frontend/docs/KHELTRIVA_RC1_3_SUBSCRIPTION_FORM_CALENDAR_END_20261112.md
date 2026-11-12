# Kheltriva RC1.3 — Compact Player Subscription form and calendar end

**Request:** Product Owner screenshot 12 Nov 2026: remove Academy Owner's redundant academy card, group Center / Batch / Player, group Plan / Start date / End date, calculate the calendar month's last day for monthly or the third month's last day for quarterly.
**Development target:** `payment-module-finalization`; isolated PR branch `rc1-3-compact-subscription-form-calendar-end`.
**Status:** IMPLEMENTED IN PR; focused CI and Owner UI acceptance must be recorded separately. **NO hosted SQL / live data changes / migration.**

## Precise implemented behavior

1. Academy Owners: redundant single-academy banner removed from Player Subscriptions only. Academy scope remains derived from their authenticated role and existing RLS. Super Admin retains Academy selector and multi-academy scope.
2. One compact row of `Center → Batch → Player`, with the same existing scoped dropdowns and role boundaries. Switching academy/center/batch clears stale selected player/plan where appropriate. Subscriptions list, column filters, seven-row pagination and existing actions remain.
3. A second row of `Plan → Start date → End date (read-only) → Create/Update`. End date is computed from the new subscription's **calendar-aligned first billing cycle**. Examples:
   - Monthly, 12 Nov 2026 → **30 Nov 2026**.
   - Monthly, 1 Dec 2026 → **31 Dec 2026**.
   - Quarterly, 12 Nov 2026 → **31 Jan 2027** (Nov, Dec, Jan), not 28 Feb.
   - Quarterly, 12 Dec 2026 → **28 Feb 2027**.
   - Half-yearly and yearly plan types use six and twelve inclusive calendar months when encountered.
   - Validations are date-only, leap-year-safe, no timezone arithmetic.
4. On **Create subscription only**, the new `player_subscriptions.end_date` field is saved with the computed end date. The table already has this nullable column; no DB schema change or migration is required. This is a **first-period calendar boundary**, not evidence of a paid-through balance, contract rate, renewal authorization, paid invoice, or future automatic renewal.
5. Existing subscriptions are protected: editing displays **the recorded end date** (blank if historically NULL). It never fills missing historic end dates. If a record already has an end date, attempting to change plan/start is **blocked** so its recorded boundary cannot become silently inconsistent. Such changes require the future approved period-change workflow. The legacy edit handler is otherwise unchanged and does not write end dates.
6. Fee preview remains **read-only**. It now correctly distinguishes the saved fixed-calendar end date from alternative anniversary-date simulations; no amount, chosen pricing alignment or payment due is saved. No link to RC1.2 manual discounted Payment Due has been automated.

## Confirmed challenges and release boundaries

- **Calendar vs anniversary contract:** Existing `subscriptionLifecycleDates.js` computes anniversary periods, while the requested form is fixed-calendar. RC1.3 adds a separate calendar helper rather than rewriting the anniversary calculator or renewal engine. Its date is the new subscription's first calendar-period end, not a future renewal schedule.
- **22 legacy active records with null end dates:** These cannot safely be backfilled without confirmed original paid-through/contracted-rate evidence. RC1.3 does not touch them.
- **Subscription status:** This task does not auto-deactivate/renew after the end date. The Active status remains controlled by existing manual subscription workflow.
- **Existing payments:** No `payment_dues`, `payments`, `subscription_plans`, receipt, pricing policy or contract migration is changed. The new end date does not create a due or prove any payment was collected.
- **Future plan changes:** A subscription with a recorded period end cannot be silently re-anchored through basic Update. An explicit approved change workflow is deferred.
- **Security:** Existing ROLE_MATRIX/RLS academy isolation remains authoritative; no security NO-GO has been lifted. Historical duplicates/cross-academy records remain unreconciled.
- **Responsive:** Desktop aligns 3 contextual selectors over 3 billing fields + action. Mid-size adapts to 3-column billing + action row; mobile stacks all fields without horizontal scrolling.

## Files in this task

- `frontend/src/pages/PlayerSubscriptions.js`, `.css`, `.test.js`.
- `frontend/src/utils/subscriptionCalendarEndDate.js` and `.test.js`.
- `frontend/src/components/SubscriptionFeePreview.js` and `.test.js` (disclaimer correction only).
- `.github/workflows/subscriptions-merge-validation.yml` (PR tests and build).
- This document, plus focused adjustments to relevant living project docs.

## Automated checks

- [ ] New pure end-date utility tests: monthly/quarterly/year rollovers, February leap years, half-year and yearly, invalid date/cycle.
- [ ] Player Subscriptions component tests: Academy Owner no redundant academy, SA academy selector, groups, new saved end, quarterly preview, legacy end preserved and recorded-period change blocked.
- [ ] Existing subscription preview tests: revised disclaimer, still simulation-only with no fee/due writes.
- [ ] Focused subscription Jest suite and production build on exact PR SHA.
- [ ] Owner desktop/mobile acceptance on merged development branch.

## Your UI acceptance — Academy Owner

**Navigate:** Finance → Subscriptions → Player Subscriptions.

1. Red area: Academy name card is **gone**, with no extra blank banner. You remain scoped to your academy.
2. Yellow area: Center, Batch and Player are on **the same compact row** on desktop. Changing Center updates Batch; changing Batch updates Player. No stale player remains selected after changing filters.
3. Green area: Plan, Start date, **End date (read-only)** and Create subscription appear together.
4. With a new controlled test player/plan selection, choose Monthly and Start = **12 Nov 2026**: End should show **30 Nov 2026**. Choose Quarterly: End should show **31 Jan 2027**.
5. Change start to **12 Dec 2026** on quarterly: End should show **28 Feb 2027**.
6. Open an existing legacy subscription with a blank end date by clicking Edit: do **not** save merely to test. The End field should remain empty, not silently backfilled. Cancel.
7. With a specially created disposable subscription (no real financial records), verify a newly saved end date appears in the End Date column after Create; no Payment Due is generated by that action. Do **not** create real paid agreements purely for testing.
8. Super Admin: Academy selector is still visible, and switching academies updates available Center, Batch, Player and Plan choices. Coach/Parent must not gain management access.
9. Mobile at 375 and 430 px: all fields stacked, no horizontal overflow, submit visible.
10. RC1.2 remains on **Payment Dues**, not on the Player Subscriptions assignment form.

**Report each step PASS/FAIL.** A successful build or CI run is not Owner manual acceptance. Live security release still NO-GO.
