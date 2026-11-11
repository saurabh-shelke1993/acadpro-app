# AG34-HIGH-001 — H2 controlled rollout preparation (NOT production deployment)

**Prepared:** 11 November 2026. **Target:** active Supabase `acadpro-db` (`ulyealhkmlorsbdiknrh`).  
**Scope:** the unused `public.coach_batches` direct client-access vulnerability only.  
**Branch:** `security-ag34-h2-rollout-prep` into `payment-module-finalization` (not `main`).  
**Status:** CLI-generated canonical forward migration candidate, live read-only pre/post check scripts, emergency grants-only downshift, and native scratch regression prepared. **Hosted SQL NOT executed. Production finding HIGH-001 remains OPEN.**

## 1. Verified live preflight source

Read-only `pg_policies`, table privilege and helper catalog checks on 11 Nov 2026 confirmed:

| Property | Observed |
| --- | --- |
| `coach_batches` live row count | **0** |
| `coach_batches` RLS | **enabled** |
| Legacy policies | **4**, unchanged exact-source hashes from AG3.4B |
| Authenticated legacy grants | **SELECT, INSERT, UPDATE, DELETE** present |
| Anon legacy access | **SELECT** granted |
| Extra lockdown policy | **absent** |
| `coach_batch_assignments` | **11** live records at preflight; do not hardcode this mutable count in migration |
| Legacy private helper definitions | `can_access_batch`, `can_access_center`, `can_access_coach_batch`, all source-hash matched |
| Last applied remote migration | `20261101082001_enquiries_e5_1_owner_only_delete` |
| Historical provenance | **82 live versions** vs **40 prior local SQL files**; prior matching prefixes do not prove source equivalence |

`supabase/security_remediation_proposals/ag34_h2_read_only_hosted_preflight.sql` was **executed read-only** and returned `READY_FOR_SEPARATE_PRODUCTION_APPROVAL`. `ag34_h2_read_only_hosted_postflight.sql` returned `STOP_INVESTIGATE_NO_REGRANTS`, as **expected before deployment**.

These are time-sensitive snapshots; rerun just before any approved rollout. A later row insert, source change or grant change must halt the migration.

## 2. Canonical filename provenance and intent

Supabase **CLI v3.0.0** [generated a fresh migration filename in isolated GitHub CI 43062730880](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43062730880) using `supabase migration new ag34_h1_legacy_coach_batches_client_lockdown` inside a new unlinked temp project:

`supabase/migrations/20261111165330_ag34_h1_legacy_coach_batches_client_lockdown.sql`

The candidate contains the **byte-identical SQL transaction body** from the H1 source-reviewed proposal, with a deployment-warning header. It refuses unexpected old policy hashes, nonempty legacy table and altered grants. On success it revokes direct PUBLIC/anon/authenticated legacy table rights, adds restrictive always-false RLS, checks five-policy/grant-denial postconditions and requests PostgREST schema refresh.

**Staging a canonical file is not permission to run it.** The historical ledger still has major gaps, so do **not** run `supabase db push --remote`, `migration up --remote`, `migration repair` or `db reset` to make history match. Supabase CLI v3 changed default database targeting to **local**; automation must not use remote flags or credentials until separately authorized and reviewed. Any future remotely applied migration version must be reconciled with the exact deployed execution mechanism, not fabricated.

There is **no auto-deploy workflow for this change**. CI runs only with an isolated local Supabase CLI project without remote link, secrets or customer data.

## 3. Native scratch forward and emergency evidence

`.github/workflows/security-ag34-h2-rollout-rehearsal.yml` runs the existing H1/AG3.4B real GoTrue JWT test suite, plus H2's source parity tests and `AG3.4E` NO-GO release gate. In the scratch fixture it:

1. Reproduces the unsafe original legacy policy under real local signed JWTs.
2. Applies the source-identical lockdown to invented zero-row legacy data; verifies Owner/Coach/Parent/Super Admin and anon all denied direct access, including deliberate accidental scratch-only regrants.
3. Confirms modern `coach_batch_assignments`, linked Coach/Owner batch reads, and old private helper count are unchanged.
4. Runs the **read-only postflight** and requires `PASS_POLICY_LOCKDOWN`.
5. Rehearses `ag34_h2_emergency_grants_only_downshift.sql` against **scratch only**.
6. Confirms the downshift **does not restore vulnerable client privileges**, still denies all role JWTs, preserves active assignments and rejects a repeated forward migration on altered state.

**Rollback safety:** The emergency script removes only the *new restrictive policy* while keeping all direct client rights revoked. It does **not** grant legacy API access, roll back the 82 migration ledger, modify modern mapping records, or restore the original insecure exposure. Its use on hosted DB would also require an explicit incident-response decision and fresh verification.

## 4. Controlled hosted rollout — NOT AUTHORIZED YET

**STOP if any gate is unmet.**

1. **Evidence capture:** Reconfirm production project identifier, latest deployed SQL, 0 legacy rows, four original policy digests, the exact three helper hashes, intact modern assignment RLS/rows, effective grants, and security advisor baseline. Capture backup/restore strategy, change window and current platform status. Read-only preflight must say `READY_FOR_SEPARATE_PRODUCTION_APPROVAL`.
2. **Deployment mechanism review:** Given 82 live/40 pre-H2 local migrations and unresolved historical drift, a normal CLI `db push --remote` is **unsafe**. Choose an explicitly reviewed single-change execution/ledger recording method with known version provenance **before** any hosted schema change. Do not auto-repair the ledger or guess missing SQL.
3. **Product Owner approves the exact hosted SQL rollout separately.** Development PR merge approval does not count as hosted DDL approval. Identify operator, time, and emergency fallback in the change record.
4. **Single atomic change:** Apply **only** the reviewed guarded forward transaction, not missing historical migrations. Abort on any preflight mismatch, permission issue, or unexpected rows. Never bypass failure by deleting data or widening a role.
5. **Independent postflight:** Execute only `ag34_h2_read_only_hosted_postflight.sql`; require `PASS_POLICY_LOCKDOWN`. Cross-check the modern table row count from the approved preflight snapshot and three helper hashes, then recheck Security Advisor.
6. **Manual business tests:** Academy Owner can create/edit/deactivate modern coach-batch assignments and weekday schedule; Coach sees only assigned active batches; Parent sees assigned Coach information via Parent Portal; Super Admin can manage modern mappings. Ensure attendance, player enrollment and finance did not regress. The legacy table must be denied through an ordinary client JWT for all roles.
7. **Decision:** If all passed, mark only HIGH-001 hosted mitigation as **deployed + verified** with evidence. Do **not** mark the overall AG3.4E release GO: RPC/Storage, frontend Jest, migration provenance, B3/B4 and manual full-QA gates remain independent.

### If a regression appears

Stop. Preserve observed error and schema state; check whether it involves the legacy helper references or actual modern assignment code. Do not restore broad legacy grants.

Only under separately approved incident response and a fresh five-policy/zero-row/no-grants preflight, the guarded emergency script may remove the new restrictive policy **without regranting anything**. If direct legacy API access genuinely becomes needed, design a separately reviewed least-privilege role/academy policy and run scratch + manual tests, rather than reverting to the exploitable policy.

## 5. Status contract

| Work item | State |
| --- | --- |
| Prior H1 real JWT negative tests | **PASSED** (PR #18) |
| CLI migration filename generation | **PASSED** in isolated CI |
| Canonical migration candidate | **STAGED, UNAPPLIED** |
| Read-only hosted preflight | **READY_FOR_SEPARATE_PRODUCTION_APPROVAL** |
| Hosted postflight | **STOP** (expected before deployment) |
| H2 native forward/downshift rehearsal | **CI verification required** |
| Historical version provenance repair | **PENDING; no ledger edits** |
| Actual hosted DDL and business/manual QA | **PENDING EXPLICIT PRODUCTION APPROVAL** |
| HIGH-001 in production | **OPEN** |
| Overall AG3.4E gate | **NO-GO** |

Official references: [Supabase CLI v3 migration changes](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3), [Supabase CLI migration new](https://supabase.com/docs/reference/cli/supabase-migration-new), [PostgreSQL RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
