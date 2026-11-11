# AG3.4C1 — Source-attested Parent/Coach/SA RLS policy catalog contract

**Status:** implemented as a **read-only policy catalog fingerprint snapshot and offline CI structural test**; not real-JWT policy replay, not full AG3.4C authorization signoff.

## Evidence and boundaries

On 2026-11-11, the active Supabase `acadpro-db` (`ulyealhkmlorsbdiknrh`) was inspected through read-only `pg_policies` and `pg_proc` queries. The snapshot pins **28 actual deployed policy fingerprints** across `batches` (5), `centers` (4), `coach_batch_assignments` (4), `parents` (5), `players` (5), `player_batches` (5), and **7 exact private helper signature/source hashes**. The hashes are Postgres MD5 of `qual || chr(31) || with_check` with nulls coalesced, and `pg_get_functiondef()` for helpers.

**No role behavioral claims derive from a hash.** This snapshot is evidence of the policy/helper *identity and drift baseline* only. The offline unit tests assert counts, uniqueness, role targeting, digest format, required Parent/Coach policy presence and SECURITY DEFINER helper source hashes. No Supabase token, hosted SQL access or Docker is required. The GitHub workflow does not touch customer data.

## Next gates

- **AG3.4C2 (pending):** reconstruct exact current Parent `is_active`-aware helper and deployed Parent/Coach/SA SELECT policies with their nested FK/ACL dependencies in an unlinked native GoTrue/PostgREST environment. Use real JWTs to assert active/inactive Parent, same-academy different Parent, foreign-academy child, assigned/inactive Coach and SA cross-tenant access. Do not assume AG3.3 synthetic Parent helper is equivalent.
- **AG3.4D (pending):** role-scoped real-JWT tests for finance policies, 14 public SECURITY DEFINER RPCs and all Storage bucket policies, including overpayment and cross-tenant denial.
- **AG3.4E (pending):** complete regression, triage confirmed Coach mapping vulnerability, migration provenance, deploy/rollback plan and explicit release gate.

## Known open findings

1. **HIGH:** AG3.4B confirmed unsafe Coach/Parent mapping INSERT in scratch with exact current `coach_batches` predicates, and tested a scratch-only role-gated candidate. No hosted policy remediation deployed.
2. `centers_select` currently permits all authenticated users whose `academy_id` matches. Determine intended Parent Portal and Coach visibility before changing.
3. Live `private.current_parent_id()` requires an active parent; AG3.3 minimal synthetic fixture did not.
4. 82 applied migrations versus 40 local SQL files; 23 version-prefix matches do not prove source equivalence.
5. Finance, Storage and callable SECURITY DEFINER RPCs remain untested under deployed predicates.

**Guardrail:** AG3.4C1 PR may be merged after offline CI passes under standing development-branch approval, but must **not** be labeled full AG3.4C completion or production security clearance.
