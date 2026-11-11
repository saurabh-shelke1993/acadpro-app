# Kheltriva — B2.9 Authorized Disposable Reconstruction: GitHub Actions Stage

**11 November 2026 · payment-module-finalization · testing authorization recorded from Product Owner in this conversation**

## Scope of new authorization

The Product Owner authorized using the 11 pinned **current-state** private authorization helpers as an explicitly **nonhistorical** baseline for disposable-only testing. GitHub Actions first; prepare an unlinked local Supabase plan next. No approval for production, schema changes on the active project, real records, canonical migrations, automatic billing, paid infrastructure or B4 deployment.

## Implementation

- Reuse unchanged B2.9 fixture SQL, 11-helper SHA-256 manifest, and synthetic-role preconditions. No additional current helper source or original historical SQL copied.
- A separate SQL file constructs a **synthetic RLS table and policy** using the verified helper functions, then performs Super Admin, Academy Owner, assigned Coach, inactive Coach, Parent, missing-identity and anonymous-role read tests.
- The constructed fixture policy deliberately uses `is_coach_assigned_to_batch`, since `can_access_batch` alone checks coach-batch mapping without the active-assignment predicate. This **does not** claim the fixture reproduces production policy definitions.
- Synthetic table mutation grants are withheld. The assertions check RLS, tenant denial, private schema usage and role grants. PostgreSQL `SET ROLE` exercises SQL privileges.
- `auth.uid()` in this PostgreSQL 17 job is a **spoofable session-GUC test double**, not a Supabase Auth JWT. Tests cannot establish production JWT authenticity, real Auth sessions, Storage access, app policy parity or full historical replay.

## Validation status

**Implemented:** Dedicated GitHub Actions job, source policy assertions and focused offline guard tests. **CI results pending at initial commit**. The prior original B2.9 role/bootstrap tests are preserved and rerun by this workflow. Do not count synthetic policy tests as B3.6's 35 full Supabase runtime test scenarios.

## Production / B4 guard

All 14 quarantined historical migrations, six source divergences, missing original helper creation provenance, 22 legacy agreements and financial reconciliation discrepancies remain held. No executable historical SQL assembly or B4 lifecycle integration is authorized.
