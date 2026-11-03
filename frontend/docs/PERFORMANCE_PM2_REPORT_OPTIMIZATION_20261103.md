# Player Performance — PM2 report UX and selection checkpoint

**Date:** 2026-11-03  
**Branch:** `payment-module-finalization`  
**Phase:** PM2 — Performance Report optimization  
**Status:** IMPLEMENTED on branch; focused helper tests authored; current-HEAD build/Jest and manual browser acceptance PENDING.

## Intent

The previous Report screen displayed a narrow Filter Performance + Top 5 row with a large blank area underneath until a player was explicitly selected—even when the selected scope had an assessed player. PM2 addresses the report entry experience and no-data states while preserving the existing analytical calculations and database security.

## Implementation

**Default report selection**
- Once the existing scope-filtered Top 5 results arrive, select the **highest-ranked assessed player** when no player is already selected. Detailed report, charts, remarks and history then render automatically.
- Never overwrite an existing player selection or an authorized `?player=<uuid>` deep link. Users can still manually choose a different player or clear the selection.
- The selected Top 5 button has `aria-pressed` and an explicit accessible description, in addition to its existing blue selected styling.

**Authorized deep link / academy scope fix**
- Initial selection is now derived from **players returned by the existing role-scoped query**. Invalid or unauthorized IDs are not selected.
- A Super Admin deep link chooses the matched player's academy instead of remaining on the intentionally empty All Academies scope.
- A Parent with linked players from more than one academy chooses the deep-linked child's academy instead of always using the first child's academy. Academy Owners remain locked to their own academy.
- The report still performs its existing RLS-protected queries; no widening of player or assessment access.

**No-data, chart and loading UX**
- If there is no selected player, a compact panel provides contextual guidance: choose academy, adjust empty scope, select a player, or await an assessed player.
- The Top 5 explanatory line tells users that choosing a row opens the full report.
- If the latest assessment has no skill scores, the skill-chart card gives a clear reason rather than plain empty text.
- A single scored assessment shows its score/date with a note that a second assessment is needed for a progress trend; no fake line or inferred historical data.
- Zero-result scope and cleared-player loading states now explicitly clear the relevant spinners so they cannot remain stuck after a filter change.

## Source files

- `frontend/src/pages/PlayerPerformanceReport.js`
- `frontend/src/pages/PlayerPerformanceReport.css`
- `frontend/src/utils/performanceReportSelection.js` (small pure selection helpers)
- `frontend/src/utils/performanceReportSelection.test.js` (seven authored unit tests)

**Not changed:** `CoachPerformanceAssessments.js`, assessment creation/update/delete, score averaging/thresholds, database tables, RLS, RPCs, routes, role access, payment or parent portal data. The PM1 shared navigation and Parent report-only access are preserved.

## Regression checklist (not executed)

| ID | Role / scenario | Expected |
| --- | --- | --- |
| PM2-01 | Owner: scope has one scored player | Top 5 displays player; player report automatically opens below without clicking |
| PM2-02 | Owner: scope has several scored players | Highest ranked player selected by default; choosing another player updates the report |
| PM2-03 | Owner: manually clear Player filter | Report becomes a guided unselected state without overriding the clear choice until next scope fetch |
| PM2-04 | Owner: change Center/Batch | Previous player clears; scoped Top 5 updates and first assessed player auto-selects; no stale chart |
| PM2-05 | Owner: no assessed players | Top 5 empty state + concise guidance; no fabricated score or blank page |
| PM2-06 | Owner: latest assessment has no scored skills | Explicit missing-scores message; calculated values remain unchanged |
| PM2-07 | Owner: one scored assessment | Single-assessment summary shown, not a misleading line trend |
| PM2-08 | Owner: multiple assessments | Existing skill chart, trend chart, remarks and expandable history remain unchanged |
| PM2-09 | Owner: valid `?player=...` link | Requested authorized player remains selected even if not highest-ranked |
| PM2-10 | Super Admin: valid player deep link | Matched academy scope opens; no cross-academy data exposed |
| PM2-11 | Parent: linked children across academies | Deep link to either authorized child initializes matching academy; no Assessments management access |
| PM2-12 | Coach: assigned players only | Auto selection chooses from authorized assigned scope; unrelated players never appear |
| PM2-13 | All roles: invalid/out-of-scope player ID | Invalid player is not selected; RLS/role scope remains enforced |
| PM2-14 | Filters cleared while queries in flight | Loading indicators resolve; no results from obsolete scope used |
| PM2-15 | Responsive + keyboard | Accessible Top 5 selection, focus indicators, charts and messages do not overflow |

## Authored tests / execution boundary

`performanceReportSelection.test.js` tests selection preference, manual/deep-link precedence, no ranked results, valid/invalid academy selection for Super Admin/Owner/Coach/Parent. These are unit tests **authored only**, not executed by this GitHub file connector.

The old business code still computes averages from available non-null scores, ranks by latest assessed score and shows the same role-visible detail charts. No scoring, historical or financial data model changes were made.

Run from a safe repository checkout:
```bash
git status --short
git pull origin payment-module-finalization
git rev-parse HEAD
cd frontend
CI=true npm test -- --watchAll=false
npm run build
npm start
```
Record tested SHA, test results and owner/coach/parent screenshots before marking PM2 as browser-accepted or released.

## Next

PM3 — optimize Performance Assessments input/edit/history UX as a separately scoped implementation, preserving the transactional/security behavior and score contract. PM4/PM5 still pending. Full cross-module QA remains deferred by product-owner decision.
