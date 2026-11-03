# Kheltriva — Coaches & Assignments CMA5 regression checkpoint

**Recorded:** 2026-11-03  
**Branch:** `payment-module-finalization`  
**Scope:** CMA1–CMA4 UI consolidation and coach assignment regression tracking  
**Release state:** NOT VALIDATED — owner will test later

## 1. Implementation and validation evidence

- CMA1: Coaches sidebar entry; shared `Coach Directory` and `Batch Assignments` route tabs; the original `/coaches` and `/coach-batch-mapping` routes and Super Admin / Academy Owner route guards are retained.
- CMA2: collapsed Coach Directory form, existing create/edit/view/status flows and pagination retained.
- CMA3: collapsed Batch Assignments form, existing coach→center→batch/session selection, create/edit/activate/deactivate/delete handlers retained.
- CMA4: compact inline session chips with checkboxes, tighter form spacing, action row aligned at the right, form-local Close control, keyboard focus styling, improved empty-state calls to action, and explicit mobile Actions/Hide actions toggles for Super Admin and Academy Owner. Coach status toggle uses pause/play rather than misleading trash icon; it still activates/deactivates and does not delete a coach.
- CMA5: a focused Jest test was authored at `frontend/src/components/CoachWorkspaceTabs.test.js` for active tabs, route links, and the shared accessible heading. **The test was not executed here.**
- GitHub source and commit diff review only. **Current-HEAD `npm run build`, Jest and browser/role testing have not been run or signed off.** No database migrations, RPC updates, production data writes, or assignment business-rule fixes were made.

## 2. Focused regression matrix (all pending runtime acceptance)

| ID | Role / viewport | Test | Expected |
| --- | --- | --- | --- |
| CMA5-01 | Academy Owner / desktop | Navigate Coaches → Batch Assignments → Coaches | One sidebar Coaches entry, correct tab selected, direct routes keep working |
| CMA5-02 | Super Admin / desktop | Repeat navigation and switch academy | Correct role scope; no cross-academy leakage |
| CMA5-03 | Coach & Parent | Attempt `/coaches` and `/coach-batch-mapping` directly | Existing route guards reject unauthorized management access |
| CMA5-04 | Academy Owner / desktop | Open Add Coach, cancel, edit an existing profile | Directory remains compact; form opens on demand and retains edit values |
| CMA5-05 | Academy Owner / desktop | Coach activate/deactivate control | Pause/play action matches actual behavior; confirmation and status work |
| CMA5-06 | Academy Owner / desktop | Open Assign Coach, select center/batch | Relevant sessions appear; selection and validation unchanged |
| CMA5-07 | Academy Owner / desktop | Toggle session checkboxes with mouse/keyboard | Visible focus and selected chips agree with controlled input state |
| CMA5-08 | Academy Owner / desktop | Cancel or Close assignment form | No mutation, compact directory restored |
| CMA5-09 | Academy Owner / desktop | Edit existing mapping and its sessions | Existing coach/batch/session selections load; save retains the intended assignments |
| CMA5-10 | Academy Owner / desktop | Duplicate assignment attempt | Existing duplicate policy remains enforced |
| CMA5-11 | Super Admin & Academy Owner / phone widths 320–640px | Select the mapping row's Actions / Hide actions control | Authorized mobile row actions expand/collapse and remain operable; no horizontal clipping |
| CMA5-12 | Desktop & phone | No coaches, no mappings, and filtered-empty cases | Contextual empty state, Add Coach / Assign Coach / Clear Filters or Directory action as appropriate |
| CMA5-13 | Keyboard-only | Tab through actions, chips, close, navigation and row | Focus visible; Enter/Space on row does not override button action |
| CMA5-14 | Roles + scoped fixtures | Cross-academy mutation and RLS negative paths | Denied by database, regardless of UI |
| CMA5-15 | Isolated test database | Assign/deactivate/reactivate/delete and failure midway | Batch/session state consistent; investigate existing non-atomic sequence if failures |

For mutations, use a controlled test academy / isolated fixtures; do not create or delete production coaches, assignments or sessions solely for these tests.

## 3. Two tracked business-logic issues — NOT fixed in CMA4/CMA5

### ISSUE-COACH-01 — Reactivation conflicts with permitted multi-coach batches

**Source:** `frontend/src/pages/CoachBatchMapping.js`, `toggleMappingStatus` reactivation path.

**Source evidence:** The handler rejects an inactive mapping if there is *another* active coach for the same batch (predicate `item.coach_id !== mapping.coach_id`). This conflicts with the intended multiple-coaches-per-batch model. A database unique index restricts duplicate active **coach+batch pairs**, not the number of different coaches per batch.

**Expected:** An inactive assignment may reactivate alongside a different coach's active assignment when the same coach+batch pair is not already active, subject to the session-level rules.

**Next scoped work:** inspect the current RLS/index/RPC contract, clarify desired behavior around session overlap, remove only invalid conflict rule, add controlled positive/negative tests, and verify role isolation. **Status: confirmed source mismatch, runtime regression pending.**

### ISSUE-COACH-02 — Coach deactivation and assignment/session consistency

**Source:** `frontend/src/pages/Coaches.js`, `handleToggleCoachStatus`; mapping functionality in `CoachBatchMapping.js` and `coachScheduleAssignmentService.js`.

**Source evidence:** Coach deactivation writes `coaches.is_active` alone; batch assignments and session assignment rows are managed separately. Existing RLS or downstream filters may prevent access by inactive coaches, but that behavior is not verified by this UI review.

**Questions:** Should mappings be deactivated automatically, remain for history but cease access, or be preserved for easy reactivation? How does reactivation restore session visibility without unintentionally scheduling sessions?

**Next scoped work:** product owner chooses lifecycle policy; inspect current database RLS and attendance/coach dashboard dependencies; test inactive coach visibility and access; implement a transactional scoped fix if required. **Status: design/security verification pending; no behavior changed.**

### Follow-up risk to inspect during business-rule work

The mapping page currently performs batch mapping changes and multiple session assignment updates as separate calls. Failures halfway may leave partial changes; evaluate transactional alternatives only after reviewing the existing RPCs and database dependencies. Do not combine this with UI spacing work.

## 4. Local validation commands

From repository root, first confirm there is no uncommitted work at risk:

```bash
git status --short
git branch --show-current
git pull origin payment-module-finalization
cd frontend
CI=true npm test -- --watchAll=false
npm run build
npm start
```

Record exact commit SHA, test counts and build errors/warnings, then complete the role and viewport scenarios above.

## 5. Next step

CMA1–CMA4 are **implemented**; CMA5 static review, test authoring and documentation are **completed**; automated and manual regression acceptance remain **pending** as requested by the product owner. Do not mark the Coaches & Assignments module fully tested or pilot-ready until passing evidence is recorded. Keep ISSUE-COACH-01 and ISSUE-COACH-02 as separately scoped future tasks.
