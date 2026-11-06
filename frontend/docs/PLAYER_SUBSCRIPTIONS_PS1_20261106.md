# Kheltriva — Player Subscriptions PS1 optimization checkpoint

**Date:** 6 November 2026  
**Branch:** `payment-module-finalization`  
**State:** PS1 source implemented and focused CI passed; live UI/role/business acceptance pending.

## Goal and boundaries

After the Owner approved starting independent improvements, this phase makes **Player Subscriptions** less vertically demanding while protecting every existing subscription assignment and billing invariant. The consolidated Finance → Subscriptions workspace from SM1–SM3 remains intact. **Subscription Plans is not changed or optimized in PS1.**

## Implemented

1. **Academy scope:** Academy Owner now sees their academy's name as read-only context alongside the existing Center and Batch selectors. Super Admin retains their original Academy selection control.
2. **Dense layout:** Reduced scope bar padding/gaps; replaced stacked duplicate heading labels with one compact, accessible assignment H2; reduced top-level form/grid and selected Player/Plan preview spacing. Responsive field layout remains.
3. **Draft reset:** The existing `resetAssignmentForm` handler now powers a visible **Clear form** action whenever a new assignment has Player/Plan/start-date changes. Existing **Cancel edit** remains when editing; no save/delete is triggered by reset.
4. **Result terminology:** List count changes from `N shown` to `N matching` to distinguish total filtered results from the seven rendered rows. Existing active/inactive numbers and filters are untouched.
5. **Scope:** Only `PlayerSubscriptions.js`, `PlayerSubscriptions.css`, new component test file and Subscriptions CI workflow; original data queries, writes, validations, status actions, duplicate-active check and `PAGE_SIZE=7` preserved. No migration, SQL write, RLS policy, RPC or payment-module changes.

## Validation evidence

| Check | Evidence |
|---|---|
| Workspace and routing Jest | **18/18 PASS** |
| Sidebar and accessibility Jest | **24/24 PASS** |
| New PlayerSubscriptions focused Jest | **3/3 PASS** |
| Total targeted tests | **45/45 PASS (5 suites)** |
| React production build | **PASS** |
| CI source SHA | `92f28d871793ad64a761ffc7dbe3b3e9588803d0` |
| GitHub Actions | [run 42154238168](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42154238168) |
| Full frontend Jest | **FAIL 16/332 tests** (4 Coach Profile/Player Performance suites, unrelated) |
| Owner/Super Admin browser acceptance | **PENDING** |
| Direct negative tenant/role RLS verification | **PENDING** |
| Production release acceptance | **PENDING** |

## Manual test checklist — PS1

1. Owner: Finance → Subscriptions → Player Subscriptions, verify read-only Academy text, Center/Batch options and compact alignment.
2. Owner: Select Player or Plan, see **Clear form**; clicking clears draft and selected player/plan, without saving. Enter Edit on a controlled record, verify **Cancel edit** resets the form.
3. Owner: Select Player, Plan and Start date; verify the existing summary accurately reflects selected plan name, INR amount, cycle and date. Validate create/update/deactivation only using controlled test records.
4. Owner: List shows **matching**, active and inactive counts, and still paginates **seven records per page**. Status and column filters behave as before.
5. Super Admin: Academy selector still available; options remain correctly scoped; no altered assignment or cross-academy behavior. Direct security/role-negative checks require separate controlled tests.
6. Check 320/375/430/768px mobile/tablet and desktop for horizontal overflow, readable form controls, aligned action button, and tabs. The existing mobile ledger's hidden columns are **PS2**, not fixed here.
7. No manual production database modification during review. Verify deployed SHA and console for runtime errors.

## Next separately scoped work

**PS2:** Accessible small-screen ledger with Status, dates, Center/Batch details and actions without relying on column position. **PS3:** Review loading/error and scale risks separately. **Subscription Plans:** its own independent UX scope after Player Subscriptions acceptance.

**PS1 is not marked manually accepted or released simply because source and CI passed.**
