# Player Profile PP5 — Regression, accessibility and handoff

**Date:** 2026-11-04  
**Branch:** `payment-module-finalization`  
**Status:** PP5 focused implementation, source review, automated test source and CI configuration **committed**. Actual Jest execution, browser/viewport/RBAC acceptance and final deployment validation **pending**.

## Boundary and source of truth

The profile is still part of `frontend/src/pages/Players.js` and `frontend/src/pages/Players.css`, not a new route. PP1–PP4 introduced the compact identity header, Player/Parent information, training/attendance/payment summaries and scoped Performance Report deep link. PP5 covers regression, modal accessibility and responsive quality only.

The original `getPlayerProfileSnapshot` service, player list scoping, player CRUD/deactivation, player-photo upload service, fees aggregation and navigation route are unchanged. Existing application guards and Supabase RLS remain the authorization boundaries. No database migration, RLS policy, RPC, permission matrix or photo-storage change was made.

### PP5 accessibility and responsive refinements (implemented)

- Profile modal now locks background scrolling while open and restores the previous body overflow on close/unmount.
- On open, focus moves to **Close player details**; Escape dismisses the modal and returns focus to the originating player table row if still mounted.
- Tab/Shift+Tab are contained within the currently open dialog, including the Performance Report link. Focusable actions retain visible keyboard focus styling.
- Player table row keyboard activation ignores events originating from nested action buttons, avoiding an unintended modal open.
- Extra narrow-screen constraints protect long contact fields, the identity header, session rows and fee totals from horizontal overflow. Touch targets for header buttons and Performance link are at least 44px at phone widths, including safe-area padding and reduced-motion preference.
- Existing Academy Owner photo controls, new upload warnings and historical photo behavior are not modified.

### Role/scope invariants (reviewed, not live role-tested)

| Role | Existing Player Profile behavior retained |
| --- | --- |
| Super Admin | May view profile and existing fee snapshot within authorized app scope; profile-header Edit/Deactivate/photo-upload actions remain Owner-only, reflecting the **current UI** rather than a permission-matrix change |
| Academy Owner | Own-academy players, profile-header Edit/Deactivate, photo controls, fee snapshot, Performance Report link |
| Coach | Assigned-batch players and profile details, training/attendance, Performance Report link; no Owner-only profile-header actions or fees |
| Parent | Players management route is denied by the existing router guard; linked-player information is provided through the Parent Portal rather than this modal |

Note: Super Admin has broader player CRUD permission in `ROLE_MATRIX.md` than the current profile-header actions expose. This pre-existing UI difference was **not** changed in PP5. Evaluate it as a separate product decision if needed; do not silently expand UI behavior or infer a backend authorization change.

## Automated test source

New `frontend/src/pages/Players.test.js` includes **8 authored component cases**:
1. Academy Owner compact identity, photo/edit/deactivate controls, date and parent details, fees and academy isolation.
2. Coach assigned player, training/attendance and no fees/Owner-only controls.
3. Super Admin visibility of multiple academies and current profile action scope.
4. Correct `/player-performance-report?player=<id>` deep link.
5. True empty schedule/attendance/payment states.
6. Snapshot-service failure displays unavailable/error instead of inventing data.
7. Escape/close focus restoration and background scroll unlock.
8. Forward/reverse Tab containment within the modal.

Existing `frontend/src/utils/playerProfilePresentation.test.js` has **5 authored cases** for stable DOB/joining-date formatting and conditional schedule context.

Added `.github/workflows/player-profile-validation.yml` on `payment-module-finalization`: locked `npm ci` install, scoped PP5 Jest tests and frontend production build on profile files/workflow changes. The workflow was read back and verified to have a complete Jest file regex and exactly one build job.

**These 13 tests are authored, not reported as passing**, because this environment cannot run a complete checked-out React/Jest project and the linked GitHub workflow-run API does not expose confirmed push-run results. A Vercel build status is not a substitute for the Jest test report.

## Manual acceptance matrix (pending)

| ID | Role/device | Test case | Expected |
| --- | --- | --- | --- |
| PP5-01 | Owner desktop | Open a player with profile photo, long name, parent contacts | One header, no clipped details, Owner controls, fee values |
| PP5-02 | Coach desktop | Open an assigned player | Training/attendance visible; no photo upload, Owner actions or fees |
| PP5-03 | Super Admin desktop | Open player from either authorized academy | Only authorized data shown, fees visible; no silent permission expansion |
| PP5-04 | Parent | Navigate directly to Players management URL | Existing protected route denies access |
| PP5-05 | Owner/Coach | Keyboard Enter/Space on player row | Dialog opens, heading announces selected player, focus moves to Close |
| PP5-06 | Keyboard | Tab/Shift+Tab, Escape | Focus contained; Escape closes and returns focus to row |
| PP5-07 | Owner | Edit then Cancel; Deactivate then Cancel | Original form/confirmation flow works; no accidental updates |
| PP5-08 | Owner/Coach | Performance link | Opens the selected, authorized player report; no assessment shows existing empty state |
| PP5-09 | All authorized roles | Player with 3 present, 1 absent | Overall attendance is **75%, 3/4**; no implied monthly period |
| PP5-10 | All authorized roles | No training/attendance or failed snapshot | Proper empty vs unavailable messages, no fabricated metrics |
| PP5-11 | 320px, 375px, 430px | Long email/name, hero controls, fees | No horizontal overflow or clipped actions |
| PP5-12 | 768px tablet / 1440px desktop | Personal/Parent cards and schedule/attendance cards | Responsive stacking and readable hierarchy |
| PP5-13 | Owner test fixture | Photo upload remains private/optimized | Existing PH1–PH5 behavior unchanged; do not mutate real business photos |
| PP5-14 | Full app | Existing Players create/edit/deactivate, imports, list/filter, parent link | No regression to underlying Players workflows |
| PP5-15 | Release gates | Exact HEAD CI/Jest/build, Vercel and cross-role negative RLS tests | Results recorded explicitly before release approval |

Use authorized test fixtures for any irreversible action. **Do not deactivate or modify real players to validate this phase.**

## Local and CI verification (execution pending)

```bash
git status --short
git branch --show-current
git pull origin payment-module-finalization
git rev-parse HEAD
cd frontend
CI=true npm test -- --watchAll=false --runInBand --testPathPattern='(Players|playerProfilePresentation)\.test\.js$'
npm run build
npm start
```

GitHub Actions workflow: <https://github.com/saurabh-shelke1993/acadpro-app/actions/workflows/player-profile-validation.yml>.

Capture actual test output, exact tested commit SHA, build result, deployment status and user acceptance before marking PP5 **tested** or **release-accepted**. PP5's code and automated-test preparation can be treated as **implemented** and ready for product-owner review.
