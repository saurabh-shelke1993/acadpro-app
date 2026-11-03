# Player Performance — PM1 shared workspace checkpoint

**Date:** 2026-11-03  
**Branch:** `payment-module-finalization`  
**Phase:** PM1 — shared navigation only  
**Status:** IMPLEMENTED in GitHub; automated test execution and role/browser acceptance PENDING.

## What changed

- The Super Admin, Academy Owner and Coach sidebars now use **one** `Player Performance` link. The link remains highlighted for both performance routes.
- The existing `/player-performance-report` and `/coach-performance-assessments` routes are unchanged and continue to load their respective independent React page components.
- A small shared component, `frontend/src/components/PerformanceWorkspaceTabs.js`, renders two full-width, Parent Portal-inspired selection cards: **Performance Report** and **Performance Assessments**.
- Cards have contextual labels, selected border/background and one active **Selected** badge. They link to existing routes with `NavLink`, so browser history, direct links and the active-page marker remain available.
- Responsive styling in `PerformanceWorkspaceTabs.css` displays two equal columns on wider screens, stacked cards at ≤700px, and visible keyboard focus.
- Both existing performance pages render the shared cards for the three management roles. Assessment page retains its assessment heading (as H2 beneath the workspace H1) and all its original form/history/score logic.
- **Parent experience stays report-only.** Parent sidebar still links directly to `/player-performance-report` with the original `Performance Report` label; the shared cards component returns no markup for `parent` or unknown roles. `/coach-performance-assessments` remains blocked to Parents by `ProtectedRoute`.
- The existing role-scoped data access, assessment CRUD, filters, report charts, Top 5, player deep links and Supabase behavior have **not** been modified.

## Files changed

- `frontend/src/components/PerformanceWorkspaceTabs.js` (new)
- `frontend/src/components/PerformanceWorkspaceTabs.css` (new)
- `frontend/src/components/PerformanceWorkspaceTabs.test.js` (new)
- `frontend/src/pages/PlayerPerformanceReport.js`
- `frontend/src/pages/CoachPerformanceAssessments.js`
- `frontend/src/pages/CoachPerformanceAssessments.css` (heading style only)
- `frontend/src/components/Sidebar.js`

**No route definition, service, RPC, Supabase migration, table, RLS, or permission matrix change.**

## Authored tests (not run yet)

`PerformanceWorkspaceTabs.test.js` covers:
- All three authorized roles see the correct cards and selected Report route.
- Assessment direct route selects the Assessments card.
- Card clicks switch active styles and `aria-current` in both directions.
- Parent, unknown role and absent role render no management card navigation.

## Focused manual acceptance — pending

| ID | Role / screen | Expected |
| --- | --- | --- |
| PM1-01 | Academy Owner desktop | One Player Performance sidebar link; both cards visible horizontally |
| PM1-02 | Academy Owner desktop | Report card selected at `/player-performance-report`; existing report filters and Top 5 unchanged |
| PM1-03 | Academy Owner desktop | Click Assessments card; existing assessment form/history display; sidebar stays active |
| PM1-04 | Coach desktop | Both cards work, existing assigned-player data scope unchanged |
| PM1-05 | Super Admin desktop | Both cards work, existing academy selectors and scoping unchanged |
| PM1-06 | Parent desktop | Original Performance Report link remains; **no cards**; assessment direct URL denied |
| PM1-07 | Authorized roles | Direct links and browser Back/Forward restore correct selected card |
| PM1-08 | Phone/tablet | Cards stack at ≤700px, no overflow, keyboard focus visible |
| PM1-09 | Report deep link | Existing `/player-performance-report?player=...` player selection behavior unaffected |

Only read/navigation checks are needed for PM1. Avoid creating or mutating live assessment records for navigation testing.

## Validation boundary

GitHub source/diff inspection may establish that the change is committed, **not** that a build/test/browser run passed. Run and record tests for the exact new HEAD when convenient:

```bash
git status --short
git pull origin payment-module-finalization
git rev-parse HEAD
cd frontend
CI=true npm test -- --watchAll=false
npm run build
npm start
```

**Next suggested phase:** PM2 — optimize the Performance Report separately (empty space, player selection, charts, empty states), without mixing it into PM1. PM3–PM5 remain planned.
