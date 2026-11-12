# AG3.4D3.2 — Source-attested correction RPCs with genuine signed-JWT regressions

**Status:** implementation staged in a development-only PR; native GitHub Actions acceptance pending. No hosted SQL migration, production customer payment call, `main` or Vercel change.

## Scope

Three currently callable, deployed `public` `SECURITY DEFINER` functions (original `pg_get_functiondef` source captured read-only, with normalized source MD5 checks):

| Public RPC | Deployed source MD5 | Legitimate callers |
|---|---|---|
| `request_payment_correction(uuid,numeric,text)` | `9e2900dd0a7c960554896e0e51b23075` | Academy Owner (own academy), Super Admin |
| `approve_payment_correction(uuid)` | `adfb6a80c05255e6d250207ae1e3ae1d` | Academy Owner (own academy), Super Admin |
| `reject_payment_correction(uuid,text)` | `c21c953c1ac3e9afa201e5ec7c28c4e5` | Academy Owner (own academy), Super Admin |

All three use the same NULL-unsafe `v_role NOT IN ('super_admin', 'academy_owner')` authorization check as the previously tested `collect_payment`; `v_role='academy_owner'` gates only Owners, not unmapped authenticated users. This is **AG34-HIGH-002**. The first signed-JWT test should reproduce unauthorized original-source requests and approval/rejection of synthetic cross-academy correction rows; the second phase replaces only each check with `v_role IS NULL OR v_role NOT IN (...)` **in the disposable database**, not hosted.

## Test matrix

The workflow creates a fresh unlinked native Supabase CLI 3.0.0/GoTrue/PostgREST stack under `RUNNER_TEMP` and requires **AG3.4C2, AG3.4D1 and AG3.4D3.1** all to pass first. It then creates six genuinely signed, invented identities (Owner A, Owner B, Coach, Parent, Super Admin, no-role user), source-matched functions, and minimal synthetic `payment_corrections` columns. Tests require:

- Exact original function MD5 parity, isolated native Auth counts, no anonymous `EXECUTE`, no direct client table write grants.
- All three original functions allow an unmapped JWT to cross the intended role/academy boundary in scratch (if not, do not claim it; investigate why).
- Scratch-only explicit NULL-role guard denies the same unmapped JWT; Coach, Parent and foreign Academy Owner denied with the expected error, with no financial/approval state change.
- Authorized Own-Academy Owner and cross-academy Super Admin request/approve/reject outcomes; duplicate pending requests blocked; adjustment ledger entries, receipt numbers and due statuses consistent.
- Corrections that would make paid dues negative or above total are rejected, with no mutations; a deliberately failing scratch-only adjustment insert after numbering must roll back counters, correction state and ledger together.

The original deployed RPC bodies are never modified to make them pass: the candidate functions are installed **after** original-source proof. All negative tests require the expected guard text and unchanged synthetic database fingerprint, not just a generic error response.

## Security and release boundaries

This test models only source-required columns on a synthetic scratch fixture. It does not reproduce all deployed financial triggers, historical migration ledger, full payment lifecycle or customer rows. **The live RPCs remain unchanged and AG34-HIGH-001/HIGH-002 remain OPEN**. The following are still independent workstreams: `review_parent_upi_payment`, `record_accepted_parent_upi_submission`, `submit_parent_upi_payment`, other callable RPCs (14 total), 16 Storage policies, Jest failures, H5.2 backup/restore, four-role browser QA and explicit separately approved hosted remediation.

A successful PR may merge to `payment-module-finalization` under the Owner's standing development-only permission, **only after exact-head native CI passes**. It must not turn the AG3.4E `NO_GO` production gate green.
