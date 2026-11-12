# HIGH-002 — SEC-1 source audit and SEC-2 isolated review-only patch

**Date:** 13 November 2026 (IST)  
**Target branch:** `payment-module-finalization`  
**Review branch:** `sec-high002-rpc-role-guards-review`  
**Status:** SEC-1 source inspection COMPLETE; SEC-2 review-only SQL PREPARED. **NOT deployed, NOT verified with SEC-3 execution, NOT approved for live Supabase.**  
**Strict exclusions:** Parent UPI Claims removal, SP3 activation, migrations/history repair, frontend changes, financial data changes, any hosted DDL/DML, production `main`.

## SEC-1 — evidence and finding

Read **live deployed** `pg_get_functiondef()` and catalog owner/grants from `public` on 13 November 2026, and checked the current `payment-module-finalization` GitHub branch. Four exposed RPCs are `SECURITY DEFINER`, owned by `postgres`, `search_path = ''`, callable by `authenticated`, not `anon`. They check `auth.uid()` is non-NULL, then call `private.current_user_role()` backed by `public.users`.

| Function | Live original source MD5 | Original academy helper |
| --- | --- | --- |
| `collect_payment(uuid,numeric,text,text)` | `fcc5610c509392caf81ffa99b82051a9` | `private.is_payment_due_in_current_academy(v_due.player_id)` |
| `request_payment_correction(uuid,numeric,text)` | `9e2900dd0a7c960554896e0e51b23075` | `private.is_payment_player_in_current_academy(v_payment.player_id)` |
| `approve_payment_correction(uuid)` | `adfb6a80c05255e6d250207ae1e3ae1d` | `private.is_payment_player_in_current_academy(v_correction.player_id)` |
| `reject_payment_correction(uuid,text)` | `c21c953c1ac3e9afa201e5ec7c28c4e5` | `private.is_payment_player_in_current_academy(v_correction.player_id)` |

**Confirmed vulnerability:** all four use `IF v_role NOT IN ('super_admin','academy_owner') THEN ...` and `IF v_role = 'academy_owner' AND NOT private.is_payment_...(...) THEN ...`. In PostgreSQL, a missing mapped role yields `NULL`; `NULL NOT IN` is UNKNOWN and is **not** TRUE, so the first guard does not raise. An unmapped signed-in user also skips the academy check because `NULL = 'academy_owner'` is UNKNOWN. Even a mapped Owner's academy predicate must reject NULL, rather than silently skipping the exception.

Prior original-source signed-JWT negative test reproduced the `collect_payment` issue in a disposable native Supabase stack; **this is historical scratch evidence, not live remediation**: [AG3.4D3.1 run 43158144697](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43158144697).

**Role contract:** `ROLE_MATRIX.md` allows Super Admin across the platform and Academy Owner only inside their academy; Coach and Parent must not collect payments or request/approve/reject financial corrections. No roles are added or removed here.

## SEC-2 — exactly what is prepared

Source: `supabase/review_only/HIGH002_FOUR_PAYMENT_RPC_FAIL_CLOSED_REVIEW_ONLY.sql`.

This script contains **exactly the four fully expanded live function definitions**, not hypothetical placeholders. The only two changes per function are:

**1. Missing-role fail-closed check**
```sql
IF v_role IS NULL
   OR v_role NOT IN ('super_admin','academy_owner') THEN
  RAISE EXCEPTION '...existing authorization message...';
END IF;
```

**2. Academy membership check that denies FALSE or NULL**
```sql
IF v_role = 'academy_owner'
   AND private.is_payment_player_in_current_academy(v_player_id)
       IS NOT TRUE THEN
  RAISE EXCEPTION '...existing academy authorization message...';
END IF;
```
For `collect_payment`, the preexisting helper is `private.is_payment_due_in_current_academy(v_due.player_id)`. Other functions use their existing player helper and parameter.

Each function remains `SECURITY DEFINER` with an empty search path, the same identity, grants, return values, error messages, financial validations, transaction/receipt numbering and row-locking. `CREATE OR REPLACE FUNCTION` is used so existing authorized clients need no frontend change. The generator compared each patched function against the **exact live definition** after reversing those two string substitutions, and rejected any unrelated body change.

The SQL file is deliberately in `supabase/review_only/`, **not** `supabase/migrations/`. It includes a one-shot **preflight** asserting that the four live `pg_get_functiondef` MD5 hashes, function signatures, `postgres` ownership and `SECURITY DEFINER` metadata still match the inspected source. Drift triggers an exception **before** any function replacement (inside one transaction). It is NOT a supported re-runnable migration.

This design prevents an out-of-date script from silently overwriting a newer hosted payment implementation.

## What is NOT included

- No table, index, RLS policy, grant, trigger or role change.
- No change to invoice amounts, balance updates, receipts, collections, corrections, payment history, transaction numbering or tenant relationships.
- No deployment, mutation, test insert, `db push`, or modification of existing live financial data.
- No removal of the Parent UPI Claims page, route, backend RPCs or claim data. Their removal/deactivation remains a **separate approved beta cleanup**, as requested by the Product Owner.
- No SP3 One-time SQL activation and no legacy migration reconciliation.

## SEC-3 — acceptance tests required NEXT, not performed by this review

Do not execute the review-only patch on hosted Supabase until all tests below are completed on a **disposable** database with **source-matched functions** and real signed identities:

| Identity/test | collect | request correction | approve correction | reject correction |
| --- | --- | --- | --- | --- |
| Super Admin; valid academy data | PASS | PASS | PASS pending | PASS pending |
| Academy Owner A; own academy | PASS | PASS | PASS pending | PASS pending |
| Academy Owner A; foreign academy B | DENY | DENY | DENY | DENY |
| Coach | DENY | DENY | DENY | DENY |
| Parent | DENY | DENY | DENY | DENY |
| Authenticated JWT with **unmapped/NULL** app role | DENY | DENY | DENY | DENY |
| No signed identity / anon | DENY | DENY | DENY | DENY |
| Invalid/mismatched input and overpayment | preserve original errors and atomicity | preserve validation | preserve due and ledger rules | preserve rejection reason requirements |

For `approve` and `reject`, **use distinct disposable pending corrections** and check that approved/rejected status, adjustment ledger rows, receipts and due balances remain consistent. After denial, require **zero payment, correction, balance or numbering changes**. Validate ordinary partial/full collection, rollback and concurrent requests; a successful client response alone is not sufficient.

SEC-3 must verify both positive authorized and negative signed-JWT cases on the exact reviewed SQL. If any case fails, **stop**, do not expand scope or apply hosted DDL without revisiting the affected function.

## Later release approval gates (not part of SEC-1/SEC-2)

1. Read existing migrations/provenance and choose an **isolated, restorable deployment**; live database has more applied migration versions than checked-in files, so **no normal `supabase db push`**.
2. Product Owner approves exact deployment scope separately, after backup/restore rehearsal, verified source hashes, and signed-JWT SEC-3 results.
3. After authorized deployment, do **read-only** function hash/metadata postflight and controlled Own/Foreign/Coach/Parent/Unmapped security regression without touching real player financial records.
4. Update beta docs with actual deployed/tested status only after verification. HIGH-002 remains **OPEN** until this point.

**Next controlled task:** SEC-3 disposable security test fixture only (four functions, no other modules). The beta feature removal of Parent UPI Claims is independent.
