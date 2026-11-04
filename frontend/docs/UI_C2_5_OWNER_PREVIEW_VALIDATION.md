# UI-C2.5 — Academy Owner Dashboard Validation Branch

**Branch:** `ui-c2-5-owner-dashboard-validation`
**Base:** `payment-module-finalization` @ `d8063c08dbb3681e2e6c172d80d5a368b1fb7b20`
**Scope:** A reversible Academy Owner-only preview using the existing React/CRA application, dashboard service contract, global Layout and Supabase authorization.
**Product decision:** Premium football identity with exceptionally simple daily workflows.

## Implementation boundaries

- Existing `/dashboard` route and `AcademyOwnerDashboard` remain the default.
- New `/ui-c2-5-preview` route is protected with `allowedRoles={["academy_owner"]}` and passes `ownerPreview` to the existing Dashboard page.
- `Dashboard.js` still loads Academy Owner data through `getAcademyOwnerDashboardData(currentUser)`. The preview component does not query Supabase.
- Existing Super Admin, Coach and Parent route behavior is unchanged.
- No package upgrades, database migrations, payment-RPC changes, RLS changes, credential changes, deployment to main or production switch.
- Preview includes a clear link back to `/dashboard`.
- Candidate CSS is scoped under `.c25-dashboard`; approved Kheltriva tokens are reused.

## Verified source-data contract

| Source | Preview | Invariant |
| --- | --- | --- |
| `totals` | Players/Centers/Batches links | Distinct player count is not the same as center memberships. |
| `centers.ageGroups` | Center selector and batch breakdown | Batches with zero players remain visible. |
| `todaySessions` | Today’s training, center-grouped, optional expansion | Retain existing attendance links with centerId and batchId. |
| `attendanceByBatch` | Seven-day batch bars and weighted recorded-mark rate | Rate = sum(presentRecords) / sum(totalRecords); unknown is not 0%. |
| `financial` | Monthly billed, collected, expenses, current outstanding | Monetary amounts remain separate from due-status counts. |
| `enquirySummary.groups` | Monthly enquiries by center | Retain centerId query parameter. |

## Automated validation

GitHub Actions workflow: `.github/workflows/ui-c2-5-owner-dashboard-validation.yml`.

- `npm ci`
- Focused UI-C2.5 and ProtectedRoute tests
- Full frontend Jest suite, independently reported
- CRA production build, even if unrelated pre-existing suites fail

**Initial focused run:** PASS — 2 suites / 18 tests, GitHub run `41773608686`.
**Initial full-suite run:** FAILED in unchanged Coach Performance, Coach Profile, Player Performance Report and Performance Workspace test files; exact baseline equivalence has not been proven. Do not edit those tests as part of UI-C2.5.
**Production build on current branch HEAD:** PENDING the latest CI run.
**Authenticated browser acceptance:** NOT RUN. CI placeholders are not real login credentials.
**Owner approval:** PENDING.

## Mandatory authenticated browser acceptance

Deploy **this branch only** to a non-production Vercel Preview and sign in with an Academy Owner test account. Never share passwords or session tokens.

1. Check `/dashboard` continues to display the original dashboard.
2. Open `/ui-c2-5-preview`; verify the same academy, counts, session list and currency amounts as `/dashboard`.
3. Test Players/Centers/Batches links; select each center and confirm batches with zero players remain visible.
4. Test attendance links for each session; confirm centerId and batchId are retained.
5. Confirm the last-seven-day attendance calculation uses recorded marks, not an average of batch percentages. Zero recorded marks must show a no-data state.
6. Confirm financial cards for billed/collected/expenses/outstanding and separate pending/partial/paid counts. Follow payment links.
7. Check enquiry center links are scoped and the counts match the original dashboard.
8. Repeat at 1440px desktop, 768px tablet, 390px and 320px mobile. Sessions should be visible before the player overview on small screens. Verify no horizontal overflow or undersized touch controls.
9. For negative RBAC tests, sign in as Super Admin, Coach and Parent separately and attempt the preview URL directly; deny access. Test a second academy Owner to confirm tenant isolation.
10. Check browser console, errors, refreshing the route, back navigation and no unintended writes.

**Acceptance gate:** Product Owner approves design; all role tests and UI/data comparisons pass; build passes; unrelated full-suite issues are documented separately; only then plan a merge. No production switch is authorized by this document.
