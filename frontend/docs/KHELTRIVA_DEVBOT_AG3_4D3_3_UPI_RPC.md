# AG3.4D3.3 — Parent UPI claim RPC source-aligned signed-JWT regression

**Date:** 12 November 2026
**Branch:** `security-ag34-d33-upi-claims-jwt` (PR against `payment-module-finalization`).
**State:** TEST SOURCE + CI IMPLEMENTED / EXECUTION, REVIEW AND OWNER ACCEPTANCE PENDING / PRODUCTION NO-GO.

## Existing P1.4/P1.5 contract (unchanged)
1. `submit_parent_upi_payment(uuid,numeric,text,date,text)`: Parent may submit for own linked child and outstanding due, with unique academy UTR and one active claim per due. No payment/receipt at submission.
2. `review_parent_upi_payment(uuid,text,text)`: only owning Academy Owner may accept/reject a pending claim. Acceptance does not post to payment ledger. Super Admin is read-only for UPI review.
3. `record_accepted_parent_upi_submission(uuid)`: only owning Academy Owner may explicitly record an accepted claim. Wrapper invokes existing `collect_payment` and atomically links external UTR, creates receipt, updates due and marks claim recorded. Pending/rejected/recorded/stale claims must not post.

Existing frontend dependencies: `frontend/src/services/parentPaymentSubmissionService.js`, `frontend/src/components/ParentUpiPaymentSubmission.js`, `frontend/src/pages/ParentUpiPaymentReview.js` and the current secured `collect_payment` RPC. No frontend change required in this security test phase.

## Read-only original-source baseline

| RPC | Hosted `pg_get_functiondef` MD5 | Source-level concern |
|---|---|---|
| `submit_parent_upi_payment` | `d3788514af85e404504861936cfef20e` | `current_user_role() <> 'parent'` is NULL-unsafe; parent-profile lookup independently constrains |
| `review_parent_upi_payment` | `33852ded2505672448ed44ccf46a43e2` | `v_role <> 'academy_owner'` and `academy_id <> current_academy_id()` NULL-unsafe; reviewer FK may independently deny |
| `record_accepted_parent_upi_submission` | `ff98c595f28944f33b7a8f50b4177722` | `v_role <> 'academy_owner'` NULL-unsafe; later `academy_id IS DISTINCT FROM current_academy_id()` is NULL-safe |

Live inspection confirmed `public.users.role` is `NOT NULL` and `parents.user_id` and `parent_payment_submissions.reviewed_by_user_id` reference `public.users.id`. Never assume that a NULL-role comparison alone establishes successful unauthorized writes.

All three live functions are `SECURITY DEFINER` with empty `search_path`, `authenticated` EXECUTE and `anon` EXECUTE denied. Their exact original SQL is pinned from **read-only live `pg_get_functiondef`** into `supabase/tests/security/ag34d33_live_upi_rpcs_scratch.sql`, with MD5 checks. The fixture extends the earlier C2/D1/D3.1/D3.2 synthetic database only for required columns, constraints and audit FKs; it does **not** claim full deployed-schema replay.

## Controlled implementation

- `supabase/tests/security/ag34d33_live_upi_rpcs_scratch.sql`: exact live UPI RPC bodies, source hashes, scoped GRANTs, invented parent/due/claim context, UTR uniqueness, active-due uniqueness, audit/receipt-linked constraints, late-failure trigger.
- `supabase/tests/security/ag34d33_null_role_scratch_candidate.sql`: separate scratch-only minimal fail-closed role guards using `IS DISTINCT FROM`. Exact original sources must be verified and observed **before** installing.
- `scripts/devbot/ag3_4d33_upi_rpc_jwt_ci.py`: genuine GoTrue-issued JWTs with Parent A/B, Owner A/B, Coach, Super Admin and unmapped account; original-source guard observation and candidate role/tenant tests; input and UTR checks; review/no-posting invariant; explicit ledger recording, receipt and UTR; stale amount; duplicate prevention; forced post-number failure; concurrent exactly-once recording.
- `scripts/devbot/test_ag3_4d33_upi_rpc_jwt_ci.py`: offline source, confinement and fail-closed negative-response guards.
- `.github/workflows/devbot-ag3-4d33-upi-rpcs.yml`: independent native isolated Supabase workflow on PR, runs C2 > D1 > D3.1 > D3.2 > D3.3 and tears the stack down with `--no-backup`.

## Evidence classification — do not predeclare an exploit

Original signed-JWT UPI runtime outcomes are **PENDING CI**. The runner specifically distinguishes:
- An unmapped valid JWT falls past the original submission role comparator but should fail at **Parent profile not found**, leaving no claim.
- An unmapped JWT falls past the original review role/academy comparators but should fail on the independent `reviewed_by_user_id` foreign key, leaving the claim unchanged. If it instead writes, classify and investigate the actual evidence; never label a pure role-guard bypass as confirmed financial exploitation.
- An unmapped JWT falls past the original recording role comparator but should fail its later NULL-safe academy predicate, leaving all claim/receipt/ledger state unchanged.
- The scratch-only candidates should reject these three JWTs at their **explicit role guard**, while legitimate Parent/Owner workflows continue to pass.

Positive recording must not be possible through Claim Submit or Accept. Explicit recording must create **exactly one** linked payment, receipt, UTR and consistent due, with no state changes on error.

## Absolute safety and release gates

- Runner requires a newly initialized unlinked native Supabase workspace, expected Auth/user/schema counts, absent `supabase/migrations` and link metadata, CI identity, no Supabase hosted tokens, and exact prior C2/D1/D3.1/D3.2 baseline.
- Do not call hosted RPCs with synthetic data; do not touch hosted SQL, customer financial rows, migration ledger, `main` or Vercel deployment. No canonical SQL migration in this phase.
- Initial tests may uncover fixture-model or source-parity differences; fail closed and investigate, never weaken an assertion solely to make CI green.
- `AG34-HIGH-001` (legacy Coach mapping) and `AG34-HIGH-002` (privileged finance RPC NULL-role guards) remain **OPEN ON HOSTED**. `AG3.4E` stays **NO_GO** even if this PR passes.
- Full fourteen-RPC and sixteen-Storage-policy regression, H5.2 restore rehearsal, historical migration recovery, frontend Jest red suites and manual four-role browser QA remain separate tasks.
- A green PR run means **isolated automated evidence only**. Owner reviews the changed files and evidence before authorizing merge to development. Hosted remediation still requires separate approved migration, backup and rollback process.

## Manual acceptance — not yet performed
- [ ] Parent A/B can submit and view only own claims; wrong parent/same-academy and other-academy child IDs denied.
- [ ] Owner sees/reviews only own academy; SA read-only; Coach/Parent/unmapped direct RPC calls denied.
- [ ] Accept/reject creates no payment or receipt and does not alter due.
- [ ] Explicit Record produces one payment/UTR/receipt, correct due balance and Parent payment history; repeat/stale/over-balance/failed calls never post.
- [ ] Desktop/mobile displays remain intact; existing cash, UPI and bank-transfer collections and corrections unaffected.
- [ ] CI, exact HEAD, git diff, docs and release NO_GO gate reviewed.

**Current checkpoint:** tests committed on a **feature branch**, native CI pending. No hosted deployment or end-user acceptance.
