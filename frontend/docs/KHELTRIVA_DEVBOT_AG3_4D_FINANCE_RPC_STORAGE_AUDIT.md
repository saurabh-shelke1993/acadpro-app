# AG3.4D — Finance real-JWT reads; public RPC and Storage source inventory

**Implementation:** AG3.4D1 source-matched finance read-policy native CI, and AG3.4D2 read-only public `SECURITY DEFINER`/Storage fingerprint inventory.  
**Important:** This phase **does not** certify the 14 public callable RPCs, write/overpayment paths, Storage object API access, or end-to-end financial accuracy. Security release remains **NO-GO**.

## D1 — source-replayed finance RLS / JWT

Using read-only catalog inspection on active `acadpro-db` (`ulyealhkmlorsbdiknrh`), captured nine current `pg_policies.qual`/`with_check` sources for:
- `public.payment_dues`: Academy Owner SELECT, Parent SELECT, Super Admin ALL;
- `public.payments`: Academy Owner, Parent and Super Admin SELECT;
- `public.parent_payment_submissions`: Academy Owner, Parent and Super Admin SELECT.

The scratch fixture checks Postgres-normalized policy-expression digests for **all nine**. It also compiles and MD5-attests **six additional actual deployed private helpers**, including `is_parent_of_player`, `is_parent_payment_due`, `is_parent_payment_player`, `is_payment_due_in_current_academy`, `is_payment_player_in_current_academy` and their dependent `is_player_in_current_academy`.

CI reconstructs the already validated C2 nine-identity Parent/Coach/SA roles and six source-accurate core SELECT policies in **a new unlinked Supabase instance**. It then creates eight additional actual GoTrue sessions with Academy A1/A2 Parents, Academy B Parent, Owner A/B, Coach A/B and Super Admin, linked only to three invented due/payment/submission rows under the verified `players → parents` relationship. It checks:
1. Parent A1/A2 isolation **within the same academy**, and Parent B cross-academy isolation on all three finance tables.
2. Owner A/B own-academy read; Coach A/B no finance rows; Super Admin reads all three academies' synthetic records.
3. Inactive Parent A2 denied on all three finance tables, remaining Parents unchanged, SA retains read, reactivation restores read.
4. Anonymous/invalid JWT and forged tenant/user headers blocked; Parent/Coach finance INSERT blocked by *test-only missing GRANT*.
5. Six helper source digests, nine predicate digests and all object row counts match fresh SQL postflight.

**Limits:** The real hosted finance mutation schema includes more columns, triggers, RPCs, payment counters and financial invariants. Scratch tables contain only minimal source-required columns and **do not permit any client INSERT**. Thus Parent/Coach denied INSERT here is **not** evidence of equivalence for hosted payment mutations; this is explicitly a **SELECT-only parity test** plus an exercise of the actual read-policy predicates.

## D2 — 14 public callable SECURITY DEFINER RPCs, 16 Storage policies

`supabase/tests/security/ag34d2_live_rpc_storage_fingerprints.json` pins a read-only catalog baseline:

- Fourteen authenticated-callable `public` SECURITY DEFINER signatures with source MD5, `search_path=""`, effective authenticated/anon execute privileges, and indicators of directly referencing `auth.uid` or `private.` helpers.
- Sixteen Storage policy names, SQL roles and normalized predicate MD5, and four bucket visibility flags (public `academy-logos`, `academy-upi-qr`, `coach-photos`; private `player-photos`).

The static test protects completeness/counts against accidental source omission. **It does not execute the RPCs or access Storage objects**; source hashes alone cannot certify tenant isolation, payment correctness, negative authorization or orphan/storage path handling.

RPC source reconnaissance specifically confirms `public.collect_payment` checks caller role (Owner or SA), academy ownership for Owners, due status and overpayment; `public.record_accepted_parent_upi_submission` restricts recording to the matching Owner and delegates atomically to `collect_payment`. Both still require role-by-role negative JWT transaction and rollback testing before any billing release. Do not revoke public RPC EXECUTE grants without examining UI/service callers and role checks.

## AG3.4E blockers and release criteria

- **HIGH:** AG3.4B detected legacy `coach_batches` same-academy unauthorized mapping write in source-attested *disposable* JWT testing. No hosted policy remediation applied; fix requires a separately reviewed migration and rollout.
- Full 14-RPC negative mutation and transaction/invariant tests **NOT EXECUTED**.
- Storage real JWT object-read/write tests **NOT EXECUTED**.
- Full migration-source parity **NOT ESTABLISHED** (82 applied versions vs 40 tracked local migration scripts).
- Local C3.4B2 Windows persistence check and app/browser role regression remain independent pending gates.
- **No changes** to hosted Supabase data, `main`/Vercel, canonical migrations, billing B4 or privileged tokens.

**Interpretation:** D1+ D2 are useful source-scoped implementations, but **AG3.4D full regression remains PARTIALLY TESTED**. The honest E release-gate result must be **NO-GO** until the above blockers are validated/remediated.
