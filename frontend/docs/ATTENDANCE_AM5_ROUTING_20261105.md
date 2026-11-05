# Attendance AM5 — Canonical routing and regression checkpoint

**Date:** 5 November 2026  
**Branch:** `payment-module-finalization`  
**Status:** AM5 routing, navigation, deep-link updates, regression test sources and CI configuration **implemented**. Latest-HEAD Jest/build, Vercel release verification, cross-role/tenant browser acceptance and live negative-RLS tests are **pending**.

## Objective and boundary

Consolidate existing Attendance marking and History navigation under one canonical React Router workspace **without rewriting the marking, Coach session, History queries or database mutations**. Reuse existing `Attendance.js`, `CoachAttendance.js`, `AttendanceHistory.js` and their own `Layout`; the new wrapper only chooses which component to mount. Never infer tenant authorization from the URL: `ProtectedRoute`, database-derived role verification inside the wrapper, scoped queries and Supabase RLS remain enforced.

## Canonical URL contract

| Route | Academy Owner | Coach | Super Admin | Parent |
| --- | --- | --- | --- | --- |
| `/attendance` (no view) | Replace URL with `?view=mark` | Replace URL with `?view=mark` | Replace URL with `?view=history` | Denied by route guard |
| `/attendance?view=mark` | Existing Owner `Attendance` | Existing `CoachAttendance` | Replace URL with `?view=history` | Denied |
| `/attendance?view=history` | Existing `AttendanceHistory` | Existing `AttendanceHistory` | Existing `AttendanceHistory` | Denied |
| Unknown `view` | Normalize to Mark | Normalize to Mark | Normalize to History | Denied |
| `/attendance-history` | Replace to canonical History | Replace to canonical History | Replace to canonical History | Denied |
| `/coach-attendance` | Original role guard denies access | Replace to canonical Mark | Original role guard denies access | Denied |

The `/attendance-history` and `/coach-attendance` compatibility redirects preserve **all query parameters and URL hash**, while overriding only `view` to match the legacy route's intended view. Redirects use `replace` to avoid browser-history loops. Current Owner `/attendance?centerId=...&batchId=...` also normalizes to Mark without dropping those parameters.

### Internal links updated

- `Sidebar.js`: one Attendance link, role-specific canonical `?view=mark` for Owner/Coach and `?view=history` for Super Admin; legacy destinations still receive active sidebar highlighting.
- `AttendanceWorkspaceTabs.js`: `Link` cards to canonical Mark/History URLs, selected state based on the actual `view` value (not just pathname). History-only for Super Admin; no management links for Parent/unauthenticated users. Switching cards intentionally discards unsaved page-local inputs as previous cross-page navigation did.
- `CoachDashboard.js`: assigned session/date/batch links now use `/attendance?view=mark` and preserve encoded `scheduleId`, `date`, `batchId`.
- `components/Dashboard/AcademyOwnerDashboard.js`: daily center/batch marking links now include `view=mark` with encoded `centerId` and `batchId`.
- `Dashboard.js`: attendance metric links lead to canonical History. Quick action remains Mark for Owner and becomes History for Super Admin, avoiding a misleading 'Mark Attendance' action for a history-only role.
- Previously bookmarked, shared or third-party links to old routes remain valid through their original `ProtectedRoute` and compatibility redirects.

## Code changes and no-change boundary

- **Added:** `frontend/src/pages/AttendanceWorkspace.js`. Uses `getCurrentUser()` to fetch the current database-backed application role and selects the existing view. The parent `ProtectedRoute` also validates authentication/role. This temporarily adds one additional role lookup to the Attendance entry route, not a bypass or any attendance mutation.
- **Modified:** `frontend/src/routes/AppRoutes.js`: canonical `/attendance` accepts Super Admin, Owner and Coach; old Coach and History URLs remain protected and now use the redirect component; Parent not granted any management route.
- **Unchanged:** `Attendance.js`, `CoachAttendance.js`, `AttendanceHistory.js`, `attendanceService.js`, permission matrix, attendance SQL functions/policies, existing filters, role scopes, saving/editing/deletion and the non-transactional Coach update path.
- **No migrations or production attendance writes/deletes** occurred during this implementation. Existing Supabase RLS remains authoritative.

## Regression test source and CI

- Added `frontend/src/pages/AttendanceWorkspace.test.js`: direct canonical navigation, Owner/Coach role-specific view mounting, default and invalid view normalization, Super Admin history-only behavior, legacy Coach/History query + hash preservation, Parent denial, authentication denial and old-route role restrictions. The test mounts `ProtectedRoute` and the actual routing wrapper, while mocking child data pages and the user lookup.
- Revised `AttendanceWorkspaceTabs.test.js` and `Sidebar.test.js` for canonical URL, selected state, legacy active state and Parent restrictions.
- Updated the former page-level `Attendance.test.js`, `CoachAttendance.test.js`, and `AttendanceHistory.test.js` expectations to canonical links; existing service/Coach edit-window test sources remain intact.
- Expanded `.github/workflows/attendance-am1-validation.yml` to **AM1–AM5**. It uses pinned Node 22, `npm ci`, a scoped Jest regex including `AttendanceWorkspace.test.js`, and the frontend production build when Attendance routes/navigation/pages/tests/dashboard links/workflow change.

**All test cases are authored, not reported as passing**. A deployment check alone does not establish route/security regression success. The connected GitHub API does not expose confirmed push-triggered Actions runs; use the linked Actions workflow or execute locally to obtain actual Jest output.

## Acceptance matrix for release QA — PENDING

| ID | Scenario | Expected |
| --- | --- | --- |
| AM5-01 | Owner sidebar / no-view `/attendance` | Canonical `?view=mark` with existing Owner marking UI |
| AM5-02 | Coach sidebar / no-view `/attendance` | Canonical `?view=mark` with assigned-session Coach UI |
| AM5-03 | Super Admin sidebar / direct `?view=mark` | Canonical `?view=history`; no marking controls or INSERT |
| AM5-04 | Parent `/attendance`, `/attendance-history`, `/coach-attendance` | Existing protected guards deny management access |
| AM5-05 | Owner Dashboard center/batch | Canonical Mark retains `centerId`/`batchId`, selects scoped session |
| AM5-06 | Coach Dashboard date/session/batch | Canonical Mark retains `scheduleId`, `date`, `batchId` |
| AM5-07 | Old `/attendance-history` URL with filters/query/hash | Redirect to History, original parameters/hash retained |
| AM5-08 | Old `/coach-attendance` URL with session/date/hash | Redirect to Coach Mark, original parameters/hash retained |
| AM5-09 | Unknown `view`, direct URL tampering | Role-appropriate normalization; role/tenant constraints preserved |
| AM5-10 | Mark → History → Mark | One selected card, clean browser back/forward; no stale cross-view state |
| AM5-11 | Owner marks test session | Existing insert/duplicate/future-date rules preserved; History reflects results |
| AM5-12 | Coach old record and recent record | Read-only outside UTC `CURRENT_DATE - 6`..today; recent edit remains scoped |
| AM5-13 | Owner/Admin edits/deletes test History record | Existing permissions and soft-delete retained |
| AM5-14 | Different academy or unauthorized Coach session | RLS and data-scope layer deny unauthorized access/updates |
| AM5-15 | 320/375/430px, tablet 768px, desktop 1440px | One sidebar item, usable selector, no horizontal overflow/action clipping |
| AM5-16 | CI and deployment | Exact-SHA Jest, build, Vercel, Owner/Coach/Admin/Parent browser evidence recorded |

A route-level mocked test **does not replace** a live Supabase negative-RLS test or end-to-end browser walkthrough. Avoid modifying real player attendance solely for QA; use authorized test records.

## Validation commands

```bash
git status --short
git branch --show-current
git pull origin payment-module-finalization
git rev-parse HEAD
cd frontend
CI=true npm test -- --watchAll=false --runInBand --testPathPattern='(AttendanceWorkspace|AttendanceWorkspaceTabs|Sidebar|Attendance|CoachAttendance|AttendanceHistory|attendanceEditWindow|attendanceService)\.test\.js$'
npm run build
npm start
```

CI: <https://github.com/saurabh-shelke1993/acadpro-app/actions/workflows/attendance-am1-validation.yml>.

## Deferred

- **AM6** improve Mark Attendance layout/flows after product-owner review.
- **AM7** improve Attendance History UX and evaluate server-filtered pagination for scale.
- Coach bulk updates remain non-transactional. No unapproved transactional RPC or attendance schema changes were bundled into routing consolidation.

**Do not mark AM5 release-accepted until the exact-HEAD automated test/build results, all-role browser navigation and negative tenant authorization checks are recorded.**
