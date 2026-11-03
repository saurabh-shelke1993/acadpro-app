# Player Performance — PM3.1A–D Player Finder checkpoint

**Date:** 2026-11-03  
**Branch:** `payment-module-finalization`  
**Status:** PM3.1A–E **implemented and development-task closed**. Product owner accepted the updated visual design on 2026-11-03. Automated Jest/build, Vercel deployment and focused multi-role browser/security acceptance **remain pending** and are not represented as passed.

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
- `frontend/src/pages/CoachPerformanceAssessments.test.js` (existing PM3 suite extended from 5 to **12 authored tests** after PM3.1E)

**No database schema/migration, RLS, Supabase RPC, scoring formula, profile scope, or assessment mutation payload changes.**

## Source-only checks / tests authored

New utility tests cover:
1. Academy, Center, Batch and search filters
2. Assessed/not-assessed accuracy and loading fail-closed behavior
3. Unique scope-derived Center/Batch options and 25-result page size
4. 50-player batching and complete 500-row pagination
5. Coach-owned versus other-coach assessment visibility
6. Query failure propagation, avoiding false Not assessed classification

Component tests cover Center→Batch narrowing, assessed/unassessed picker results, 25→31 Load more, Owner academy isolation and dependent-filter resets, Coach's own-assessment visibility, Super Admin academy switching, and failure recovery. Existing PM3 mocks were updated for scoped academy/batch filters and batched `range` queries.

**The tests have not been executed.** No current-head Jest/build or cross-role browser PASS is claimed. Product owner reported the current changes look good; this is recorded as visual approval, **not** comprehensive role/RBAC regression. The GitHub status inspected before final documentation showed Vercel pending. Live database was not modified.

## PM3.1E — focused regression and task closure (2026-11-03)

**Implemented:** Extended the existing component regression suite with four additional cases:
1. Academy Owner dependent Center→Batch filter resets and player-selection cleanup, without exposing another academy's players.
2. Coach's `Assessed by me` result scope (a different coach's record must not count).
3. Super Admin academy switching resets Center, Batch, status and previously selected player.
4. Assessment-coverage query failure still permits choosing `All players`; `Assessed` / `Not assessed` options remain disabled until coverage is verified.

**Recovery fix:** The status dropdown previously became fully disabled after coverage failure, which could trap users on a status filter. It now disables the entire dropdown only while loading, and disables the coverage-dependent options when coverage is unavailable. Users can still recover with `All players` and `Retry`.

**Evidence:** Previous source/diff checks confirmed nine score inputs, retained create/edit/delete handlers, existing coach batch scope, role guard, batched coverage queries and balanced JSX. Additional implementation/test source was reviewed. No Jest, production build, complete role/browser or database mutation test was run in this chat.

**Product decision:** PM3.1A–E is **closed as a development feature** based on implementation plus the owner's visual approval; automated, deployment, role-specific and security checks are tracked as **release-QA pending**, not marked complete.

## Acceptance checklist — visual approval recorded; focused role/runtime verification pending

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

Record the exact tested SHA and Jest/build results when run. Keep development-task closure separate from full cross-role/browser release sign-off.
