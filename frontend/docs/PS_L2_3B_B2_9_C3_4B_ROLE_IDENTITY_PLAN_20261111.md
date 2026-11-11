# Kheltriva B2.9-C3.4B — Synthetic identity and tenant helper test design

**11 November 2026 · PLAN / NOT EXECUTED · Disposable local Supabase only**

## Evidence reviewed

- **C3.3B local PASS:** 11 persistent current-state private functions; private schema usage for authenticated, not anon; two synthetic batches; local native auth.uid unchanged.
- **C3.4A local PASS:** owner ran real local GoTrue signup and validated Auth-issued session through GET /auth/v1/user. Reported one auth.users row, zero public.users rows, 11 private functions and two batches. No production access, historical replay or client grants.
- **ROLE_MATRIX.md (frontend/docs/ROLE_MATRIX.md):** Super Admin platform-wide; Academy Owner own academy; Coach assigned batches; Parent linked players only. Database RLS, not the frontend, is the security boundary.
- **11-helper snapshot:** current_user_role/current_academy_id/is_super_admin read public.users; coaches and assigned batches use public.coaches, coach_batches and coach_batch_assignments. These are *current-state, nonhistorical* helper implementations.
- **C3.3A synthetic tables:** public.users references native auth.users(id); the synthetic batch records exist in two invented academies. All five synthetic tables are RLS-enabled, and ordinary client privileges were revoked, with no app table policies yet.

## Important test limitation

The C3.4A script generated a random password inside its PowerShell process, and discarded that password on exit. The resulting test Auth user is a valid **unmapped Auth smoke-test identity**, but no reusable sign-in credential exists. Do not alter it or attempt to use the expired in-memory session for subsequent helper tests.

Use **new, invented Auth accounts** through the real local GoTrue API for role-specific tests. Keep passwords/access tokens in memory only while the tests run; never put them in Git, SQL files, terminal output or documentation.

## Small controlled phases

1. **B1 — Provision synthetic application identities (PENDING):** In the isolated scratch environment, provision new GoTrue test accounts for Academy Owner A, Academy Owner B, and Coach A and Coach B. Capture the actual GoTrue-issued UUIDs; bind them via carefully reviewed, single-transaction, *disposable-only* SQL to public.users (academy_id and role), public.coaches and the existing two synthetic batches. Validate FK relationships, no cross-academy accidental mapping, and RLS remains enabled. No client grants/policies in this phase. Consider additional Super Admin and Parent identities in later expanded coverage; do not infer a parent link without a verified table relationship.
2. **B2 — Verify real signed-in helper behavior (PENDING):** Verify GoTrue user/session per role, then construct a **separately reviewed** REST/transaction test path that forwards the actual Auth-issued JWT to local PostgREST. Do not simulate JWT claims with SET request.jwt.claim.sub and claim this is real Auth. No helper redefinition or full migration replay.
3. **C — Test scoped table RLS (PENDING):** Only after policy design review, install specific *synthetic scratch-only* GRANT/RLS policy definitions for batches and assignments and run successful in-scope and denied out-of-scope JWT requests. Parent, SA, finance, and Storage scenarios require additional verified entities/policies and separate approval.

## Guardrails

- No changes to real hosted Supabase, real academy data, payment records, canonical migrations, or UI routing.
- No reuse of the CI-only mock auth.uid() preconditions.
- No local reset, deletion, or archived 82-version historical replay.
- No blanket SELECT/UPDATE grants without scoped policies, no public SECURITY DEFINER probe functions.
- Stop on a failed auth request or partial provisioning: some synthetic accounts may already have been created. Check local state before any retry.
- CI static checks are not equivalent to local real Auth / RLS validation.
- **B4 automatic billing remains NO-GO.**
