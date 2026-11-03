# Player Performance — PM3.1A–D Player Finder checkpoint

**Date:** 2026-11-03  
**Branch:** `payment-module-finalization`  
**Status:** Source implemented and GitHub committed; current-head Jest/build and manual Owner/Coach/Super Admin acceptance **pending**.

## Goal and scope

Improve the Performance Assessments player picker for academies with approximately 200–300 players, without changing assessment entry, deletion, score calculations or tenant permissions. The original picker displayed very small player names, lacked explicit center/batch/status filters, and silently truncated results to 40.

### PM3.1A — Readability

- Each player result shows a 34px initial avatar, **14px semibold player name**, **12px center/batch** and a small assessment-availability badge.
- Results use comfortable click/touch targets, keyboard focus styling and wrapping on narrow screens.
- The search field remains at the top of the dropdown, outside the scrollable result area.

### PM3.1B — Center and Batch

- The existing authorized player query now selects `center_id` and `centers(center_name)`, alongside the existing `batch_id` and `batches!inner(...)` relationship.
- Academy (existing, role-sensitive) → Center → dependent Batch → Assessment status are visible filters.
- Only centers/batches represented by **currently authorized, active** players appear. Changing Center clears Batch and selected player; changing academy clears center, batch, status and selected player. Search matches player name, batch or center.
- Coach retains the existing `getCoachAssignedBatchIds` scope. Super Admin/Academy Owner continue using the existing academy data scope and RLS. Parent cannot access the Assessments route.

### PM3.1C — Assessment availability

- Filter options: **All players / Assessed / Not assessed** for Owner/Admin, or **All players / Assessed by me / Not assessed by me** for Coaches.
- Availability means **at least one accessible assessment record exists**; it is not a numeric-score-completion or pass/fail status.
- One role-scoped query flow retrieves `id, player_id` from `player_performance_assessments` using batches of 50 authorized player IDs, plus 500-row `range` pagination per batch. This avoids N-per-player requests and avoids silently missing later rows when many historical assessments exist.
- Coach query adds `eq("coach_id", coach.id)`; Owner/Admin rely on the existing role-scoped player IDs plus database RLS. No view, broad-security RPC or privilege changes.
- When loading, filters requiring assessment status are disabled and badges aren't falsely labeled. If the query fails, a Retry action appears and players can still be searched under All players; nobody is classified as Not assessed without confirmed status data.
- Availability is reloaded following successful create/delete so status counts reflect the new assessment.
- Summary shows players in center/batch and assessed/not-assessed counts in that scope.

### PM3.1D — Incremental result display

- Results are alphabetical as returned by the existing ordered players query.
- Show **25 initially**, with counts and `Load more` for the next 25. Search changes reset the visible count.
- Results remain scrollable with a capped menu height, and mobile uses responsive one-column filters and wrapping badges.
- Player selection continues to call the original `handlePlayerChange`, retaining its form reset and assessment history behavior; Escape closes the picker and focuses the trigger.

## Files

- `frontend/src/pages/CoachPerformanceAssessments.js`
- `frontend/src/pages/CoachPerformanceAssessments.css`
- `frontend/src/utils/assessmentPlayerFinder.js` (new pure utilities + batched status retrieval)
- `frontend/src/utils/assessmentPlayerFinder.test.js` (new, 6 authored tests)
- `frontend/src/pages/CoachPerformanceAssessments.test.js` (existing PM3 suite extended from 5 to 8 tests)

**No database schema/migration, RLS, Supabase RPC, scoring formula, profile scope, or assessment mutation payload changes.**

## Source-only checks / tests authored

New utility tests cover:
1. Academy, Center, Batch and search filters
2. Assessed/not-assessed accuracy and loading fail-closed behavior
3. Unique scope-derived Center/Batch options and 25-result page size
4. 50-player batching and complete 500-row pagination
5. Coach-owned versus other-coach assessment visibility
6. Query failure propagation, avoiding false Not assessed classification

Component tests cover Center→Batch narrowing, assessed/unassessed picker results and 25→31 Load more. Existing PM3 tests were adapted to mock the additional `range` query.

**The tests have not been executed.** No current-head Jest/build/browser PASS is claimed; live database was inspected only for relevant column definitions, not modified.

## Acceptance checklist — pending user review

| ID | Scenario | Expected |
| --- | --- | --- |
| PM3.1-01 | Owner, many players | Player names readable, result count visible; 25 entries initially, Load more works |
| PM3.1-02 | Owner, two centers | Center options limited to accessible centers; Batch narrows to selected center |
| PM3.1-03 | Owner, filtered batch | Only matching players shown; name/batch/center search works |
| PM3.1-04 | Owner, assessed status | Assessed returns only players with visible assessment records |
| PM3.1-05 | Owner, not assessed status | Never includes a player with a visible assessment record |
| PM3.1-06 | Coach | Only assigned players; Assessed by me distinguishes other coaches' work |
| PM3.1-07 | Super Admin | Academy switch clears dependent filters/selected player; no cross-tenant leakage |
| PM3.1-08 | Unavailable status query | Retry displayed; not-assessed status cannot be falsely inferred |
| PM3.1-09 | Complete first assessment | Availability refreshes; player moves from Not assessed to Assessed |
| PM3.1-10 | Delete last assessment | Availability refreshes; player returns to Not assessed |
| PM3.1-11 | Phone widths 320–480px | Filters stack, menu fits the screen, long names wrap, selection remains accessible |
| PM3.1-12 | Search & keyboard | Query reduces list; Load more and Escape behavior are correct; focus visible |
| PM3.1-13 | Parent direct URL | Existing authorization denies management access |
| PM3.1-14 | Existing PM3 create/edit/cancel/delete | Unchanged controlled score fields, payload, validation and history |

Do not create or delete production assessment records solely for testing; use authorized controlled fixtures.

## Known limitations and later work

- This phase is designed for the requested 200–300 player scale. The existing initial player-query pagination/SDK API row cap should be reviewed separately before supporting very large cross-academy datasets (>1,000 players at once).
- Assessment status is based on accessible records rather than a dedicated assessment-completion definition. A future business phase could distinguish score-complete/incomplete records if desired.
- PM4 cross-page responsive/a11y and PM5 full role/browser regression remain planned.
- Enquiries, Coaches and Coach Profile deferred release QA remain separately open.

### Local validation when ready

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

Report tested SHA and exact results, then update this checkpoint to `browser-accepted` only after manual verification.
