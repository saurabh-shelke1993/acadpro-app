# AG3.4D3.3 — Source-attested Parent UPI RPC security regression

**State: development implementation; native signed-JWT CI and Product Owner review NOT YET ACCEPTED.**
**Scope:** exact hosted `submit_parent_upi_payment`, `review_parent_upi_payment`, `record_accepted_parent_upi_submission`, as read-only captured 12 November 2026. No hosted DDL/DML or customer financial records; no `main` or Vercel release. AG34-HIGH-001 and HIGH-002 remain **OPEN**; AG3.4E remains **NO-GO**.

## Existing workflow and permissions

1. Parent submits a payment *claim* for a linked child and due, without posting a ledger transaction.
2. Only the Academy Owner may accept or reject a pending claim within their academy. Review alone cannot change dues, payments or receipts. Super Admin sees claims read-only.
3. Only the Academy Owner may record an **accepted** claim; the existing `collect_payment` handles one ledger payment/receipt, and the UPI wrapper attaches the submitted UTR and marks the claim `recorded` in the same transaction. Never treat accepted as recorded.

The live RPCs are authenticated-executable SECURITY DEFINER with empty search_path and no anon EXECUTE; they rely on explicitly checked role, parent and academy identity.

## Exact source identity (not a proposed migration)

| Function | Pinned `md5(pg_get_functiondef(...))` |
|---|---|
| `submit_parent_upi_payment(uuid,numeric,text,date,text)` | `d3788514af85e404504861936cfef20e` |
| `review_parent_upi_payment(uuid,text,text)` | `33852ded2505672448ed44ccf46a43e2` |
| `record_accepted_parent_upi_submission(uuid)` | `ff98c595f28944f33b7a8f50b4177722` |

`supabase/tests/security/ag34d33_live_upi_rpcs_scratch.sql` pins the original deployed sources and verifies native PostgreSQL normalized MD5 and client grants. This SQL is only applied to a fresh, unlinked, invented-data Supabase CI database **after** C2, D1, D3.1 and D3.2 success.

`supabase/tests/security/ag34d33_upi_null_role_scratch_candidate.sql` then installs the minimal *scratch-only* guards:
- Parent: `current_user_role() IS DISTINCT FROM 'parent'`
- Owner review/record: `v_role IS DISTINCT FROM 'academy_owner'`
- Review tenant: `academy_id IS DISTINCT FROM current_academy_id()`

These are **not** live SQL migrations or approved production fixes. The original source must be exercised **before** the candidate is installed.

## Risk contract and why each route is independent

- **Parent submission:** deployed `current_user_role() <> 'parent'` is NULL-unsafe; its later linked-parent requirement is a **concrete enforcing boundary**: live `parents.user_id` references `public.users(id)` and `users.role` is NOT NULL. The real signed unmapped JWT therefore cannot be assigned a valid Parent profile, and the unchanged deployed source must deny it with `Parent profile not found`. No parent-submission exploit is claimed; the scratch-only candidate denies NULL role earlier. Do not drop the FK or make role nullable in a fixture to force a bypass.
- **Owner review:** deployed `v_role <> 'academy_owner'` and `academy_id <> current_academy_id()` are NULL-unsafe. Native unmapped-JWT acceptance must be demonstrated in disposable data, and a scratch guard must subsequently block it.
- **Accepted-payment recording:** the initial role comparator is NULL-unsafe, but its downstream academy `IS DISTINCT FROM` comparator rejects a truly unmapped JWT and the separately validated scratch `collect_payment` guard rejects a role-NULL user with a mapped academy. **Do not claim a recording exploit unless a real authorization-bypass/ledger mutation is independently reproduced.**

## Isolated CI test contract

Workflow `.github/workflows/devbot-ag3-4d33-upi-rpcs.yml` executes the existing C2/D1/D3.1/D3.2 genuine GoTrue JWT fixtures, then D3.3. Required checks:

1. No hosted project link, migration source replay, customer data, service role token or remote connection. Require fresh JWT IDs and exact scratch baseline row counts.
2. Source MD5, RPC EXECUTE grants, original finance SELECT policies, source-attested `collect_payment` and correction prerequisites.
3. Original-source unmapped Parent submission **denied by the linked-profile/FK boundary**; a separate pending claim is seeded in scratch using authorized SQL fixture setup. Original-source unmapped Owner review must be shown modifying that claim (without changing the payment ledger), not merely returning a generic error.
4. Original-source recording downstream NULL-safe academy denial for an unmapped user, with no payment/claim/due/receipt/counter changes. Do not invent a mapped-NULL-role user in the hosted-equivalent schema because `users.role` is NOT NULL.
5. Scratch-only explicit role and academy protection: Owner A/B, Parent A/B, Coach, SA, unmapped, anon and forged JWT, including cross-tenant ID tampering.
6. Parent valid claim, duplicate academy UTR, one pending/accepted claim per due, invalid/overpaid/cross-parent submissions and genuine Owner review/rejection.
7. Acceptance/rejection leaves ledger unchanged; separate accepted-claim recording creates one `upi` payment, external UTR, receipt, correct due status, and linked recorded claim.
8. Duplicate record and stale/over-balance record must fail with unchanged financial/claim snapshot.
9. Fail CI on unexpected success, unrelated error text, source checksum drift, unauthorized mutation, missing invoice/receipt, missing teardown or wrong JWT scope.

Synthetic source-required schema does not reproduce all hosted triggers, indexes, Storage policies or historical migrations. Additional forced downstream failure and concurrent recording attempts should be reviewed as separately explicit follow-up if not proven by this run. The D3.1 existing payment rollback/concurrency checks are prerequisites, but do not by themselves certify UPI wrapper concurrency.

## Validation and release gates

- Native CI: **PENDING** until exact-HEAD GitHub Actions run succeeds.
- Product Owner/manual four-role browser acceptance: **PENDING**.
- Hosted remediation migration and genuine hosted role/tenant postflight: **NOT AUTHORIZED**.
- Historical 82-version migration provenance, H5.2 restore, HIGH-001 legacy mapping and HIGH-002 payment RPC fixes: still **OPEN**.
- Full frontend Jest green: **PENDING**.
- `main` deployment and AG3.4E: **NO-GO**.

Before any merge: inspect changed files and Git diff, check exact-HEAD isolated CI, verify no canonical migration/financial application change, have Owner review the named security results, then update continuity/status. A development-only merge does not imply production acceptance.
