# AcadPro Enquiries V1 — R6 Regression and Release Readiness

**Date:** 13 October 2026  
**Branch:** `payment-module-finalization`  
**Scope:** Release gate for Enquiries R1–R5. No new product behavior is introduced by R6.

## Release decision

**NOT RELEASE-READY until every required validation below is observed and recorded.** R1/R2 source and schema work, R3 list/capture, R4 status/trial-date editing, and R5 atomic conversion are implemented. Implementation presence is not a substitute for passing automated tests, role/RLS checks, transaction tests, and browser acceptance.

## Validation categories — report separately

| Category | Required evidence | Current result |
|---|---|---|
| Repository/source review | Branch and diff review; no unintended migration/history edits | Reviewed in source; full local diff review pending |
| Unit tests | `cd frontend && npm test -- --watchAll=false` | Not executed in this environment |
| Production build | `cd frontend && npm run build` | Not executed in this environment |
| GitHub/Vercel | Check status for the current branch HEAD, not an earlier docs commit | A Vercel success was observed on commit `041a8c27e063abd32d853d2078c84bc69eaa922a`; confirm status for the current HEAD after pulling |
| Browser acceptance | Role, capture, status, conversion and regression scenarios below | Pending user-run browser checks |
| Database authorization/transactions | Controlled fixtures or isolated Supabase development branch | Not executed; do not seed fake leads/players in active project |
| Release documentation | R1–R6 status and known limitations recorded | This checklist added; update final result after validation |

## A. Existing application regression

Run the current test suite and production build before feature-specific tests. Resolve every failure; do not suppress ESLint warnings, disable CI, or change unrelated workflows merely to get a green build.

Manually regression-test the established workflows affected by player creation or navigation:

- Login/logout and role-protected routes.
- Super Admin, Academy Owner, Coach and Parent access to their existing pages.
- Player create/edit/deactivate, parent reuse, center/batch assignment and player-batch invariants.
- Attendance marking/history/editing and the 7-day coach editing restriction.
- Player subscriptions, payment dues, payment collection and receipt/ledger invariants.
- Parent Portal linked-child scope and coach information.
- Academy UPI settings, QR display and payment claim/review flows.
- Expenses and unrelated management pages must remain unchanged.

## B. Enquiries role matrix

Use existing data for read-only checks. Do not use the active project to create disposable test records.

| Scenario | Expected result |
|---|---|
| Super Admin list | Can read all academies; cannot create, update status, or convert |
| Academy Owner list | Reads own academy; can create/update/convert only within own academy |
| Coach list | Reads enquiries in authorized active centers; can create/update only within permitted center scope; cannot convert |
| Parent | No Enquiries route/data access |
| Anonymous | No Enquiries route/data access |
| Owner-created enquiry with no center | Visible to owner; not exposed to coaches until assigned |
| Cross-academy/center ID tampering | Rejected server-side even if client payload is modified |
| Duplicate warning | Advisory only; no auto-merge or automatic rejection |
| Lost status | Coach cannot reopen; owner can reopen |
| Converted status | Immutable via normal update workflow |

## C. Conversion transaction tests — isolated environment only

Use a Supabase development branch or controlled fixtures with known IDs. Capture before/after counts and IDs, and clean up only fixtures created in that isolated environment.

1. Successful conversion creates one Player, reuses/creates the correct Parent, creates the required player-batch relationship, and links the enquiry as Converted.
2. Repeat conversion after success returns the existing player ID and does not create a second Player or Parent.
3. Simultaneous conversion requests for the same enquiry do not create duplicate Players.
4. Force a transactional failure and confirm no partial Player/Parent/batch mapping and no Converted status/link are committed.
5. Lost enquiry is rejected until reopened by an Academy Owner.
6. Super Admin, Coach, Parent, anonymous and cross-academy owner calls are denied.
7. Cross-academy center, inactive center, wrong-center batch and inactive batch are rejected.
8. An assigned enquiry cannot be converted into a different center.
9. A successful conversion creates no payment, subscription, attendance, receipt or trial-attendance records.
10. Confirm the resulting Player appears in the Players page and existing Player CRUD still works.

## D. Browser acceptance — local application

After pulling the latest branch and passing automated checks:

1. As Super Admin, verify Enquiries is read-only.
2. As Academy Owner, quick-capture an enquiry only if it is a genuine lead; confirm it appears in the list.
3. Verify search and status/source/center filters, clear filters, empty/loading/error states and duplicate warning.
4. Update New → Contacted; refresh and confirm persistence.
5. Set Trial Scheduled without a date; verify the save is blocked. Add a date and verify persistence.
6. Verify Coach can update permitted enquiries but cannot reopen Lost or convert.
7. Verify Parent and anonymous access are denied, including direct `/enquiries` navigation.
8. As Academy Owner, inspect conversion fields and validation without submitting if the lead is not a genuine enrollment.
9. Convert only when enrollment is intended; verify exactly one Player, correct parent/batch linkage, enquiry Converted, and no unrelated financial/attendance records.
10. Repeat safe navigation/read-only checks at 390×844, 430×932, 768×1024, 820×1180, 1024×768, 1366×768 and 1536×864.

## E. Data safety

- Keep the existing user-created enquiry; it is intentional business data.
- Do not create fake leads or Players in the active Supabase project.
- Do not test rollback/concurrency by submitting real conversions in production.
- Do not alter applied migration history. R2 source remains `supabase/migrations/20261012035934_enquiries_r2_database_security.sql`.
- Do not create trial-attendance, payment, subscription or attendance rows as side effects of enquiry status/conversion.
- If a genuine enrollment is converted, treat it as a real business operation; do not delete the resulting Player to clean up a test.

## Exit criteria

R6 can be marked **PASS** only when all are true:

- Jest suite passes.
- Production build passes.
- Current branch CI/deployment status is understood and successful, or any external platform failure is explicitly separated from code validation.
- Role and cross-tenant authorization checks pass.
- Transaction success, rollback, retry/concurrency, parent reuse and player-batch invariants pass in an isolated environment.
- Browser acceptance passes for Super Admin, Academy Owner, Coach, Parent/anonymous and the Enquiries lifecycle.
- Existing player, attendance, payment and Parent Portal regressions pass.
- Docs record actual results and the exact tested commit SHA.

Until then, report R6 as **validation in progress**, not release-ready.
