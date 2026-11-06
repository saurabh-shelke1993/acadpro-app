# Kheltriva — PS-L1P2 Read-only First-period Fee Preview

**Date:** 6 November 2026  
**Branch:** `payment-module-finalization`  
**Source SHA:** `7e0ddb453b5e5b4b790947bd7fbbd605e89f0edb`  
**Status:** **Implemented; 203/203 focused Jest tests and React build passed. Owner browser/manual acceptance pending.** No Supabase migrations, SQL writes, payment dues, collection or receipts changed.

## Intent and scope

PS-L1P2 exposes the PS-L1P1 monthly calculator to Academy Owner and Super Admin as a **read-only simulation**, without creating new billing behavior. The Owner previously approved future academy-configurable `fixed_calendar_month` and `anniversary_month` policies; none is persisted in the current database yet. The academy's default proration **method** (calendar days vs scheduled sessions) and holiday/cancellation policy also remain undecided; the UI explicitly requires a choice.

A preview is displayed only when **a player, monthly plan and joining date are selected for a new subscription**; it does not change existing edited subscriptions, quarterly/half-yearly plans or Parent Portal.

## Technical implementation

- `frontend/src/components/SubscriptionFeePreview.js` — local scenario state with no saved preference. Reads existing `subscriptionProration.js`; parses Plan.amount into integer paise and displays original amount, first-period dates, next renewal, day/session ratio, discount and first-period estimate. Does not save invoice or due records.
- `frontend/src/components/SubscriptionFeePreview.css` — compact 3-column metric layout on desktop, 2 columns on tablet, 1 on narrow mobile; responsive alignment and visible focus.
- `frontend/src/components/SubscriptionFeePreview.test.js` — **10 tests** for fixed day, anniversary, sessions, scope, errors, reactivity and invalid rates.
- `frontend/src/pages/PlayerSubscriptions.js` — renders the preview **after** the existing assignment form; original form's create/update/deactivate handlers and 7-row list pagination unchanged. A component `key` resets local quote preferences when player/plan/academy selection changes.
- `frontend/src/pages/PlayerSubscriptions.test.js` — one new integration test; total **4 tests**.
- `.github/workflows/subscriptions-merge-validation.yml` — adds new component files as triggers and a separate Jest step, followed by React build.
- `frontend/src/utils/subscriptionProration.js` — only build-lint-compatible iterations and BigInt global declaration changed; same session formulas/61 tests.

## Data scope and safety boundary

- For **session-based** estimates, uses the existing `playerScheduleService.getPlayerScheduleEnrollments({academyId,centerId,batchId,playerId})` read. RLS is the access authority; preview filters to player, academy, center and batch matching active schedule rows, and preserves inclusive enrollment dates. Stale async results are ignored.
- A player and plan must share the same academy or no estimate is shown.
- A session schedule read error produces **no quote**; no fallback to an unrelated calendar-day fee. If no scheduled slots are available, the pure helper reports an unavailable estimate rather than inventing sessions.
- No holidays or session cancellations are excluded: the currently active scheduled-session count may **overestimate training opportunities** and is visibly labelled as a limitation.
- No proration method is preselected for a fixed-month estimate; no model is preselected. These are preview-only switches **not stored in academy settings or subscription record**.
- Current plan amount is a **provisional illustrative rate**, not proof of a legacy subscriber's original locked contract. A future authoritative server transaction must verify agreed price, eligibility and academy scope before writing a bill.
- **Clear warning on screen:** `Create subscription` **does not save the estimated end date, billing model, discount or payment due**. No financial data/DB/schema/RLS/migration/Cron changes.

## Automated evidence

[Subscriptions scoped validation 42169267470](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42169267470) on `7e0ddb4`:

| Gate | Result |
|---|---|
| Subscriptions workspace | **18/18 PASS** |
| Sidebar suites | **24/24 PASS** |
| Player Subscriptions page | **4/4 PASS** |
| PS-L1 validity helper | **86/86 PASS** |
| PS-L1P1 proration helper | **61/61 PASS** |
| PS-L1P2 preview component | **10/10 PASS** |
| Total scoped Jest | **203/203 PASS (8 suites)** |
| React production build | **PASS** |
| Full-frontend [run 42169267502](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42169267502) | **FAIL 16/490 across four unrelated Coach Profile / Player Performance suites** |
| Owner/SA real browser, mobile, RLS | **PENDING** |

## Owner manual test checklist — PS-L1P2

1. Update `payment-module-finalization`; open **Finance → Subscriptions → Player Subscriptions** as Academy Owner. Select a player and an **active monthly** plan; verify the preview appears **below** the unchanged Create form.
2. Choose **Fixed calendar month → Calendar days**; example join `2027-01-15`, plan ₹1,500 should display **17/31** and **₹822.58** through `2027-01-31`, next renewal `2027-02-01`. Your real plan amount may differ; verify the ratio instead.
3. Choose **Fixed calendar month → Scheduled training sessions** for a properly enrolled player. Mon/Wed/Fri in Jan 2027 should show **7/13 and ₹807.69** at a ₹1,500 rate **only if all three slots are assigned and no exclusions apply**. If no active assigned training sessions are present, expect an unavailable quote, not an invented amount.
4. Choose **Anniversary month**: start `2027-01-15`, preview through `2027-02-14`, full agreed monthly amount; date updates re-evaluate the preview.
5. Change selected player/plan or Clear form: local quote selections should reset; an edit action must not show a misleading new-subscription estimate. Non-monthly plans should not show a monthly quote.
6. Super Admin: confirm correct academy selection, matched player/plan and relevant schedule scopes. A cross-academy player/plan mismatch should block the estimate; check error handling when a schedule is inaccessible. Coach/Parent have no management route access.
7. Check desktop and mobile at 320/375/430/768px for text wrapping, no overflow, keyboard navigation and visual consistency.
8. **Do not create/change a real financial record to validate the estimate.** For smoke verification, inspect the existing form behavior and browser console; check that the preview has no save action and the existing Create form still has no ability to persist the simulated amount.

## Next development gate

- **PS-L2 design only:** academy alignment and proration-default setting, holiday/cancellation policy, immutable agreement/period rate and schedule snapshots, one-period-one-due uniqueness, RLS, secure trusted schedule/price source, permission and audit.
- **PS-L0B outstanding:** Owner must approve each legacy agreement's correct plan, original contracted rate and paid-through date before prospective renewal.
- **Release:** No automatic renewal, prorated charge, pause/resume write, end-date storage, invoice or payment collection is implemented by this preview.

**Source implemented + automated-tested; Owner manual acceptance and financial release integration remain pending.**
