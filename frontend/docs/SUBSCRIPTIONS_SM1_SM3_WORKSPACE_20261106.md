# Kheltriva — Subscriptions workspace SM1–SM3 checkpoint

**Date:** 6 November 2026  
**Branch:** `payment-module-finalization`  
**Feature status:** Implementation and focused automated validation **complete**. Owner browser/role, business workflow, responsive and tenant/security acceptance **pending**.

## Product decision and scope

Merge the **navigation** for `Player Subscriptions` and `Subscription Plans` following the Attendance workspace precedent. Preserve each module's original React page implementation and Supabase data flow. The Owner explicitly wants to modernize each page **separately** after the shared navigation is accepted.

## Before merge — reviewed baseline

| Module | Existing route | Functionality preserved | Pagination |
|---|---|---|---|
| Subscription Plans | `/subscription-plans` | Create, edit, deactivate/reactivate, academy/status filters; deactivated plans preserve existing player subscriptions | 5 plans/page |
| Player Subscriptions | `/player-subscriptions` | Academy/center/batch selection; assign, update, deactivate; duplicate-active check; column filters, status and plan filtering | 7 records/page |

**Roles:** Super Admin and Academy Owner have management access. Coach and Parent have **no management route access**. Parent read-only linked-subscription information remains in its distinct portal and continues under existing RLS.

**Database reviewed:** `public.subscription_plans` and `public.player_subscriptions` have separate policies/FKs; existing data observed at review was 4 active plans and 22 active subscriptions. These counts are **not** invariant and must not be relied on for tests. No schema/policy/SQL changes were requested.

## Implemented SM2–SM3

- One Finance sidebar entry **Subscriptions** replaces the two management links for both authorized management roles.
- `/subscriptions?view=players` is the default, showing the **unchanged PlayerSubscriptions** component.
- `/subscriptions?view=plans` shows the **unchanged SubscriptionPlans** component.
- Both views display accessible, compact navigation cards (selected state, link labels, keyboard focus and mobile stacking). Selecting a different card warns if the active form contains unsaved or edit-state inputs.
- `/player-subscriptions` and `/subscription-plans` remain `ProtectedRoute` guarded redirects and preserve other query parameters and hashes, including bookmarks.
- Invalid/missing `view` resolves to `players`; no additional Coach or Parent management permissions.
- Each original page still wraps its own `Layout`; no nested shared Layout. Existing state, fetches, mutations, filters, RLS dependencies and pagination remain unchanged.
- The unsaved-form confirmation applies specifically to the **view cards**. The sidebar, browser Back, refresh, navigating elsewhere and some indirect unsaved state changes are not protected by this change; evaluate broader route-leave blocking later if owner testing requires it.

## Changed source files

- `frontend/src/pages/SubscriptionsWorkspace.js` (new)
- `frontend/src/components/SubscriptionsWorkspaceTabs.js` (new)
- `frontend/src/components/SubscriptionsWorkspaceTabs.css` (new)
- `frontend/src/routes/AppRoutes.js` (canonical and legacy routing)
- `frontend/src/components/Sidebar.js` (one Subscriptions entry)
- `frontend/src/pages/PlayerSubscriptions.js` and `SubscriptionPlans.js` (render view selection + unsaved flags only)
- `frontend/src/pages/SubscriptionsWorkspace.test.js`, `frontend/src/components/SubscriptionsWorkspaceTabs.test.js`, `frontend/src/components/Sidebar.test.js`
- `.github/workflows/subscriptions-merge-validation.yml`

**Source commit:** [`0fc4165e`](https://github.com/saurabh-shelke1993/acadpro-app/commit/0fc4165e71e9baabee9b20bea56519f2fb8673ec). CI config corrections: [`fe35d5a6`](https://github.com/saurabh-shelke1993/acadpro-app/commit/fe35d5a60d122623ee77152bfe9e6b880f6e0051) and [`da0cdb55`](https://github.com/saurabh-shelke1993/acadpro-app/commit/da0cdb5596e46beea26c873191f331c650a521ec).

## Automated validation evidence

[Subscriptions SM2–SM3 CI run 42153066796](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42153066796), exact SHA `da0cdb55`:

| Check | Result |
|---|---|
| Workspace routing/view/legacy/guard Jest tests | **18/18 PASS** (2 suites) |
| Sidebar + Sidebar accessibility Jest tests | **24/24 PASS** (2 suites) |
| React production build | **PASS — compiled successfully** |
| Existing Attendance regression at initial source commit `0fc4165e` | **PASS** |
| Full application Jest at source `0fc4165e` | **FAIL: 4/43 suites, 16/329 tests** (Coach Profile/Player Performance), tracked outside SM2–SM3 |
| Live Owner/SA form, navigation and mobile checks | **PENDING** |
| Authenticated Coach/Parent and negative cross-academy / RLS tests | **PENDING** |
| Vercel deployment/manual release acceptance | **PENDING** |

## Manual test cases (ask owner for explicit PASS/issues)

1. **Academy Owner:** Finance sidebar has one Subscriptions link; initial view is Player Subscriptions. Two cards are visible and selected state follows navigation.
2. **Academy Owner:** Switch to Plans; verify the existing create/edit/activate/deactivate form and original 5-row plan paging without changing business records unintentionally.
3. **Academy Owner:** Switch back to Players; verify original Academy→Center→Batch→Player/Plan selection, assign/update/deactivate and 7-row paging using controlled test records. Duplicate-active warning remains.
4. **Both views:** Enter an unsaved form field, click the other card: Cancel stays on current view; Confirm switches and discards local draft. No autosaving or implicit changes should occur.
5. **Old URLs:** Directly open `/subscription-plans` and `/player-subscriptions`; check correct view/URL and existing relevant query/hash retained. Validate browser Back and refresh independently.
6. **Super Admin:** Both views available; academy selection remains available and never mixes player/plan academy scopes.
7. **Coach/Parent:** No sidebar management link; direct canonical and legacy management URLs deny access; Parent Portal's separate linked-subscription view still works.
8. **Responsive:** Desktop and 320/375/430/768px widths: both cards readable, no horizontal page overflow, original form and table actions reachable.
9. **Release/tenant:** Inspect network/errors, verify deployed Git SHA, test cross-academy/role-negative calls with controlled fixtures; do not run destructive tests against production data.

## Next separate development priorities

Only after **SM5 visual/functional acceptance**: optimize **Player Subscriptions** as its own scoped phase, then **Subscription Plans** as another. Keep payment dues, payment collections, player subscriptions and plan tables independent unless a business-rule change is explicitly approved.

**No Supabase migrations or writes. No subscription business logic refactor in this merge.**
