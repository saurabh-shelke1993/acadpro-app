# Kheltriva Attendance — AM2–AM4 integrated implementation checkpoint

**Date:** 5 November 2026  
**Branch:** `payment-module-finalization`  
**Status:** AM2, AM3 and AM4 **implemented in source**; AM2–AM4 regression test source and scoped CI **authored**. Latest-HEAD Jest, production build, role/viewport/browser and live security regression **not confirmed**. Product owner requested combined visual testing after all three phases.

## Source-of-truth and constraints verified

- Three existing routes and components remain: `/attendance` (Academy Owner marking), `/coach-attendance` (Coach assigned sessions), and `/attendance-history` (role-scoped History). AM1 already provided a single sidebar item and two selection cards; **AM5 canonical routing is not implemented**.
- The active Supabase project `ulyealhkmlorsbdiknrh` was checked **read-only**. `public.attendance` INSERT policy allows Academy Owner within their academy or Coach within an authorized assigned session. It does **not** allow Super Admin inserts. SELECT, UPDATE and DELETE have their own role/tenant conditions.
- The active `private.can_coach_update_attendance_schedule` RLS helper permits Coach updates of existing, non-deleted authorized attendance only between **`CURRENT_DATE - 6` and `CURRENT_DATE` inclusive**, with assigned-session scope; database timezone was verified as **UTC**. On 2026-11-05 the window is 2026-10-30 through 2026-11-05. This is **seven calendar dates**, not a rolling 168-hour interval.
- No live records were modified; no migration, RLS/RPC change, attendance policy grant, role change or table relationship was invented.

## AM2 — Academy Owner / Super Admin marking

**Files:** `frontend/src/pages/Attendance.js`, `frontend/src/pages/Attendance.test.js`.

- Existing Academy Owner marking filters, roster loading, session/date selection, duplicate validation, P/A state, bulk actions and saving are preserved.
- Super Admin **direct `/attendance` navigation** redirects to `/attendance-history` once their authenticated user role is resolved, matching the AM1 History-only entry. The marking save guard and action visibility are now explicitly **Academy Owner-only**, independent of the legacy generic `canManageAttendance` permission helper.
- Owner's marking page heading is **Mark Attendance**, aligning with the AM1 selector. Added a future-date UI maximum and a save-time future-date validation, using the same UTC calendar as the database.
- The original owner dashboard `/attendance?centerId=...&batchId=...` remains untouched. No Coach marking mutation logic was migrated into Owner marking.

## AM3 — Coach assigned-session marking

**Files:** `frontend/src/pages/CoachAttendance.js`, `frontend/src/pages/CoachAttendance.test.js`, shared date helper.

- The original Coach Dashboard `/coach-attendance?scheduleId=...&date=...` and `?batchId=...` deep links, schedule selection, session roster, P/A controls, bulk actions and insert/update logic remain.
- The roster query waits until `getCoachAttendanceSessions` returns a matching authorized session. Tampered/stale `scheduleId` values are normalized to available assigned sessions, rather than querying unverified session rosters.
- When attendance already exists and is **older than the seven UTC calendar dates**, the roster is **read-only**: a clear inline notice appears and radio, bulk and Update controls are disabled; save-time and post-query checks independently enforce the rule.
- Older **unrecorded** session marking is not newly prohibited by this UI restriction; whether inserting is allowed remains subject to the existing assigned-session/date INSERT RLS. No new backfill policy is introduced.
- Coach existing-record updates now request the updated IDs and report an error if any RLS-filtered row was not updated. **Important pre-existing limitation:** this is still a per-row `Promise.all` update, not one atomic transaction. A partial failure is reported to the user, but a transactional rewrite is not part of AM3.
- Coach page heading standardized to **Mark Attendance** and date input max aligned to UTC date.

## AM4 — Attendance History

**Files:** `frontend/src/pages/AttendanceHistory.js` / `.css`, `frontend/src/services/attendanceService.js`, History / service / helper tests.

- Existing Academy/Center/Batch/Player/Status/date filters, five-record client pagination, sorting, data scope, history soft-delete and current service calls are retained.
- A pure helper `frontend/src/utils/attendanceEditWindow.js` checks record date in the verified UTC seven-calendar-date window and permits full historical edit visibility for Academy Owner and Super Admin. Invalid/missing record/date fails closed.
- Coach History now shows **Edit** only for permitted dates and a neutral **Read-only** label on older rows, with an explanatory note above the list. Coach Delete remains unavailable. Owner/Super Admin retain their existing edit and delete controls.
- History's Save handler re-evaluates current per-record eligibility immediately before mutation to prevent a stale open editor from bypassing UI restrictions.
- Shared `updateAttendanceStatus` now calls `.select("id")` and requires exactly one updated row, rather than erroneously reporting success for zero RLS-visible rows. Insert and soft-delete functions otherwise remain unchanged.
- No fetch-all/server-pagination redesign, bulk correction RPC or data migration was bundled into this UI integration; History optimization AM7 remains separate.

## Tests authored (not executed)

- `frontend/src/pages/Attendance.test.js`: **2** cases — Super Admin direct-route redirect; Owner marking UI.
- `frontend/src/pages/CoachAttendance.test.js`: **4** cases — old existing attendance read-only, unrecorded past date behavior, invalid-session deep-link scope, Coach Dashboard query route.
- `frontend/src/pages/AttendanceHistory.test.js`: **4** expanded cases — Coach recent/old actions, Owner/Admin older editing and deleting, History route/data loading.
- `frontend/src/utils/attendanceEditWindow.test.js`: **8** cases — inclusive UTC window, future/older cutoff, year/leap boundary, invalid date, Owner/Admin/Parent roles, missing row ID.
- `frontend/src/services/attendanceService.test.js`: **4** cases — successful update, zero-row RLS denial, DB error propagation and unchanged INSERT.
- **22 new focused AM2–AM4 cases**, alongside **18 previously authored AM1 navigation cases**, for **40 scoped cases in total**. Source review is not a Jest PASS.
- Updated existing `.github/workflows/attendance-am1-validation.yml` to run the AM1–AM4 scoped tests and production build on relevant source/test changes using locked `npm ci`.

## Combined Owner/Coach/Admin manual acceptance matrix — PENDING

| ID | Scenario | Expected |
| --- | --- | --- |
| AM2-01 | Owner opens single Attendance sidebar entry | Owner Mark page, both selector cards, correct active state |
| AM2-02 | Owner Dashboard center/batch deep link | Center and batch preselection continue working |
| AM2-03 | Owner marks fresh authorized test session | All P/A controls and duplicate prevention unchanged; persisted attendance appears in History |
| AM2-04 | Owner selects future date | Cannot save future attendance |
| AM2-05 | Super Admin opens Attendance sidebar or `/attendance` directly | History only, no creation controls or INSERT attempts |
| AM3-01 | Coach Dashboard session/date deep link | Correct authorized session selected; date and batch remain scoped |
| AM3-02 | Coach tries unrelated `scheduleId` | No unrelated roster; fallback to assigned session |
| AM3-03 | Coach existing session within 7 UTC dates | Update controls available, authorized changes persist |
| AM3-04 | Coach existing session older than seven UTC dates | Historical P/A values visible, all edit actions disabled |
| AM3-05 | Coach new/unrecorded historical session | Behavior unchanged subject to existing INSERT session/date RLS |
| AM3-06 | Coach update denied for some rows | UI reports failure, not blanket success; review data for partial updates |
| AM4-01 | Owner History filters and five-per-page navigation | Existing Academy/Center/Batch/Player/Status/date behavior unchanged |
| AM4-02 | Coach History older record | Read-only label; no Edit or Delete |
| AM4-03 | Coach History recent record | Edit permitted only for authorized assigned session/date |
| AM4-04 | Owner/Admin historical record | Existing Edit/Delete remain available with RLS scope |
| AM4-05 | Denied History update | No false success when RLS returns zero rows |
| AM4-06 | Soft-delete | Existing authorization, confirmation and filtering preserved |
| AM4-07 | 320px/375px mobile, tablet, desktop | Cards/filter/roster/action layouts remain readable and keyboard accessible |
| AM4-08 | Parent direct management route and cross-tenant attempts | Protected route/RLS continues to deny unauthorized access |
| AM4-09 | Navigation between views | Existing Mark/History links work without data leakage or claimed unsaved-draft preservation |
| AM4-10 | Final release validation | Exact SHA Jest, production build, Vercel, controlled role/browser and negative RLS results recorded |

**Do not test create/edit/delete using real player attendance records.** Use an authorized test academy and save timestamps/results for the acceptance record.

## Verification commands

```bash
git status --short
git branch --show-current
git pull origin payment-module-finalization
git rev-parse HEAD
cd frontend
CI=true npm test -- --watchAll=false --runInBand --testPathPattern='(AttendanceWorkspaceTabs|Sidebar|Attendance|CoachAttendance|AttendanceHistory|attendanceEditWindow|attendanceService)\.test\.js$'
npm run build
npm start
```

GitHub Actions: <https://github.com/saurabh-shelke1993/acadpro-app/actions/workflows/attendance-am1-validation.yml>.

### Next development phase

**AM5 canonical routing, compatibility links and comprehensive QA** remains planned. AM6 Mark UX and AM7 History UX enhancements are separate follow-ups after user acceptance; they must not be conflated with implemented AM2–AM4 or described as already tested.
