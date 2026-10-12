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
| Unit tests | `npm test -- --watchAll=false` from `frontend` | **PASS — 14 suites, 101 tests passed**; user ran on code HEAD `fa87d7d79152a3807f7c86e070d4b3be9ec97b50` on 13 Oct 2026. Warnings remain (React Router future flags, multiple GoTrueClient instances in `App.test.js`, and unwrapped React state updates in a Parent UPI component test); none failed the suite. |
| Production build | `npm run build` from `frontend` | **PASS — Compiled successfully** on code HEAD `fa87d7d79152a3807f7c86e070d4b3be9ec97b50` on 13 Oct 2026. Existing non-failing warnings are documented above; no warnings were suppressed. |
| GitHub/Vercel | Check status for the tested code HEAD and distinguish Preview from Production | GitHub combined status reported Vercel **success** for code HEAD `fa87d7d79152a3807f7c86e070d4b3be9ec97b50`. The latest Preview was opened by the user; Production remains unverified and must not be treated as released. |
| Browser acceptance | Role, capture, status, conversion and regression scenarios below | **PARTIAL** — user verified Academy Owner can open `/enquiries` and `/parent-upi-submissions` in the latest Preview; sidebar shows Enquiries and Finance. Full lifecycle, other roles and existing-module regression remain pending. |
| Database authorization/transactions | Controlled fixtures or isolated Supabase development branch | **PARTIAL CONFIGURATION REVIEW** — live read-only checks confirmed inquiry table grants/RLS policy and enquiry RPC SECURITY DEFINER/search_path/anon EXECUTE settings. Live data counts were inspected; one existing enquiry is already Converted and its Player/Parent/player-batch links are present. No transaction, rollback, concurrency or authenticated role simulation was run. No Supabase development branches are currently listed. Do not seed fake leads/players in active project. |
| Release documentation | R1–R6 status and known limitations recorded | Updated 13 Oct 2026 with the observed automated, Preview, and read-only database results. R6 remains **validation in progress**. |

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


## Current checkpoint — 13 October 2026

**Code commit tested:** `fa87d7d79152a3807f7c86e070d4b3be9ec97b50` (branch `payment-module-finalization`). The subsequent documentation-only commits are not part of that code test SHA.

### Observed passes
- Jest: 14/14 suites and 101/101 tests passed.
- Production build: compiled successfully.
- Vercel status for the tested code HEAD: success.
- Latest Preview browser smoke check: Academy Owner opened Enquiries and Parent UPI Payment Claims; the expected sidebar links rendered.
- Read-only live schema/grant review: direct client writes to `public.inquiries` denied; anon inquiry access denied; the three enquiry RPCs use empty search paths and deny anon execution.
- Read-only conversion integrity check: the existing converted enquiry has a Player, Parent and player-batch mapping.

### Deferred by user
The following R6 checks are intentionally deferred until the user returns to release validation:
- Isolated conversion success/retry/concurrency/rollback and role/cross-tenant tests.
- Full browser acceptance for Super Admin, Academy Owner, Coach, Parent/anonymous.
- Existing Player, Attendance, subscriptions, dues/collections/receipts, Parent Portal and UPI end-to-end regression.
- Final Production verification/release decision.

### Safety and warning notes
- Live project inspection showed 1 enquiry, 49 players, 59 parents, 48 player-batch rows, 42 payments, 26 payment dues, 131 attendance rows and 0 trial-attendance rows. These are live business records; do not create disposable test data there.
- No Supabase development branches were listed at the time of inspection.
- Security Advisor snapshot: 13 authenticated SECURITY DEFINER warnings, two RLS-enabled/no-policy INFO findings (`payment_number_counters`, `trial_attendance`), and leaked-password protection disabled on the current plan. The three enquiry RPC warnings are expected from the chosen RPC design but still require role/tenant runtime tests.
- React Router future-flag, duplicate GoTrueClient and Parent UPI test act() warnings remain non-failing; do not suppress them as part of unrelated work.

**Release decision: NOT RELEASE-READY.** Automated checks and limited Preview navigation passed, but the deferred checks above are still required before release.
