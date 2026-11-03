# Coach Profile — CP1–CP3 implementation checkpoint

**Date:** 2026-11-03  
**Branch:** `payment-module-finalization`  
**Scope:** Coach Profile layout and certification form visibility  
**Status:** IMPLEMENTED; local build and browser acceptance PENDING

## Implemented

### CP1 — Compact header
- Reduced profile header/avatar dimensions and whitespace while retaining Back and role-authorized Edit Profile controls.
- Coach name is the page's H1 with Active/Inactive status beside it.
- Specialization and academy identity appear together.
- Centers and active-batch counts appear as brief training facts for non-Parent roles; Parent does not receive assignment counts or training information.
- Inactive status uses a visually distinct neutral treatment.

### CP2 — Independent-height details and right-hand workspace
- On desktop, Personal Details is the left column; a separate right column stacks Centers & Batches above Certifications.
- The grid uses top alignment, preventing a short Training Scope card from stretching to the height of a longer Personal Details card.
- Profile data, assignment links and existing batch details are preserved as shown by the prior component.
- For Parent role, Personal Details occupies one full-width column; Training Scope and Certifications remain absent, as before.
- Smaller screens use the existing single-column responsive rules.

### CP3 — Certification editor opens on demand
- Certification creation form is **collapsed by default** for Academy Owner and Super Admin.
- `+ Add Certification` opens a new, cleared form; the header button toggles to `Close`.
- The existing certificate `Edit` operation opens the form populated with the selected record.
- `Cancel` closes and clears the form; successful Create/Update refreshes the list and closes it.
- Required certificate-name validation and the existing service/database mutations are unchanged. Errors leave the form open.
- Coaches retain their existing read-only certification view and Parents still see no certification section.
- The form uses a responsive two-column layout inside the right-hand card, with a full-width certificate name; it stacks vertically on phones.

## Files changed
- `frontend/src/pages/CoachProfile.js` — structural and form-visibility changes
- `frontend/src/pages/CoachProfile.css` — layout and responsive styling

No changes to `coachProfileService.js`, routes, database migrations, RPCs, RLS, or coach assignment data.

## Manual acceptance matrix (not run yet)

| Test | Role / viewport | Expected |
| --- | --- | --- |
| CP1-01 | Owner / desktop | Compact identity header with name, status, specialization, academy, center count, batch count; Back/Edit actions still work |
| CP1-02 | Owner / inactive coach | Inactive badge is neutral and reads Inactive |
| CP1-03 | Coach self | Self Edit Profile behavior remains authorized |
| CP1-04 | Parent | No training counts, Training Scope or Certifications; no unauthorized edit |
| CP2-01 | Desktop | Left Personal Details and natural-height right Training Scope + Certifications; no large stretched empty rectangle |
| CP2-02 | Desktop / no assignments | Friendly empty assignment state and visible Certifications |
| CP2-03 | Phone / tablet | Sections stack, fields/buttons readable, no horizontal overflow |
| CP3-01 | Owner/Admin | Certification form hidden initially; Add opens empty fields |
| CP3-02 | Owner/Admin | Edit opens the correct prepopulated certification; Cancel/Close do not save |
| CP3-03 | Owner/Admin | Successful Save refreshes list and hides form; validation errors leave it open |
| CP3-04 | Coach self | Certifications view is read-only; no Add/Edit/Delete affordance |
| CP3-05 | Owner/Admin | Existing certificate Delete confirmation and list update still work |

**Caution:** Do not create/delete test certifications on production coach records solely for QA. Use isolated fixtures for mutation tests.

## Deferred / separate
- CP4: mobile/accessibility review after user visual acceptance.
- CP5: focused role-by-role regression and final documentation synchronization.
- Training Scope currently displays general batch time from `batch.start_time` / `end_time`; it does not establish coach-specific weekday/session scheduling. Improving that source is a separate data-contract task.
- Current-head Jest, `npm run build`, and browser checks have **not** been executed through the GitHub connector. Do not call CP1–CP3 tested or production-ready.

## Recommended validation commands
```bash
git status --short
git pull origin payment-module-finalization
cd frontend
CI=true npm test -- --watchAll=false
npm run build
npm start
```
