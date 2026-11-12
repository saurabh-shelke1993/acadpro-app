# Kheltriva RC1.1 — Existing Active Subscription: Edit Instead of Duplicate Create

**Date:** 12 November 2026
**Baseline:** accepted RC0, `payment-module-finalization` at `cc89ed6c2f580fc99805ad9ac76e6632d090a481`
**Status:** frontend code and focused test cases implemented in isolated RC1.1 branch. **CI and Owner UI acceptance PENDING**; not merged or deployed.
**Safety:** no database SQL, RLS, migrations, billing ledger, payments, `main` or Vercel changes. Release remains NO-GO.

## Original reported issue

On 6 Nov, the Owner attempted to change an existing player's monthly subscription with start date 6 Nov 2026. The form displayed a first-period fee preview (example: plan ₹1,500; 6–30 Nov; 11 of 13 scheduled sessions; estimate ₹1,269.23) but Create subscription reported **"Player already has this active subscription."**

**Root cause in source, not a confirmed database execution failure:** `PlayerSubscriptions.js` intentionally rejects another ACTIVE row with the same `player_id` + `subscription_plan_id`. The existing Update action is separate, and the first-period preview is intentionally simulation-only. A failed Create is **not** proof that the requested prorated amount was saved.

## Narrow RC1.1 frontend change

1. When the Owner/SA selects a player and plan with an **already-active matching subscription in the currently accessible subscription list**, show an inline **Active subscription already assigned** notice and **Edit existing subscription** action.
2. Disable Create subscription while this matching active record is selected; retain the existing create-time duplicate query to protect against stale UI state or race.
3. Edit opens the existing `handleEditSubscription` flow, pre-filling the original player's plan and start date. The new-subscription-only fee preview is not shown while editing, preserving its existing meaning.
4. Explicitly say that a fee preview is **not saved** and does **not** change payment dues.
5. An inactive same-plan subscription does **not** activate the notice or disable Create. Scope filtering/RLS, seven-row pagination and all underlying insert/update handlers are unchanged.

**Not claimed:** This step does NOT save the prorated amount, end date, manual billing terms, automatic renewal, modify an existing due, perform financial reconciliation or fix cross-plan overlapping active records. Those require RC1.2 financial behavior review. Existing statuses/financial history remain unchanged.

## Changed files

- `frontend/src/pages/PlayerSubscriptions.js`: calculate matching active selection from already-fetched authorized rows; show edit action and disable Create.
- `frontend/src/pages/PlayerSubscriptions.css`: compact responsive inline notice.
- `frontend/src/pages/PlayerSubscriptions.test.js`: synthetic active and inactive control regression (no actual financial database writes).
- This document.

## Developer validation

- [x] Inspected latest React create/edit/preview handlers and live subscription/payment schema, constraints, RLS and historical-data anomalies using SELECT only.
- [x] Compared source change scope with RC0 freeze.
- [ ] Scoped Jest tests on exact PR head.
- [ ] Frontend React build on exact PR head.
- [ ] Full Jest suite green (preexisting four-suite failures must be handled separately by RC3).
- [ ] Manual Owner/SA browser acceptance.
- [ ] Reviewed PR merged to development branch only.
- [ ] Any production deployment (separate release gate, not RC1.1).

## Owner UI acceptance checklist — ONLY in a local dev app or an approved PR preview

**Role:** Academy Owner; navigate **Finance → Subscriptions → Player Subscriptions**.

1. Select a player who **already has an ACTIVE subscription** and choose that exact plan. **Expected:** message **Active subscription already assigned** and **Edit existing subscription** button. **Create subscription** should be disabled.
2. Click **Edit existing subscription**. **Expected:** heading **Update player subscription**, with the existing saved start date and plan preselected. The **first-period fee preview disappears** while editing.
3. **Do not click Update** on a real paid/legacy subscription just to test this notice. Use a controlled test subscription with no historic dues/collections for write-path testing later in RC1.2.
4. Click **Cancel edit**. **Expected:** cleared draft, no unwanted subscription duplication and no change to payment dues.
5. With another player/plan combination that does **not** have a matching active subscription, **Create subscription** remains available. A matching **inactive** subscription should not trigger the duplicate notice.
6. Check the same behavior under **Super Admin** with an explicitly selected academy; change academy and confirm that no foreign-academy matching subscription is offered. Verify a Coach or Parent cannot access the management route.
7. At 375px/mobile, verify the notice fits the screen, its action remains visible, and there is no horizontal scrolling.

**Safety:** The notice and Edit shortcut perform no database mutation. For all other write tests, use controlled fixtures and get explicit approval before changing real subscription records. A successful UI shortcut does not certify billing or RLS.

## Next RC1.2 — proposed behavior contract before billing changes

Separate four operations: (a) edit subscription plan/start date; (b) approve a specific first-period adjusted fee; (c) create or correct a due with audited amount and authorized Owner; (d) future renewal. Verify existing paid dues and receipts are not retroactively repriced by a plan edit; enforce academy/role checks and no overlapping regular tuition. The current Payment Dues form takes `subscription_plans.amount` and **does not provide a first-period amount override**. The database has no recurring contracted-price snapshot/period ledger; automatic billing remains deferred.

**Never** interpret this RC1.1 navigation fix as an approved workaround for applying the ₹1,269.23 example. Preserve financial and migration release gates until an approved RC1.2 solution has been tested.
