# Kheltriva — AM6.1–AM6.6 Mark Attendance UX checkpoint

**Date:** 5 November 2026
**Branch:** `payment-module-finalization`
**Status:** AM6.1–AM6.6 **implemented**; AM6.6 **scoped Jest/build PASS** at `728652df` (10/10 suites, 82/82 tests). Live Owner/Coach/browser/RBAC/release acceptance **pending**.

## Approved scope

Improve the daily Mark Attendance experience for Academy Owner and Coach, using the existing `/attendance?view=mark` route and existing separate Owner (`Attendance.js`) / Coach (`CoachAttendance.js`) components. Preserve Supabase RLS, Academy Owner insert rules, Coach assigned-session and seven-UTC-calendar-date existing-record update window, attendance duplicate detection, History edits/soft deletes and Dashboard deep links.

The shared Attendance view selector is **not** redesigned in AM6; consider a compact segmented selector in a separate shared-navigation refinement, after Owner approval. **AM7 Attendance History optimization remains separate.**

## Implemented phases

### AM6.1 — Compact filters / 12-hour session labels

- Owner `Attendance.js` now renders **Center → Batch → Date → Session** in one compact desktop filter grid. The redundant disabled Academy dropdown is removed; the actual selected academy's name is still displayed as **Academy context** in the heading. Its underlying `selectedAcademy`/academy scoped fetch and owned academy state remain unchanged.
- Coach retains the two filters appropriate to their assigned sessions: Date and Assigned Session. The selected assigned-session context is still displayed.
- Both Mark pages use `utils/attendancePresentation.js` to render schedule time values in 12-hour AM/PM form (e.g. Thursday · 5:00 PM–6:00 PM). No database timestamps or service values are changed; only presentation is formatted.
- Session selection, Owner dashboard Center/Batch query parameters and Coach dashboard Schedule/Date/Batch parameters remain intact.

### AM6.2 — One compact roster total strip

- New shared `components/AttendanceRosterSummary.js` is mounted **once, directly above each roster**, showing Total, Present, Absent and Unmarked.
- Owner no longer has a second large four-card summary above the roster. Coach's old large summary in the list has been replaced by the same compact component.
- The sticky Owner/Coach action footer now communicates **X unmarked / Ready to save**, rather than repeating the entire four-number summary.
- Counts are derived from the **visible roster and unsaved local P/A state**. Bulk selection, Reset and individual radio changes update totals immediately. No extra read/write queries are introduced.

### AM6.3 — Faster, accessible marking

- Existing **radio groups** and P/A keyboard behavior are preserved, with 44px minimum tap targets, stronger selected-green (Present) and selected-red (Absent) states and visible keyboard focus styling.
- Each radio has a player-specific accessible label (e.g. Mark Pratik Maheshwari present), while each roster name displays **Present / Absent / Not marked**.
- Existing **Mark all present / Mark all absent** buttons only mutate local draft state. They never save automatically; buttons are disabled while loading/saving and for recorded Owner or date-restricted Coach attendance.

### AM6.4 — Save, Reset and feedback

- Owner Save is disabled unless: selected schedule is valid, roster is non-empty, all players are marked, attendance is not already recorded, and no load/save is in progress. Existing Owner duplicate check and read-only recorded-attendance behavior remain. Reset clears unsaved Owner draft selections.
- Coach Save/Update is disabled until all players are marked and the session is valid and editable. For previously recorded sessions, **Reset restores the fetched recorded P/A values**; for new/unrecorded sessions Reset clears all unsaved marks. No Reset or bulk-mark API calls.
- Coach update restrictions (seven UTC calendar dates), record-level RLS and the previous non-transactional per-row update semantics remain unchanged.
- Owner empty-state copy now distinguishes **no selected batch**, **no selected session**, **truly empty roster** and **failed roster load**; existing explicit success/error alerts and saving indicators remain.

### AM6.5 — Responsive/accessibility regression preparation

- Updated `Attendance.css` only for the Mark workspace: 4 fields across on larger desktop, 2 on tablet, 1 on very narrow phones; live summary strip 4 across except 2 × 2 on very small phones; roster table width adapts without horizontal scrolling at phone/tablet widths; P/A and Save/Reset use 44px minimum touch targets.
- Long player names wrap rather than getting clipped; focus-visible and reduced-motion support retained. Sticky action footer respects narrow layouts and safe-area padding.
- Added pure `attendancePresentation.test.js` (5 authored tests), expanded `Attendance.test.js` (3 new AM6 tests), expanded `CoachAttendance.test.js` (3 new AM6 tests) and adjusted one existing Coach test for the newly approved **disabled Save until all players marked** contract. Existing AM1–AM5 regression files are retained.
- Expanded `.github/workflows/attendance-am1-validation.yml` to **AM1–AM6**, including the new files and focused Jest tests plus React build. **At the original AM6.5 checkpoint, test execution was unverified; see AM6.6 PASS below.**

## Change boundaries / risk

- **No changes** to `attendanceService.js`, `scheduleViewService.js`, `AttendanceHistory.js`, database schema/migrations/RLS/RPC, Auth/roles or legacy URL compatibility.
- Owner marking remains *insert-only*, with read-only existing attendance; corrections still take place through History.
- Coach still updates existing records one row at a time, not via an atomic RPC. Failed/partial updates remain a separately tracked risk, not part of AM6.
- Frontend Save gates and radio controls are UX safety measures, **not authorization**. Backend RLS remains authoritative.
- The selected Mark page is still the existing dedicated component, chosen by the AM5 authenticated Attendance workspace.

## Owner manual acceptance checklist — PENDING

| ID | Role / device | Expected |
| --- | --- | --- |
| AM6-01 | Owner desktop | Academy name shown as context, **no disabled Academy dropdown** |
| AM6-02 | Owner desktop | Center, Batch, Date, Session in one row where width allows; consistent 12-hour session time |
| AM6-03 | Owner 375px / 320px | Filters stack, roster remains within viewport, names wrap, no horizontal table scrollbar |
| AM6-04 | Coach desktop/mobile | Date + assigned session controls; session context; 12-hour labels |
| AM6-05 | Owner/Coach selection | P/A chip selected state obvious, controls keyboard accessible, live tally updates |
| AM6-06 | Owner new test session | Save disabled with unmarked players; both Mark All buttons fill draft, **no auto-save** |
| AM6-07 | Owner new test session | Reset clears draft marks and Save disables again; Save only once all marked |
| AM6-08 | Owner existing attendance | Values visible, radio/bulk disabled, no duplicate Save, History remains correction destination |
| AM6-09 | Coach new test session | Mark All and Reset clear local draft; Save gates on fully marked roster |
| AM6-10 | Coach existing session within UTC 7-date window | Reset restores *loaded* recorded values after draft edits; Update only when fully marked |
| AM6-11 | Coach existing session outside UTC 7-date window | Read-only notice and disabled radio/bulk/Reset/Update, values remain visible |
| AM6-12 | Error and loading | No false empty-record success; explicit error messages and disabled Save during fetch/save |
| AM6-13 | Owner/Coach dashboard deep links | Center/Batch and Date/Schedule filters still populated and scoped |
| AM6-14 | 320 / 375 / 430 / 768 / 1440px | No overlap/clip, 44px radio/save targets, clear focus and footer visibility |
| AM6-15 | RBAC | Super Admin Mark remains history-only; Parent denied; Coach assigned sessions and tenant scope still enforced |
| AM6-16 | Release validation | Exact Git commit SHA, focused Jest + full React build, Vercel status and real browser role evidence recorded |

**Use synthetic authorized players/sessions for write testing; do not change live business attendance merely for regression.**

## Validation commands (PENDING EXECUTION)

```bash
git status --short
git branch --show-current
git pull origin payment-module-finalization
git rev-parse HEAD
cd frontend
CI=true npm test -- --watchAll=false --runInBand --testPathPattern='(AttendanceWorkspace|AttendanceWorkspaceTabs|Sidebar|Attendance|CoachAttendance|AttendanceHistory|attendanceEditWindow|attendancePresentation|attendanceService)\.test\.js$'
npm run build
npm start
```

GitHub Actions: <https://github.com/saurabh-shelke1993/acadpro-app/actions/workflows/attendance-am1-validation.yml>

**Do not mark AM6 browser/role/security accepted or release-ready** until Owner/Coach/device checks and negative RBAC/RLS tests have actually passed; scoped Jest/build are verified at the AM6.6 source SHA.

## Next

After Owner visual acceptance, begin **AM7 Attendance History UX** separately. If there are AM6 visual refinements, handle them in a limited corrective phase, not as a new data flow.

## AM6.6 — Compact Owner/Coach session context, focused CI (5 November 2026)

**User-requested changes implemented:**
1. Remove the tall red-box `Daily operations` header section on both Owner and Coach Mark Attendance; keep a visually hidden H1 for page structure. Reduce the second red-box roster heading to compact `Players · N enrolled` and keep bulk actions beside it.
2. Owner green-box selection area: retain `Center → Batch → Date → Session` and compact academy context. Once a batch is chosen, show its active weekly weekdays as `Runs: Mon · Wed · Fri` (example only, never a hardcoded schedule). Added `getActiveBatchAttendanceDays(batchId, centerId)` that reads only `batch_schedules.day_of_week` for the selected active batch/center. The existing `getAttendanceSessionsForBatch` still finds *only* sessions on the chosen date. Loading, empty and failure states show honest text; failure of the supplementary weekday lookup never authorizes or writes attendance.
3. Coach green-box selection area: keep `Date` and `Assigned Session`, but each option now identifies **Batch · Weekday · 12-hour time · Center**. A compact context strip repeats the selected batch, center and session timing immediately above the roster. It reuses existing assigned-session data, without broadening Coach data scope or adding database requests.
4. Preserve P/A, Mark All, Reset, Save gating, recorded read-only and seven-UTC-date Coach edit behavior. No History, attendance mutation, RLS, RPC, schema or migration changed.

**Source/test commits:** [`b97b58c`](https://github.com/saurabh-shelke1993/acadpro-app/commit/b97b58c35ae1f23b384365d9ccbc1e391636666c) (UI, read-only helper and tests); [`a546615d`](https://github.com/saurabh-shelke1993/acadpro-app/commit/a546615d2ece837aca790f1507e0d3bd8f2e460e) (canonical sidebar accessibility assertions and focused CI inclusion); [`728652df`](https://github.com/saurabh-shelke1993/acadpro-app/commit/728652df1bcb80087b36bd2049d09c614e966820) (mock auth/Supabase in sidebar-only accessibility tests).

**Executed CI evidence:** GitHub Actions Attendance run [41962962698](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/41962962698) for `728652df`: **10/10 suites PASS, 82/82 tests PASS, React production build compiled successfully**. The earlier AM6 CI run [41962557584](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/41962557584) had passed 9/9 suites and 77/77 tests before the sidebar accessibility suite was added. The latest full frontend Phase 7.5 Jest suite at `728652df` remains **FAIL (4 suites, 16 tests of 288)** in Coach Profile and Player Performance tests; this is a separate cross-module backlog, not an Attendance-specific CI pass.

**Manual Owner acceptance still required:** Owner batch operating days for multiple real training patterns, selected-date no-session behavior, Coach session dropdown and context accuracy for multiple assignments, permissions for Admin/Parent and cross-academy requests, Mark All/Reset/new and existing attendance behavior, dashboard deep links, plus widths 320/375/430/768/1440px. Record screenshots/role results. Do not mutate real player attendance for testing; use controlled fixtures.

**Release status:** Focused automated validation completed; live visual/functional/RBAC and deployment release acceptance **pending**. **AM7 Attendance History UX remains planned, not started.**
