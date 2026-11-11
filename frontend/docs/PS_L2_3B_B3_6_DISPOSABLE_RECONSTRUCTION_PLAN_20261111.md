# Kheltriva — B3.6 Non-executable Disposable Reconstruction Plan

**11 November 2026** · `payment-module-finalization` · active Supabase `ulyealhkmlorsbdiknrh`

**Implementation:** Metadata-only 82-version source-order plan, 14 B3.5C quarantines, six unresolved divergent sources, chronology guards and 35 planned role/finance/Storage tests. **No SQL generated, database created, history repaired, schema modified, live data changed or migration approved.**

## Evidence reviewed

- Supabase live ledger SELECT: 82 original versions / 168 elements; latest `20261101082001`.
- Pinned original-source B3.1/B3.2: 25 strict Git links, six same-version divergences, 51 no content matches, and local duplicate/irregular timestamps.
- Owner B3.4 protected local archive and B3.5B 14-case scan passed. B3.5C classified 14/14 but formally approved 0. Original SQL remains Git-ignored and absent from this plan.
- ROLE_MATRIX remains the authority for Super Admin, Academy Owner, Coach and Parent.

## Proposed staged dependency order (all PENDING)

1. Original source fingerprint and order attestation.
2. A future unlinked Supabase scratch environment with synthetic-only records (**not created**).
3. Original `20260823093317` base schema review, including Auth/Storage prerequisites; lexical equivalence is insufficient.
4. Historical private helper provenance, owners, grants, `search_path`, and creation order before first helper use `20260903173804`. Historical `current_parent_id` at `20260908062059` precedes `parents.user_id` at `20260912142706`; do not inject modern B2.9 snapshot early or disable body checks.
5. Individually review mixed DDL/data in 14 quarantined versions; retain essential functions/RLS/triggers while excluding customer-specific backfills **only in a future reviewed scratch proposal**. The remaining 68 still require source approval.
6. Scratch-only decision for duplicate Git timestamp `20260926133000` and irregular 12-digit `202610210001`. Do not touch canonical migrations.
7. Run authenticated role/tenant and Storage negative tests later, after a reviewed executable reconstruction.
8. Run synthetic finance tests: full/partial payment, unique receipt/reference, overpayment denial, forced rollback and correction RPC privilege checks. Respect later `20260926094904` generated-column and `20260926111113` financial role corrections.
9. Seek manual security and Owner acceptance before attempting PS-L2.3 integration; 22 legacy subscriptions remain on billing HOLD.

## Test matrix: 35 planned, 0 executed

| Domain | Cases |
|---|---:|
| AUTH | 6 |
| RBAC | 7 |
| STORAGE | 5 |
| FINANCE | 8 |
| PARENT_INTEGRITY | 2 |
| PLAYER_MAPPING | 2 |
| ATTENDANCE | 2 |
| ENQUIRIES | 3 |
| **Total** | **35** |

Each scenario explicitly remains `status=NOT_RUN`, `passed=false`. These are **plans**, not PostgreSQL integration-test results.

## Artifacts / boundaries

- [B3.6 metadata plan](../../supabase/recovery/historical-baseline/b3_6_disposable_plan_20261111.json): original versions, source classes, 14 dispositions, helper timeline, 35 scenario definitions and all approvals false.
- `b3_6_review_contract.py` / `test_b3_6_review_contract.py`: fail-closed Python verification against the pinned B3.2/B3.5C evidence; no network, original SQL or database calls.
- GitHub Actions: runs validator and synthetic tests on code changes. Green CI does **not** authorize replay or establish historical SQL semantics, RBAC or financial parity.

**Gates remain BLOCKED:** manual source/DDL/data separation and role-security sign-off; isolated Supabase setup; full 82-history replay; actual 35 negative/integrity tests; legacy 11 financial reconciliation discrepancies; Owner acceptance; PS-L2.3 billing/renewal/expiry/dues automation. **Next B3.7A:** focused original helper/source chronology review (still read-only).
