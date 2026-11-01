# Enquiries E5 — Regression and security checkpoint

**Date:** 2026-11-01
**Branch:** `payment-module-finalization`
**Reviewed UI baseline:** latest Enquiries E1–E4 and status-dialog code (source file blob `d0ceea519180185e31360fe05c1d81f9a561fdbe`)
**Status:** VALIDATION IN PROGRESS — NOT RELEASE READY

## Evidence observed
- GitHub source read: `frontend/src/pages/Enquiries.js`; includes 10-row client-side pagination, filtered page reset, expandable mobile records, owner action dropdown, coach status action and modal status editor.
- Enquiries R6 release checklist (2026-10-13) reviewed. Its old 101-test PASS and build PASS apply to commit `fa87d7d79152a3807f7c86e070d4b3be9ec97b50`, NOT the current E1–E4 code.
- Query against active Supabase project `ulyealhkmlorsbdiknrh` (metadata only): `public.inquiries` has RLS enabled and an authenticated SELECT policy scoped to super admin, own-academy owner, and coach authorized center.
- Direct authenticated table access showed SELECT grant only; no anonymous table grants in inspected scope.
- Four inquiry RPCs are SECURITY DEFINER with empty search_path.
- Anonymous EXECUTE privilege: create false, update false, conversion false, **delete true**. The delete RPC internally requires a recognized role and academy so an anonymous call appears to be rejected by role checks; this has NOT been tested with a live anonymous session.
- **Security discrepancy:** `public.delete_inquiry(uuid)` explicitly allows both `academy_owner` and `coach` (with scoped center check), whereas the current Enquiries UI and intended role matrix grant Delete to Academy Owners only. A coach may bypass the UI to delete an authorized unconverted enquiry via the RPC. No destructive exploitation test was run.

## Required remediation before E5 PASS
1. Agree on Academy Owner-only delete contract, revise `delete_inquiry` with a new forward-only migration (do not rewrite applied history), remove unnecessary anon EXECUTE, and add negative role tests.
2. Run exact-current-commit React Jest tests and production build. No current-head PASS has been observed in this review.
3. Manually verify owner/coach/super admin/parent/anonymous views, status dialog, E2 action dropdown, E3 pagination/filter reset, mobile expand/collapse and E4 forms.
4. Validate cross-academy/center denial, lost and converted immutability, and anonymous rejection through authenticated test fixtures without modifying real enquiry records.
5. Run conversion success/rollback/retry/concurrency tests only in an isolated test environment.
6. Confirm regression for Players/Parent linkage, attendance, finance and UPI workflows.
7. Record tested code commit SHA, automation results, browser evidence and deployment target before declaring release ready.

## Changes in this checkpoint
Read-only review plus documentation only. No SQL writes, enquiries, players, function migrations or production data changed.
