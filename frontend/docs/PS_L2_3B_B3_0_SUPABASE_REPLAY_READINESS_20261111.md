# Kheltriva — PS-L2.3B B3.0 Full Supabase Replay Readiness

**Date:** 11 November 2026 (Asia/Kolkata)  
**Working branch:** `payment-module-finalization`  
**Hosted Supabase project:** `ulyealhkmlorsbdiknrh`  
**Permission boundary:** Source-only review / offline CI, hosted read-only evidence. **No full Supabase replay, no production DDL, ledger repair, or subscription billing writes.**

## Decision

**B3.0 REPLAY READINESS: BLOCKED — seven mandatory gates remain open.**

This is **not** a failed implementation of the 11 verified current auth helpers: B2.9 passed synthetic PostgreSQL 17 integration. It means the historical repository migration chain cannot yet recreate the complete hosted Supabase database with provable Auth/RLS/payment parity.

The B3.0 preflight inspects the actual checked-out repo and committed, sanitized historical metadata. It **does not run** `supabase db start`, `supabase db reset`, `supabase migration repair`, `psql`, the PS-L2.3 proposal, or any remote SQL. Green CI means the *readiness audit* passed, with `ready_for_disposable_full_replay=false`.

## Precise blockers

### 1. Overlapping test-only auth bootstrap definitions

Existing **legacy CI** fixture: `supabase/tests/subscriptions/ps_l2_3_local_private_baseline.sql`, **7 functions**. B2.9 fixture: `ps_l2_3_b2_9_live_helper_snapshot.sql`, **11 current verified definitions**.

Duplicated names (**4**):
- `current_academy_id`
- `current_user_role`
- `is_academy_owner`
- `is_super_admin`

Legacy-only helper names (**3**, not included in B2.9's 11):
- `current_parent_id`
- `can_manage_academy`
- `is_parent_of_player`

**No automatic merging.** Those three have actual historical remote migrations/redefinitions and must be positioned by approved source chronology. The new B2.9 fixture is a *current-state reconstruction*, not a direct historical replacement.

### 2. Historical schema timing and artificial body-validation suppression

The older local Supabase CI workflow `.github/workflows/subscriptions-ps-l2-3-supabase-local.yml` copies the partial fixture into a temporary migration with version `20260823100000`. That fixture creates `private.current_parent_id()` using `public.parents.user_id`, but the original recorded migration adding `parents.user_id` is **`20260912142706`**.

The legacy fixture uses `SET check_function_bodies = off;` to create the function too early. This does not establish authentic source order or function validity. B3 must not rely on suppressing SQL validation as a history-repair strategy.

The older CI workflow additionally proceeds to `supabase db start` and conditionally executes `ps_l2_3_foundation.sql` if replay happens to succeed. It has **not** been modified in B3.0. Do not use it to certify current readiness.

### 3. Incomplete original SQL / timestamp conflicts

The read-only live ledger contains **82 remote migration versions**, while the canonical repository contains **40 SQL files**. A strict source fingerprint comparison previously found:

- **25** historical remote rows linked to local file content (17 exact, 8 one-line-ending variants); **8** of those have different timestamps.
- **6** same-version SQL divergences, including the original `20260823093317` base schema.
- **51** remote versions with no strict source match, totaling **57** unlinked remote records.
- **15** local migration files not content-matched to any remote record.
- Duplicate local **14-digit** version `20260926133000` across two separate payment files.
- One **12-digit** local migration filename: `202610210001_private_player_photo_storage.sql`. This is not a standard 14-digit timestamp. The validator initially rejected it outright; the corrected version identifies it as a distinct tracked-filename risk. No file was renamed or deleted.

These findings do not authorize renaming historical migrations in the actual production branch or skipping original migrations.

### 4. Current helper definitions are not historical lineage

B2.9's 11 source-hash-verified `private` helpers compile and pass synthetic authorization checks, but their original creation provenance is unrecorded in the retained migration ledger. The current live `private` namespace has 42 functions; 114 RLS policies directly reference that schema. We cannot assume successful RLS parity merely because 11 synthetic helpers pass tests.

### 5. History-sensitive data cleanup and privileged SQL review

The original historical SQL contains record-specific player-batch cleanup and financial reconciliation actions. Two same-version September 20 cleanup files differ in UUID-shaped SQL literal values. Do not replay against any user or payment records. Full source review, explicit data-only quarantine/synthetic adaptation and owner acceptance are still pending.

### 6. Protected private migration archive

B2.7 archive tools passed CI, but the actual complete original SQL archive has not been generated and source-approved in a trusted environment. Read-only connected Supabase can inspect the ledger; it does not write to the owner's private machine. A future B3 disposable assembly must be built from **verifiable** source evidence, not fabricated historical stubs.

### 7. Full end-to-end Supabase parity

No clean full local Supabase/Auth replay has passed. The PS-L2.3 candidate remains unapplied outside isolated synthetic tests. Real RLS policy behavior, finance RPC/trigger semantics, 42-private-function source/permissions and subscription billing integration are unverified in the recovered baseline.

## B3.0 implementation and validation

Implemented:
- `supabase/recovery/historical-baseline/b3_0_replay_readiness.py`: offline, **non-executable** source/manifest inspection, seven explicit readiness gates; compares the old CI bootstrap against B2.9, historical timestamps, source fingerprints and workflow source. The output is metadata only.
- `supabase/recovery/historical-baseline/test_b3_0_replay_readiness.py`: focused tests of the verified repo blocker counts, overlap identification, legacy workflow detection, source tampering and mislabeled historical provenance.
- `.github/workflows/subscriptions-ps-l2-3-b3-0-readiness.yml`: independently runs Python validation, asserts the plan remains blocked and **never starts a database**.

The first B3.0 workflow run failed because it initially assumed **every** canonical migration filename used 14 digits; this surfaced the existing 12-digit file. The validator was corrected to report this mismatch instead of aborting the audit. The subsequent GitHub CI run **PASSED**, with the complete seven-gate decision `ready_for_disposable_full_replay=false`.

Readiness check from repository root (write to a new output path, not existing canonical migrations):

```powershell
python supabase/recovery/historical-baseline/b3_0_replay_readiness.py --root . --output "$env:TEMP\kheltriva_b3_0_readiness.json"
```

Do not treat a successful invocation as a permission to execute any migration or subscription billing.

## Concrete next checkpoint — B3.1 preparation (separate approval)

1. Securely retrieve the **original SQL statement arrays** for all 82 versions through a protected read-only export (existing Supabase connection can help inspect, but never commit raw personal-data SQL). Reconcile the six source differences and 51 unmatched rows.
2. Create a review-only **disposable migration assembly manifest**, one entry per authentic remote version; document content hashes, source, original order, current-state helper bootstrap insertion points and historical data-operation quarantine. No executable tree until these checks pass.
3. Decide explicitly how and where the verified 11 helpers can appear without overriding original function definitions or bypassing body validation; `parents.user_id` timing remains a hard gate.
4. Resolve duplicate/irregular local migration versions **in a separate temporary workspace**, not by retimestamping applied production migrations.
5. Only after source sign-off and review does B3 disposable Supabase replay become eligible, followed by real RLS, Auth, payment and negative tenant-isolation tests; **only then B4** PS-L2.3 proposal.

## Phase state

| Component | Status |
|---|---|
| B2.9 11-helper synthetic PostgreSQL validation | PASS |
| B3.0 existing CI fixture / migration audit | IMPLEMENTED |
| B3.0 fail-closed readiness CI | PASS — replay still BLOCKED |
| B3.1 authentic source/replay assembly plan | PENDING |
| B3 full disposable Supabase migration replay | NOT RUN |
| B4 actual PS-L2.3 Supabase integration | NOT RUN |
| Production Supabase / subscription billing changes | NONE |

**Safeguard:** This document is a current source-readiness decision, not evidence of an operational subscription renewal feature.
