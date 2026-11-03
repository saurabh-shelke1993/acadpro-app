# Coach Profile — CP4 and CP5 implementation and regression checkpoint

**Date:** 2026-11-03  
**Branch:** `payment-module-finalization`  
**State:** UI and tests **implemented**; source/diff review **completed**; automated execution and browser/role acceptance **pending**.

## Scope

CP1–CP3 previously compacted the Coach Profile header, stopped stretching short Training Scope cards, stacked Certifications beneath Training Scope, and collapsed the certification form by default. This checkpoint covers CP4 responsive/accessibility work and CP5 focused regression evidence. Preserve those earlier decisions.

## CP4 — Responsive and accessibility changes

**Files:** `frontend/src/pages/CoachProfile.js`, `frontend/src/pages/CoachProfile.css`.

- Coach name remains the page H1. Training Scope and Certifications now have explicit heading IDs associated with their sections.
- Profile edit form has an accessible name. Initial editable Full name receives focus on form opening.
- Certification disclosure uses `aria-expanded` and a conditional `aria-controls` when the form is present; the Add/Edit form has an accessible name.
- The certificate name field receives initial keyboard focus when Add or Edit opens. Cancel, Close, and successful save return focus to the certification disclosure button and close the form.
- Primary, secondary and danger action buttons, batch links, inputs and textarea have consistent visible `:focus-visible` outlines.
- Content is permitted to wrap (long coach names, URLs, certificates, institution names, image filename); photo preview wraps without horizontal overflow.
- Personal detail cards retain two columns on 481–700px viewports but use one column on smaller screens (≤480px); existing stacked large-scale sections remain.
- Narrow-screen cards and header spacing are tightened, certification controls can wrap, status facts wrap, and action buttons retain adequate touch height.

**Not changed:** coach profile service calls, photo upload/delete, certificate create/update/delete, routes, RBAC, Supabase schema/RLS/RPC, assignment logic, selected coach/academy scope.

## CP5 — Regression test updates

**File:** `frontend/src/pages/CoachProfile.test.js`.

The existing Jest + Testing Library suite was **updated** to reflect the intended CP1–CP3 UI (previous assertions expected old inline certification fields and two identical AFC A text nodes). It now has **12 authored tests** (previously eight).

New/strengthened scenarios include:
- Academy Owner profile header displays the coach as an H1, shared academy/specialization summary and training counts.
- Certification editor is initially collapsed; Add toggles it with accessible expanded state and initial focus.
- Successful creation closes the editor and restores focus; editing opens a prefilled editor with focus.
- Cancelling an unsaved certification closes and clears without creating a record.
- A failed certification save leaves the editor and unsaved input open, with an error.
- Coach self-profile shows assignments and read-only certifications, with no Add/Delete actions.
- Super Admin can open the certification form.
- Existing tests for parent-scoped read, forbidden parent profile, coach self-edit RPC, owner profile update/photo upload, batch link and owner certificate CRUD remain.

**IMPORTANT:** These are authored regression tests only. No command output from `CI=true npm test -- --watchAll=false` or `npm run build` was observed for the current revision through this connector. Do not mark CP5 fully tested.

## Browser acceptance matrix (all pending user verification)

| ID | Role / viewport | Expected |
| --- | --- | --- |
| CP4-01 | Academy Owner desktop 1440px | Compact hero; independent-height Personal Details and Training Scope/Certifications column |
| CP4-02 | Academy Owner tablet 768px | Single major content column; no horizontal overflow; personal fields use two columns where space permits |
| CP4-03 | Academy Owner phone 320px/375px/430px | Cards stack; readable labels and action buttons; long strings wrap; no horizontal scrolling |
| CP4-04 | Owner keyboard only | Tab/Shift+Tab shows visible focus; Enter/Space activates action buttons and batch links |
| CP4-05 | Owner certification keyboard | Add/Edit moves focus into Certificate name; Close/Cancel/Save restores focus to disclosure |
| CP4-06 | Owner inactive coach | Inactive status looks neutral, reads Inactive; counts/links consistent |
| CP5-01 | Academy Owner | Profile edit, photo upload validation, cancel/save; no scope or role regression |
| CP5-02 | Academy Owner / Super Admin | Add/Edit/Cancel/Delete certification using a safe test record; correct validation, error display and list refresh |
| CP5-03 | Coach self | Self-service editing still works; certifications read-only; assignment links and details visible |
| CP5-04 | Parent | Only linked/scoped coach is viewable; email/join date/training/certifications withheld; no edit |
| CP5-05 | All authorized roles | Navigate Back to the correct role-specific destination; no unexpected session/academy leakage |
| CP5-06 | No assignments / no certificates | Empty states visible and compact; no unusable controls |

Only perform certification or photo mutations with authorized test fixtures; do not mutate genuine production coach records solely for regression tests.

## Explicitly deferred / out of scope

- Coach training display currently uses batch-level start/end time, not the specific assigned weekdays and coach sessions. Source contract investigation is separate.
- CMA5 assignment reactivation and coach deactivation consistency issues remain in `frontend/docs/COACHES_CMA5_REGRESSION_AND_ISSUES_20261103.md`. CP4–CP5 do not alter those workflows.
- Release-readiness sign-off and full cross-module QA remain deferred during active development.

## Exact-current-revision local validation

From the repository root, with local changes protected:

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

Report tested SHA, test count, failures/warnings and screenshots from owner/coach/parent views. Do not infer PASS from the presence of test code or an earlier branch build.
