# HIGH-002 SEC-4 — deployment readiness and product-owner decision

**Review date:** 13 November 2026 (IST)
**Development base:** `payment-module-finalization` at `62e54bef15aafffe0810b9c64e8ce1ed81d5b250`
**Review branch:** `sec-high002-rpc-role-guards-review`, draft [PR #34](https://github.com/saurabh-shelke1993/acadpro-app/pull/34)
**SEC-4 verdict:** **HOLD / NOT AUTHORIZED for hosted DDL**. SEC-1 source review COMPLETE; SEC-2 exact patch PREPARED; SEC-3 signed-JWT SCRATCH PASS; hosted HIGH-002 STILL OPEN.
**Scope freeze:** exactly the four public payment collection/correction RPCs. No Parent UPI Claims removal, One-time SP3 activation, finance-table updates, legacy migration repair, `main` deployment or historic data cleanup.

## 1. Source of truth and verified evidence

| Gate | Evidence | Status |
| --- | --- | --- |
| Four deployed function bodies match the prepared original definitions | Read-only hosted `pg_get_functiondef()` MD5s on 13 Nov 2026 | PASS (unchanged; **vulnerable on hosted**) |
| Definer/owner/execution contract | Live PostgreSQL 17.6: owner postgres, SECURITY DEFINER, explicit empty search_path; authenticated EXECUTE allowed and anon EXECUTE denied for each of four RPCs | PASS |
| Four function signatures, unchanged financial logic | `supabase/review_only/HIGH002_FOUR_PAYMENT_RPC_FAIL_CLOSED_REVIEW_ONLY.sql` has the four complete original definitions with only two fail-closed guard substitutions each; 514 lines, BEGIN/COMMIT, source-MD5/owner/identity preflight | REVIEWED |
| Actual reviewed SQL with genuine Auth JWTs, permitted and denied roles | [SEC-3 exact-head CI 43311066906](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43311066906), revision `00989d3a0ccdb5ac1acd22c0aebeeab88654e5d0`; 7 offline checks and GoTrue/PostgREST role and tenant/ledger/receipt/rollback/concurrency tests | PASS — scratch only |
| Live history intact | Read-only hosted `supabase_migrations.schema_migrations`: **82** entries; 82 with stored statements, latest version `20261101082001` | PASS; do not repair/replay |
| Live payment relation availability | Read-only: `payment_dues`, `payments`, `payment_corrections`, `payment_number_counters` all exist; 27 due rows, 42 payments, 2 corrections, 20 counter rows at preflight | PASS; historical records untouched |
| Restorable backup | Private Windows H4 schema/data exports reported; H5 documentation explicitly says H5.1 verification and H5.2 isolated restore proof **not verified by project evidence**; full Storage bytes absent from SQL | **BLOCKER** |
| Hosted deployment/role regression | No authorized hosted DDL, hosted SQL mutation, live positive payment mutation or live role test executed | **PENDING** |
| External beta release | HIGH-001, HIGH-002 and other documented release gates remain open | **NO-GO** |

### Explicit original-source preflight hashes

- `approve_payment_correction(uuid)`: `adfb6a80c05255e6d250207ae1e3ae1d`
- `collect_payment(uuid,numeric,text,text)`: `fcc5610c509392caf81ffa99b82051a9`
- `reject_payment_correction(uuid,text)`: `c21c953c1ac3e9afa201e5ec7c28c4e5`
- `request_payment_correction(uuid,numeric,text)`: `9e2900dd0a7c960554896e0e51b23075`

The patch preflight checks these **before** replacing a single function inside one transaction and aborts on drift. It is not re-runnable after a successful application: after deployment, source hashes must change.

## 2. Exactly what SEC-5 would change — and what it would not

**Authorized technical target for future consideration:** one controlled atomic replacement of exactly four `CREATE OR REPLACE FUNCTION public.*` definitions, two security guard edits each:

1. `v_role IS NULL OR v_role NOT IN ('super_admin','academy_owner')` rejects users with no mapped role.
2. Existing Academy Owner player/due scope helper `IS NOT TRUE` rejects both false and NULL rather than silently allowing unknown.

No `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, index, RLS policy, function grant, new API, payment update, receipt renumbering, data backfill, SP3 camp charge or Parent UPI Claims cleanup is part of this security patch.

This changes **function definitions** in hosted PostgreSQL and therefore is DDL. It is not a frontend feature and requires **explicit Product Owner approval**; PR approval or merge does NOT authorize DDL.

## 3. Execution method — needs one explicit decision, not another migration project

**DO NOT run `supabase db push`, `migration repair`, `--include-all`, replay historical 82 versions, or use the standard checkout as a migration workspace.**

The tested SEC-2 review-only SQL has authored top-level `BEGIN; ... COMMIT;`. AG34-H3 demonstrated that **Supabase CLI 3.0.0 can treat authored transaction boundaries as sequential statements and record migration history outside that transaction**. Consequently **do not copy the review-only SQL unchanged into a CLI migration** without an isolated scratch proof of atomic function replacements **and** single version-record insertion.

Before SEC-5, decide ONE deployment route and test it:

- **Recommended for source/ledger consistency:** single **versioned** security change from the existing AG34-H3 private, unlinked workspace mechanism that fetches all already-applied history and stages **only one** new patch. A CLI-ready copy must be prepared from the reviewed four functions with the outer transaction removed only after a CI-verified source-equivalence and atomicity proof; use the tested pinned CLI version and inspect the sole pending version. This is **not a repair of the 82 existing migrations**.
- **Possible but not automatically approved:** attended one-shot SQL transaction with source checksum preflight and a clear recorded Git change. This avoids a new ledger entry but leaves hosted migration provenance inconsistent with repository migration history; obtain an explicit owner decision on that traceability trade-off before use. A manual SQL Editor execution is **not** interchangeable with the reviewed AG34-H3 atomic versioned flow.

**SEC-4 does not pick, generate, or execute either route**, and does not claim that a postflight SQL check creates migration traceability.

## 4. Recovery and containment — mandatory before authorization

The project H5 backup notes distinguish private exports from verified recoverability:

- H4 private schema and data exports were made sequentially, without a guaranteed common database snapshot; H5.1 original hash/roles/critical table coverage and H5.2 genuinely isolated PostgreSQL 17-compatible restore have **not been evidenced as PASS** here. Do not upload dumps, player/auth data, credentials, tokens or file paths with personal content to GitHub or chat.
- Before making hosted DDL changes, the operator must provide a **sanitized H5.1 PASS** from the private local verification, and an isolated restore/recovery rehearsal sufficient to verify the backup and core financial relationships. Full application backup (including Storage object bytes) remains a separate beta-release requirement; SQL alone does not recover Storage files.
- **Function-specific recovery drill:** in disposable database, preserve all four original source-attested `pg_get_functiondef()` outputs and test a controlled reversal/containment procedure. Restoration of the original bodies would **re-introduce HIGH-002** and should not be the normal rollback choice. Prefer temporarily disabling the affected four RPCs (with a separately reviewed reversible EXECUTE permission action), stopping payment writes and investigating rather than reopening the known vulnerability. Any emergency recovery/permission change requires owner/operator authorization and verified effective grants.
- Test fault path: if the four-function apply or preflight fails, the entire approved transaction and ledger entry (when versioned) must roll back. If postflight fails, halt payment collection and verify no customer-money inconsistency before any recovery action. Never run blind retry or migration repair.
- Define a short controlled maintenance window; avoid concurrent real collections during function replacement/postflight. Coordinate with the Owner who manually tests the Academy Owner and Super Admin role workflows.

**At SEC-4 time:** the specific H5 recovery proof and targeted emergency permission/rollback drill are **PENDING**. Thus hosted execution remains **HOLD**.

## 5. Minimal SEC-5 execution/runbook, only AFTER separate approval

**Preflight, read-only (operator):**
1. Confirm Git branch, PR #34 exact SHA, approved patch bytes and clean deployment workspace; keep parent UPI and SP3 out of this window.
2. Obtain sanitized H5.1/H5.2 recovery signoff, function-specific rollback/containment scratch result, exact single-file execution mechanism and maintenance window.
3. Read-only query the four full live `pg_get_functiondef()` hashes, signatures, owner, `SECURITY DEFINER`, empty search paths, anon/authenticated execute privileges. Require **the four original MD5s above**, without drift. Require 82 history entries or reconcile any legitimate subsequent migrations with a renewed approval, rather than forcing the old baseline.
4. Read-only record counts of `payment_dues`, `payments`, `payment_corrections`, `payment_number_counters` and existing call permissions. Counts are indicators; not substitutes for payment ledger reconciliation.
5. Reject any unexpected migration, function signature, table, grant, postflight behavior or required role test.

**Deployment (NOT authorized by SEC-4):**
6. One reviewed, attended atomic execution replacing only four functions. No other DDL/DML; verify the exact operation and source hashes immediately before executing. Never use normal `supabase db push`.

**Postflight, read-only plus separate controlled test-tenant acceptance:**
7. Require four definitions have both fail-closed guards, unchanged signatures, owner/SECURITY DEFINER/search_path and EXECUTE ACLs; no unexpected mutations/schema changes; original vulnerable MD5s must not remain.
8. Recheck payment/correction/receipt row counts and counters, noting that legitimate concurrent app operations may change counts unless the approved window excludes writes.
9. With permission and **disposable, non-paid test records only**, test Owner A own and foreign, SA allowed, Parent/Coach/unmapped/anonymous denied. Negative test response must be authorization denial and must not change financial rows/receipts/counters. Test approved partial/full payment, corrected payment and receipt via existing UI; avoid any real player financial mutation solely for testing.
10. Update development architecture/status/role security docs, save sanitized postflight evidence in the protected owner process, and only then mark **HIGH-002 CLOSED (for these four functions)**. Continue tracking HIGH-001, remaining RPC/Storage tests and beta release gates.

## 6. Decision table

| Question | Answer as of SEC-4 |
| --- | --- |
| Is the four-function HIGH-002 SQL patch prepared and proven in scratch? | **YES** |
| Does a new payment schema/table or subscription automation migration need to be developed? | **NO** |
| Must the currently vulnerable four hosted definitions be changed before external beta? | **YES** |
| Is normal `db push` or migration-history repair justified? | **NO** |
| Is backup restore and safe rollback/containment proven? | **NO** |
| Is a single controlled execution method with atomic/ledger proof finalized? | **NO** |
| Is SEC-5 authorized or hosted execution ready now? | **NO — HOLD** |

**Recommendation:** Finish only the recovery proof and one-function-group atomic rollout rehearsal, then return for an explicit Product Owner decision on this exact four-function hosted change. Do **not** resume SP3 One-time billing or the separate Parent UPI Claims removal inside SEC-5. Any later approval should name the exact SQL SHA/execution route, recovery evidence and operator window.
