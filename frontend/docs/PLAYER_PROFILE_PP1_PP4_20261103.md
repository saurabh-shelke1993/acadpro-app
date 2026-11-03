# Player Profile — PP1–PP4 implementation checkpoint

**Date:** 2026-11-03  
**Branch:** `payment-module-finalization`  
**Status:** PP1–PP4 **implemented and source-reviewed**; automated Jest/build and owner/coach/admin browser acceptance **PENDING**.

## Verified existing implementation

The active Player Profile is rendered inside `frontend/src/pages/Players.js`, as the full-viewport `coach-player-modal` workspace. It is not a standalone `PlayerProfile.js` route. Snapshot data comes from `getPlayerProfileSnapshot` in `frontend/src/services/playerProfileService.js` and includes active enrolled training sessions, all recorded present/absent attendance and (only when authorized) net recorded payments for the latest three calendar months. This implementation continues to use that service and the existing page's role guards.

## Implemented

### PP1 — Consolidated identity and actions
- Combined the duplicated Player Details title card and separate Player Profile card into a single compact identity panel.
- Preserved photo/initials, photo upload for Academy Owner, active/inactive status, player name, batch and center.
- Edit and **Deactivate** controls now sit beside Close in the hero, still guarded by `isAcademyOwner(loggedInUser)`. Existing edit/deactivation callbacks are unchanged. The trash action tooltip now correctly says `Deactivate player`.
- Single profile H2 is the existing `aria-labelledby` target of the full-screen role=dialog. No new modal state.

### PP2 — Denser personal and parent information
- Split the old long 9-field information area into **Player information** and **Parent & contact** panels.
- Player panel: DOB, Gender, Joining date. Center and batch remain in the hero rather than being repeated.
- Parent panel: parent name, phone, email, address. Values and access are unchanged from the existing page.
- Date-only values are formatted consistently with a four-digit year (e.g., `13 May 2025`, `09 Jun 2026`), avoiding timezone shifts and returning a dash on missing/invalid dates.
- Desktop panels sit side by side, then stack on tablets/mobile. They use compact accessible `dl`/`dt`/`dd` labels.

### PP3 — Training, attendance and fee snapshots
- Training schedule now shows **weekly sessions**, day and time; center/batch detail is displayed per session only if it differs from the player's identity panel.
- Attendance is explicitly labeled **Overall attendance**, not current month. It shows the actual number present out of all recorded present/absent sessions, plus their counts. Existing attendance calculations remain untouched.
- Fee snapshot uses the existing three-calendar-month net-payment series; copy clarifies net recorded payments rather than claiming outstanding dues or a new billing period.
- Loading states are explicit. A service error displays unavailable messaging instead of erroneously displaying `No sessions` / `No attendance` / `No payment summary`.
- The existing non-fetch and true-empty states are retained with useful copy.

### PP4 — Report link and responsive behavior
- Added **View performance report** in the Player Development portion of the attendance card for Super Admin, Academy Owner and Coach.
- Link uses the **existing** `/player-performance-report?player=<id>` route, with URL-encoded player ID; the report already handles authenticated, role-scoped `?player=` deep links. No new performance data request is made on the profile.
- Parent-management access was not introduced. Existing Report role authorization and Supabase RLS remain the security boundary.
- CSS scoped to the current Player Profile provides compact hero/actions, 2-panel information layout, schedule/attendance refinements, focus-visible links/actions and mobile stacking.

## Changed files

- `frontend/src/pages/Players.js` — existing profile JSX only plus shared date helper and React Router Link
- `frontend/src/pages/Players.css` — appended PP1–PP4 profile-scoped styles
- `frontend/src/utils/playerProfilePresentation.js` — pure date and schedule context helpers
- `frontend/src/utils/playerProfilePresentation.test.js` — five **authored, not executed** cases (DOB/join date, timezone-stable date, invalid/missing date, repeated versus different schedule context)

**Not changed:** `playerProfileService.js`, Player creation/update/deactivation behavior, player/parent records, payment calculations, schedule enrollment, routes, database tables/migrations, RPCs, RLS policies or global permissions.

## Manual acceptance matrix — PENDING

| ID | Role/viewport | Expected |
| --- | --- | --- |
| PP1-01 | Academy Owner desktop | One compact identity panel with player name, photo, status, batch/center and Edit, Deactivate, Close |
| PP1-02 | Coach desktop | Compact profile header with Close; no unauthorized Edit/Deactivate/photo-upload |
| PP1-03 | Academy Owner | Edit launches existing edit form, Deactivate uses existing confirmation/rules, Close returns to Players |
| PP2-01 | Owner/Coach desktop | Side-by-side Player information and Parent & contact cards; no truncated phone/email/address |
| PP2-02 | Date-only values | DOB and joining date use `DD Mon YYYY` without day shifting |
| PP3-01 | Player with weekly sessions | Schedule days/times accurate; repeated center/batch omitted only if same as profile |
| PP3-02 | Player with 3 present, 1 absent | Overall attendance displays 75%, 3 of 4 and counts, not a monthly attendance claim |
| PP3-03 | Player with no attendance/schedule | Meaningful empty state, not 0% fabricated |
| PP3-04 | Snapshot request fails | Specific unavailable text and existing error alert, not false no-records state |
| PP3-05 | Academy Owner/Super Admin | Three-month fees show current service's net payment values; Coaches never see fees |
| PP4-01 | Academy Owner/Coach | Performance Report link opens the correct authorized `?player=` report |
| PP4-02 | Player without assessments | Link opens Report's existing no-data state without invented scores |
| PP4-03 | 320px / 375px / 768px | Header/actions and cards wrap without horizontal overflow; labels and link remain accessible |
| PP4-04 | Keyboard-only | Tab focus on Close, allowed actions, photo upload and Report link; no keyboard trap |
| PP4-05 | Super Admin / cross-academy | Report deep link opens only the player authorized through existing data scope; fee access unchanged |

**Do not execute real deactivation or photo/payment mutations on production players merely for testing.** Use authorized test fixtures and record test results against the exact Git SHA.

## Validation commands (when user reviews)

```bash
git status --short
git branch --show-current
git pull origin payment-module-finalization
git rev-parse HEAD
cd frontend
CI=true npm test -- --watchAll=false
npm run build
npm start
```

Source consistency and branch diff checks are useful but **do not constitute Jest, production build, mobile browser or RBAC acceptance**. No such PASS is claimed.

## Next step

Product owner reviews PP1–PP4 visually and checks role-specific behavior. Focused PP5 regression, accessibility and final documentation acceptance can follow after the visual review without further changes to player CRUD or Supabase.
