# Kheltriva — B3.5C Technical Historical SQL Dispositions (read-only)

**Checkpoint:** 11 November 2026 | **Branch:** `payment-module-finalization` | **Active Supabase:** `ulyealhkmlorsbdiknrh`

**Decision:** **14/14 technical source classifications recorded; 0/14 approved for execution.** This is a review-only disposition register, **not human original-SQL security sign-off, syntactic rewrite authority, migration authorization or proof of historical replay parity**.

## Evidence boundaries

- Owner reported B3.4 **82/82 original migrations, 168/168 elements** integrity-verified in Git-ignored private archive, followed by B3.5B scan **14/14 cases**. The private archive itself remains local.
- Original statements for the 14 versions were inspected with **SELECT-only** Supabase queries, alongside the current catalog. Current RLS, grants, triggers, and RPCs are only a **current-state reference**, not full historical semantics.
- The metadata-only [decision register](../../supabase/recovery/historical-baseline/b3_5c_technical_dispositions_20261111.json) contains no SQL bodies, customer UUIDs, personal data or financial transaction values. It is **non-executable**.
- This step did not change live database objects, migration ledger, payment data, canonical migrations, frontend features or credentials.

## 14 quarantined migration dispositions

| Original version | Area | Data handling for candidate scratch replay | Essential schema/security |
|---|---|---|---|
| `20260912142706` | Parent Auth linkage | Exclude original email-based parent/user backfill | Review FK/unique constraints, helper chronology, grants |
| `20260912180959` | Parent attendance | No customer mutation detected in conditional DO | Review parent-linked attendance policy and dependencies |
| `20260920041516` | Player/batch mapping | Exclude historical UUID-specific DELETE/INSERT | No essential DDL in this record; preserve separately verified invariants |
| `20260920041606` | Player/batch correction | Exclude historical UUID-specific DELETE | No essential DDL in this record |
| `20260920053210` | Duplicate parent cleanup | Exclude historical parent deactivation statements | No essential DDL in this record |
| `20260926081053` | Financial foundation | Exclude historic payment-reference, collector and counter backfills | Review payment/receipt schema, RLS, grants, RPCs and triggers |
| `20260926081320` | Legacy receipts | Exclude original receipt-number mutation loop | No new DDL; test receipt generation on synthetic payments |
| `20260926113534` | Overpaid dues | Exclude UUID-specific due correction and pre/post checks | No new DDL; preserve finance invariants |
| `20260930071849` | Academy logos | Review Storage bucket UPSERT as configuration, not customer cleanup | Review public-read/admin-write policies |
| `20261008075914` | Coach photos | Review bucket UPSERT as configuration | Review coach-photo policies and ownership |
| `20261010011839` | Attendance uniqueness | Keep duplicate preflight on synthetic rows only | Review transitional uniqueness constraints |
| `20261012013143` | Academy UPI | Review QR bucket UPSERT as configuration | Review payment-settings RLS/constraints/functions and QR access |
| `20261012035934` | Enquiries | Exclude historical bulk data normalization updates | Review constraints, scoped RLS, SECURITY DEFINER RPCs and triggers |
| `20261021052601` | Player photos | Review private bucket UPSERT as configuration | Review private Storage read/write policies and player-RLS dependency |

**Important:** “Exclude” and “review” are proposed treatments only. They do **not** authorize automatic deletion or mutation of an executable migration tree. All source statements are retained in the owner’s original private archive. A mixed migration must not be skipped wholesale: doing so may omit critical DDL, functions, triggers, grants or policies.

## Financial security disposition (three cases)

- `20260926081053`: source has three direct data-changing top-level segments plus a payment reference-replacement DO loop. The original SQL also includes essential financial schema, counters, RPCs, policies, triggers and grants. The similarly named Git SQL is not byte-equivalent; three historic function-body differences were identified, and later applied `20260926094904` redefines those functions. **No equivalent security outcome is approved without replay and negative tests.**
- `20260926081320`: historic receipt-number UPDATE loop. Test receipt generation only with synthetic payments, including uniqueness/idempotence.
- `20260926113534`: guarded, record-specific overpayment correction. Do not reuse original UUID selectors. Use synthetic failures/rollback to test the intended current balance invariants.
- Current SELECT-only ledger audit recorded **26 dues / 42 payment entries, 11 due-to-payment mismatches, and 10 paid dues without linked payments**. These remain unresolved evidence discrepancies; do not synthesize or repair ledger rows here.

## Security attention points

1. **RBAC/tenant:** Verify Super Admin platform scope; Academy Owner own academy; Coach assigned batches and no financial collection; Parent linked children only. Validate denials with actual authenticated test sessions.
2. **Privileged code:** Current AUTH-executable SECURITY DEFINER RPCs require actual negative tests. Check function owners, explicit search paths, internal user/academy checks, grants and triggers. The historical `private.current_parent_id` chronology and its configured search path require explicit inspection.
3. **Storage:** Academy logos, coach photos and academy UPI QR are intentionally public-read; player photos are private. Storage path checks that depend on `public.players` RLS are not sufficient proof of cross-tenant isolation without direct negative tests.
4. **Synthetic data only:** Quarantine all old player UUID selectors, parent deactivations, payment/receipt corrections and enquiry backfills. Preserve integrity preflights (including attendance duplicate checks) on clean synthetic fixtures.
5. **Recovery provenance:** Resolve remaining historical helper source timing, local timestamp collisions and six source divergences before generating an executable disposable-only reconstruction.

## Gate/status

| Gate | Status |
|---|---|
| Owner local archive integrity and B3.5B scanner | **PASS (owner-provided console output)** |
| B3.5C technical original-source triage | **CLASSIFIED (14/14)** |
| B3.5C sanitized registry integrity test | **PASS — 13 focused synthetic tests at source `e7d7227` (run 42964368559)** |
| Manual essential DDL/data split + security sign-off | **PENDING** |
| Historical original-source/role/privilege semantic parity | **PENDING** |
| Full unlinked disposable Supabase Auth/RLS/Storage/Finance replay | **NOT RUN / BLOCKED** |
| Broader frontend Jest regression | **FAIL — 4 suites / 16 tests at `e7d7227`; unrelated B3.5 gate** |
| Owner acceptance of replay preparation | **PENDING** |
| PS-L2.3 billing activation, legacy agreements, production replay | **BLOCKED** |

**Next isolated implementation task (not done here):** B3.6 — design a non-executable, disposable-only SQL splitting proposal and explicit negative-test plan, starting with historical source-grant/helper chronology and mixed DDL/data cases. Do not generate or run executable original SQL or apply any historical migrations until security/Owner gates explicitly allow it.
