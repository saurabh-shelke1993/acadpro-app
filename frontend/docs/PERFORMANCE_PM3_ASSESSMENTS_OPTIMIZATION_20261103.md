# Player Performance — PM3 Assessments workspace optimization

**Date:** 2026-11-03  
**Branch:** `payment-module-finalization`  
**State:** UI implementation and source review complete; tests authored; full Jest/build and manual browser acceptance **pending**.

## Goal

Make the Performance Assessments workspace more compact and easier to use for Academy Owner, Coach and Super Admin. Preserve the existing role-scoped data access, validation, score calculation, assessment mutation behavior, and PM1 selection-card navigation.

## Implemented changes

### 1. Assessment editor opens only on demand

- Previously the full nine-score entry form appeared immediately after selecting a player, pushing assessment history far down the page.
- The new compact **Assessment entry** panel begins collapsed. `+ Record assessment` opens a cleared entry form.
- The full form is retained for editing existing assessments. Expanding a history row and clicking **Edit** opens the same form populated with the stored coach, date, scores and remarks.
- **Close** and **Cancel** both discard unsaved form changes and restore the compact panel without database mutations.
- Successful Create/Update continues to use the original Supabase calls, shows the existing saved summary, refreshes assessment history and collapses the form.
- Errors/validation issues keep the editor open for correction. Switching academy/player continues to clear its previous editor state.
- The assessment date receives keyboard focus when opening a new/edit form. The duplicate secondary page title and badge were removed because PM1 already provides the Player Performance workspace title and selected card.

### 2. Scoring fields grouped for faster scanning

Nine existing controlled score inputs (names, IDs, constraints and values unchanged) are presented under three headers:
- **Technical (5):** Ball control, Passing, Dribbling, Shooting, Defending.
- **Physical (2):** Speed, Stamina.
- **Team & discipline (2):** Teamwork, Discipline.

The score group layout uses five compact tiles for Technical at wide widths, two side-by-side lower categories, then responsive wrapping/stacking as space narrows. Labels remain attached to the same inputs; category titles replace repetitive per-card category labels. `0–10` decimal input limits and previous client validation are untouched. A score field left blank still maps to `null` as before.

### 3. History remains visible and actionable

- History continues to show compact expandable rows, newest first, with existing overall averages and coach remarks.
- Expanded rows now associate the summary control with the visible details using `aria-controls`; Edit/Delete buttons have date-specific accessible names.
- The no-history case now displays a concise explanation and **Record first assessment** button.
- The player-scope history loading state is explicitly cleared when no player is selected.
- No pagination or history truncation has been introduced.

### 4. Responsive and keyboard polish

- Form header and actions are aligned in a compact panel; save/cancel remain visible and readable.
- Scoring and history controls use explicit focus-visible styling and more flexible mobile layout at ≤1050, ≤700, and ≤480 px.
- Existing player picker and its authorized player scope remain unchanged.

## Files touched

- `frontend/src/pages/CoachPerformanceAssessments.js`
- `frontend/src/pages/CoachPerformanceAssessments.css`
- `frontend/src/pages/CoachPerformanceAssessments.test.js` (**new**, five authored tests)

**No database migrations, RLS policies, RPCs, new API calls, role-permission changes, changes to score averages, or changes to record payload schema.** The app's existing assessment write rules remain the authority.

## Authored regression tests (not executed)

The newly added `CoachPerformanceAssessments.test.js` mocks the role-authorized Supabase query results and exercises:
1. Compact closed editor after selecting a player, while history is visible.
2. Nine score fields under three group headers, focus of the date field, Cancel discarding an unsaved entry.
3. Existing history Edit reopening a correctly prefilled editor, Close clearing the editing state.
4. Owner create path reusing the original player/academy/coach-scoped payload (including missing scores as `null`) and collapsing after save.
5. Parent role denied assessment management, with no new record mutation.

These assertions are **authored coverage, not a passing test report**.

## Browser / role acceptance checklist — pending

| ID | Role and context | Expected |
| --- | --- | --- |
| PM3-01 | Academy Owner, selected player | Assessment entry collapsed; history visible without scrolling through nine score fields |
| PM3-02 | Academy Owner, Record | Editor opens, date focused, assigned coach selector/date/nine controlled fields and remarks visible |
| PM3-03 | Academy Owner, Cancel/Close | Unsaved changes discarded, form collapsed, no insert/update |
| PM3-04 | Academy Owner, save | Correct selected academy/player/coach, score null-handling and success message; history refreshes; editor closes |
| PM3-05 | Academy Owner, partial entry | No fabricated data; existing optional-score behavior and `0–10` validation preserved |
| PM3-06 | Academy Owner, history Edit | Original values restored; Update uses original row ID; Cancel doesn't save |
| PM3-07 | Academy Owner, history Delete | Same confirmation and successful delete behavior; no unintended records removed |
| PM3-08 | Academy Owner, no history | Guided empty state and Record first assessment button |
| PM3-09 | Coach, assigned player | Only authorized players and own assessment history; self coach identity and scoped saves preserved |
| PM3-10 | Super Admin, academy switch | Coach selection follows selected academy and no cross-academy leakage |
| PM3-11 | Parent, direct route | Rejected by existing route guards and component's role guard |
| PM3-12 | Phone 320–480px / tablet | Score groups readable and keyboard-operable without horizontal scroll |
| PM3-13 | Keyboard-only | Visible focus on picker, date, score inputs, editor Close/Cancel, history disclosures and edit/delete |
| PM3-14 | Player/academy changed while form open | Editor resets/closes; old values cannot be submitted under new player |
| PM3-15 | Mutation failure | Error displayed without falsely signaling success; editor remains open |

Do not perform these mutation tests on real production coach/player assessment records. Use a controlled test academy or isolated fixtures. Full release readiness remains deferred while Kheltriva development continues.

## Local validation

From a clean or safely stashed working tree:

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

Record the actual commit SHA, test count, build output and Academy Owner/Coach/Parent browser results before marking PM3 tested.

## Next phases

- **PM4:** Cross-page responsive/accessibility refinement (Report and Assessments).
- **PM5:** Focused regression, RBAC tests, documentation and release gating, with full manual acceptance still pending.
