# Attendance AM1 — Unified navigation checkpoint

**Date:** 2026-11-05  
**Branch:** `payment-module-finalization`  
**State:** AM1 navigation and view-selection UI **implemented**; focused tests/CI **authored**, runtime Jest/build and product-owner browser acceptance **pending**.

## Purpose and constraints

Provide **one Attendance sidebar entry** and a consistent two-view selection surface, following the existing Coaches & Assignments / Player Performance navigation pattern. The initial AM1 change is **navigation-only**: preserve each existing component, route, query, attendance record mutation, assigned-session selection, date/filter state and security boundary.

No Supabase migration, new database table, RLS/RPC, permissions helper change or data-retrieval refactor is required or applied.

## AM1 — implemented

### New shared component

- `frontend/src/components/AttendanceWorkspaceTabs.js` and `.css`
- Displays **Mark Attendance** and **Attendance History** cards as accessible, keyboard-operable **navigation links** (not stateful tab panels).
- Provides a clear selected state from the current URL, including routes with dashboard query parameters. One selected card for an authorized current route.
- Responsive: equal-height cards in two columns on desktop, a single column below 680px, focus-visible and reduced-motion support.
- **Academy Owner:** Mark links to existing `/attendance`; History links to `/attendance-history`.
- **Coach:** Mark links to existing `/coach-attendance`; History links to `/attendance-history`.
- **Super Admin:** sees **History only**, with no Mark link. Direct `/attendance` route access remains a separately tracked AM2 authorization/UI inconsistency and was **not** modified here.
- **Parent / unknown / unauthenticated:** no management navigation; Parent Portal remains the linked-player read-only view.

### Existing pages and sidebar

- Inserted shared component above each existing view inside `Attendance.js`, `CoachAttendance.js` and `AttendanceHistory.js`. Each page continues to own its own `Layout`, data loading, filters and save/edit/soft-delete behavior.
- `Sidebar.js`: removed the separate Attendance History entry and retained exactly one **Attendance** item per management role. Defaults: Owner `/attendance`, Coach `/coach-attendance`, Super Admin `/attendance-history`. Sidebar highlights Attendance even while History is open.
- `AppRoutes.js` is **unchanged**. In particular, `/attendance`, `/coach-attendance`, and `/attendance-history` remain protected exactly as before.
- Academy Owner Dashboard `/attendance?centerId=...&batchId=...` and Coach Dashboard `/coach-attendance?scheduleId=...&date=...` and `?batchId=...` deep links are unchanged.

### Authorization and known gaps

- **Do not infer permissions from navigation visibility.** The active app route guards and Supabase RLS still enforce access.
- Verified previously: Academy Owner and Coach have role-scoped attendance creation; Super Admin is **not** permitted by the live attendance INSERT policy despite a legacy permissive frontend `canManageAttendance` helper. For AM1, Super Admin sees only History navigation. **AM2 must align the legacy direct `/attendance` route/page and marking controls with the role matrix** without widening RLS.
- The Coach History Edit button currently appears for older attendance records even when RLS disallows Coach updates older than seven days. **AM4** should align per-record action visibility with that date rule; no security policy change in AM1.
- Selecting another route discards in-memory unsaved marking selections in the current marking component, just as the previous sidebar navigation did. Consider dirty-form confirmation during AM2/AM3 if appropriate; do not claim draft preservation.

## Tests authored (not executed)

- `frontend/src/components/AttendanceWorkspaceTabs.test.js`: Academy Owner, Coach, Super Admin, Parent/unknown roles, selected state, history switching, URL query parameters.
- `frontend/src/components/Sidebar.test.js`: one Attendance link per role, role-correct destination, selected sidebar on History, legacy direct URL and no Parent management link.
- `.github/workflows/attendance-am1-validation.yml`: locked `npm ci`, scoped Jest for both test files and production React build on relevant source changes; manual workflow dispatch supported.

**Source review** checked all existing route declarations remain intact, original marking and History handlers remain present, Super Admin has no new Mark navigation, and both new navigation/UI tests exercise the intended role destinations. This is **not** evidence of a passing Jest/build result.

## AM1 acceptance matrix — pending owner/browser verification

| ID | Scenario | Expected |
| --- | --- | --- |
| AM1-01 | Academy Owner sidebar | One Attendance item; opens Mark; no separate History sidebar item |
| AM1-02 | Academy Owner workspace | Mark and History cards; active card follows route |
| AM1-03 | Coach sidebar | One Attendance item; opens existing Coach Attendance |
| AM1-04 | Coach workspace | Mark and History; Coach session selection/save behavior unaffected |
| AM1-05 | Super Admin | Attendance sidebar opens History; no Mark card in shared selector |
| AM1-06 | Parent | No attendance management navigation; Parent Portal unchanged |
| AM1-07 | Owner Dashboard deep link | `centerId` and `batchId` reach existing marking component |
| AM1-08 | Coach Dashboard deep link | `scheduleId`, `date`, `batchId` reach existing Coach Attendance |
| AM1-09 | History direct link | Still displays filters, five-per-page results, edit/delete as previously authorized |
| AM1-10 | Desktop, tablet, 320/375px mobile | Cards stack correctly, no horizontal overflow, focus-visible and touch access |
| AM1-11 | Current HEAD | Focused CI Jest/build, Vercel and Owner/Coach/Admin/Parent browser verification recorded |

## Subsequent phases (NOT implemented here)

- **AM2:** Integrate Owner/Admin mark view; resolve Super Admin direct-route UI and avoid unsupported marking.
- **AM3:** Integrate and improve Coach mark flow while preserving Dashboard deep links and Coach edit window.
- **AM4:** Integrate History and improve its filters/per-record action visibility; do not alter history edit/delete semantics without explicit review.
- **AM5:** Canonical `/attendance?view=...` routing with compatibility handling, cross-role/tenant regression, QA and documentation. Migrate routes only when all entry-point links are verified.
- **AM6/AM7:** Separate UX optimization of marking and History after the navigation merge is stable.

## Local verification commands

```bash
git status --short
git branch --show-current
git pull origin payment-module-finalization
git rev-parse HEAD
cd frontend
CI=true npm test -- --watchAll=false --runInBand --testPathPattern='(AttendanceWorkspaceTabs|Sidebar)\.test\.js$'
npm run build
npm start
```

GitHub Actions: <https://github.com/saurabh-shelke1993/acadpro-app/actions/workflows/attendance-am1-validation.yml>.

**Do not mark AM1 runtime tested merely because GitHub source and test cases were committed.** Run the actual tests/build and browser acceptance against the final SHA.
