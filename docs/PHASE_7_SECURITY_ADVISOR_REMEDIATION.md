# Phase 7 — Security Advisor remediation

**Last updated:** 11 October 2026  
**Branch:** `payment-module-finalization`  
**Supabase project:** `acadpro-db` (Free plan)

## 1. Completed: lock down unused public tables

Migration: `supabase/migrations/20261011140000_phase_7_lock_down_unused_public_tables.sql`

Applied to the connected Supabase project and committed to the repository.

- Enabled RLS on `public.trial_attendance` and `public.inquiries`.
- Revoked direct `anon` and `authenticated` table privileges on both tables.
- Revoked direct client privileges on `public.payment_number_counters`; it remains intended for server-side/database use.
- Verified RLS is enabled and direct client SELECT/INSERT is denied for all three tables. `service_role` retains SELECT access.
- `trial_attendance` and `inquiries` had zero rows at the time of remediation. No matching references were found in the repository search. Treat direct client access as intentionally blocked until an explicit access model is designed.
- The Advisor's earlier RLS-disabled ERROR findings for `trial_attendance` and `inquiries` disappeared after the change.

## 2. Current Security Advisor baseline

Last refreshed: 11 October 2026.

| Finding | Count / level | Status |
|---|---|---|
| RLS Enabled No Policy | 3 / INFO | Intentional deny-by-default configuration for `inquiries`, `trial_attendance`, and `payment_number_counters` |
| Signed-In Users Can Execute SECURITY DEFINER Function | 7 / WARN | Under review; authenticated execution retained for app workflows |
| Leaked Password Protection Disabled | 1 / WARN | Deferred because the project is on Supabase Free and the dashboard feature is plan-gated |

The previous RLS-disabled table errors are resolved. The remaining warnings should not be cleared by weakening application functionality or making unverified changes.

## 3. SECURITY DEFINER RPC review

All seven functions were inspected in the live database. Each has an empty `search_path`; anonymous and PUBLIC execution are denied, while authenticated execution is currently granted.

- `approve_payment_correction(uuid)`: checks authenticated user, role, pending status, academy scope for academy owners, and payment-total boundaries.
- `collect_payment(uuid, numeric, text, text)`: checks authenticated user, role, payment mode/amount, due state, academy scope for academy owners, and overpayment.
- `reject_payment_correction(uuid, text)`: checks authenticated user, role, reason, pending status, and academy scope for academy owners.
- `request_payment_correction(uuid, numeric, text)`: checks authenticated user, role, payment, amount/reason, duplicate pending requests, and academy scope for academy owners.
- `get_parent_child_coaches()` and `get_parent_coach_profiles()`: constrain results to the current parent and require the current role to be `parent`.
- `update_my_coach_profile(...)`: selects the active coach record associated with `user_id = auth.uid()`, then updates that record. Further explicit authentication/coach-role and input-validation review is still pending.

Frontend dependencies were confirmed in repository files:
- `frontend/src/pages/PaymentCollections.js` calls `collect_payment`.
- `frontend/src/services/coachProfileService.js` calls `update_my_coach_profile` and `get_parent_coach_profiles`.
- `frontend/src/services/parentPortalService.js` calls `get_parent_child_coaches`.

Because these functions are used by application workflows, do **not** revoke authenticated execution or switch to SECURITY INVOKER solely to clear the Advisor warning. Any permissions or function-behavior change must include dependency review and role/RLS regression tests.

### Next task if Phase 7 is resumed

1. Inspect the live definition of `private.current_user_role()` and how it resolves the authenticated user's role.
2. Review `update_my_coach_profile(...)` for explicit authentication and coach-role checks, input validation, and safe return fields.
3. Preserve the existing RPC signature and response contract unless frontend code is changed in the same work.
4. Apply a narrowly scoped migration only after review.
5. Test coach self-update, unauthorized role rejection, cross-coach isolation, and parent coach-profile display.
6. Re-run Security Advisor and record the observed results.

**Status:** This hardening task has not yet been implemented. It is deferred while the user plans to begin other development work.

## 4. Leaked-password protection — deferred

Supabase's built-in leaked-password protection is not available on the current Free plan. The user confirmed they do not have Pro or above and cannot see the dashboard option.

- No SQL workaround was attempted; this is an Auth configuration feature.
- Do not treat this as an unresolved navigation issue.
- Keep the warning documented as a plan limitation.
- Revisit only if the project plan changes and enabling the feature is justified.
- No plan upgrade is required to continue other Phase 7 work.

Official reference: https://supabase.com/docs/guides/auth/password-security

## 5. RLS-enabled/no-policy findings

The three INFO findings are currently intentional:

- `public.inquiries`: RLS enabled; direct client privileges revoked; no policies until an explicit access model is needed.
- `public.trial_attendance`: RLS enabled; direct client privileges revoked; no policies until an explicit access model is needed.
- `public.payment_number_counters`: RLS enabled; direct client privileges revoked; intended for server-side/database use.

If a future frontend/API workflow needs either unused table, define and test a least-privilege policy before enabling client access.

## 6. Related migrations and project docs

- Table lockdown migration: `supabase/migrations/20261011140000_phase_7_lock_down_unused_public_tables.sql`
- Earlier Phase 7 RPC grant/search-path hardening: `supabase/migrations/20261011105104_phase_7_harden_rpc_grants_and_schedule_search_paths.sql`
- Project status and handoff: `frontend/docs/PROJECT_STATUS.md`
- Architecture: `frontend/docs/PROJECT_ARCHITECTURE.md`
- Migration history reconciliation: `supabase/MIGRATION_RECONCILIATION.md`

Migration history warning: the live migration ledger and repository files differ. Do not replay missing migrations or edit `supabase_migrations.schema_migrations` to align counts. See `supabase/MIGRATION_RECONCILIATION.md` before any migration-history work.
