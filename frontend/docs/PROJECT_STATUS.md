# AcadPro Project Status

## AG3.4B — confirmed unsafe deployed legacy Coach policy behavior in disposable reconstruction

**CODE/CI COMPLETE (10/10 static + real GoTrue/PostgREST) / HOSTED FIX NOT APPLIED:** [Run 43046427442](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43046427442) cloned four exact live `public.coach_batches` RLS predicates, the required live `coaches_select` dependency and grants. Same-academy Parent accounts read unrelated legacy mappings, Coach read inactive legacy mapping, and both Parent and Coach successfully inserted/deleted **foreign-Coach → own-academy Batch** links in isolated synthetic records. Test-only role-gated candidate closed those paths, protected Owner/SA rights and maintained counts.

**CRITICAL DISTINCTION:** No real customer-row exploitation has been alleged, no hosted policy was modified, and the candidate is not a canonical migration. Dedicated migration/release approval, historical reconciliation, full Finance/RPC/Storage and AG3.4E acceptance remain pending. [Design and evidence](KHELTRIVA_DEVBOT_AG3_4B_COACH_POLICY_PARITY.md).


## AG3.4A — live read-only RBAC/RLS catalog inventory (11 November 2026)

**STATUS: INSPECTED AND DOCUMENTED; REVIEW PENDING; NO PRODUCTION CHANGE.** Current healthy `acadpro-db`: 28 public RLS-enabled base tables, 103 policy records, 42 private helpers/functions and 14 public authenticated SECURITY DEFINER RPCs. Security Advisor currently shows 14 RPC warnings, two INFO RLS/no-policy tables with no client table grants, and disabled leaked-password protection. 82 live migration records versus 40 local SQL source files; 23 exact version-prefix matches are not SQL parity. Three intentionally public Storage buckets, one private player-photo bucket. No public views.

**RISK REGISTER:** `public.coach_batches` authenticated SELECT and mutation grants + academy-equality RLS branches have **no explicit academy_owner check**; current academy helper is not role-gated. This is a **candidate security exposure, not tested exploitation**. No non-internal table triggers/FK-enforced Coach/Batch academy alignment were observed. `centers_select` academy-wide scope requires alignment with Parent Portal and Role Matrix; production `private.current_parent_id()` requires active parent, not represented in AG3.3 synthetic fixture. Next AG3.4B must use review-approved *scratch-only* real-JWT negative tests with exact attested policy/helper dependencies. No live direct-ID mutation or destructive test was run. [Full AG3.4A report](KHELTRIVA_DEVBOT_AG3_4A_LIVE_POLICY_INVENTORY_20261111.md).

**AG3.3 MERGED:** Owner-approved [PR #7](https://github.com/saurabh-shelke1993/acadpro-app/pull/7) merged into `payment-module-finalization` at `9b8ba8edd4c4be7790ad0b5e48c5d8f2c26b36b9`. All native synthetic AG3.1–AG3.3 validations passed, but full deployed authorization is not signed off. `main`, Vercel and hosted Supabase unchanged. B4 NO-GO.


## AG3.3 — Parent and Super Admin authorization native CI PASS (11 November 2026)

**IMPLEMENTED / AUTOMATED TESTED / OWNER REVIEW PENDING:** [Run 43039558349](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43039558349) successfully completed 14/14 pure safety tests, unlinked Supabase CLI 3.0.0 startup, real GoTrue sessions, signed JWT PostgREST authorization/denial checks, and final database/no-backup teardown. Parent A1/A2 (same academy) and Parent B can only access their own synthetic parent, child and batch; negative direct IDs for both same-tenant other Parent and cross-tenant denied. Super Admin can read across academies and complete synthetic batch create/reassign/delete. Parent/Coach writes denied, earlier Owner/Coach scopes preserved, unmapped/anon/invalid JWT and forged headers denied. [PR #7](https://github.com/saurabh-shelke1993/acadpro-app/pull/7) is open; no Owner acceptance or merge.

**SCOPE / OPEN GATES:** Synthetic Parent/SA policy and minimal parents/players tables are nonhistorical, **not deployed-policy equivalence**. The pinned 11 helpers exclude the production `private.current_parent_id()` function; link checks use verified public FKs and native `auth.uid()`. Parent Portal/RPC, complete hosted role policies, finance/Storage, 82 historical migrations and AG3.4 parity still require separate work. B4 release NO-GO. No main or hosted Supabase updates. [AG3.3 scope](KHELTRIVA_DEVBOT_AG3_3.md).

**AG3.2 OWNER-APPROVED/MERGED:** [PR #6](https://github.com/saurabh-shelke1993/acadpro-app/pull/6) merged at `39766dfe85b36fb1ea8f52e6d7ae14f11552cb1b` into `payment-module-finalization`, not main.


## AG3.2 — real Coach JWT assigned-batch security CI PASS (11 November 2026)

**IMPLEMENTED / REAL NATIVE CI TESTED / OWNER ACCEPTANCE PENDING:** [Run 43031441781](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43031441781) PASS for an unlinked scratch Supabase CLI instance with real GoTrue-issued Coach A/B JWTs and PostgREST. Positive active batch, inactive same-academy membership, cross-academy direct IDs, forged headers, unauthenticated/invalid requests, forbidden writes, no direct Coach mapping table access, and Owner A/B regression passed. [PR #6](https://github.com/saurabh-shelke1993/acadpro-app/pull/6) targets `payment-module-finalization` only; not merged pending Owner acceptance.

**SCOPE:** The Coach policy is synthetic, constructed from the original B2.9 pinned helpers, not deployed-production policy parity. AG3.3 Parent/Super Admin and AG3.4 original policy/security parity still pending. `private.can_access_batch` recognizes `coach_batches` membership independent of activity; `private.is_coach_assigned_to_batch` checks `coach_batch_assignments.is_active` and is the tested batch-read predicate. No hosted database/frontend/payment changes or B4 activation. [AG3.2 contract](KHELTRIVA_DEVBOT_AG3_2.md).

**AG3.1 ACCEPTED/MERGED:** [PR #5](https://github.com/saurabh-shelke1993/acadpro-app/pull/5) merged at `e3505d415285b2a96fe41f2294d7cb293793b986`, development branch only.


## AG3.1 — real JWT-backed owner batch isolation CI PASS (11 November 2026)

**IMPLEMENTED / REAL POSTGREST CI PASS / OWNER REVIEW PENDING:** [Run 43027355787](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43027355787) passed nine AG3 pure safety checks and a full real native Supabase Auth / PostgREST sequence. Both owners' real Auth-issued bearer JWTs can read their own synthetic academy's batch; direct cross-academy ID requests return zero rows. A real signed-in unmapped identity sees zero rows; anonymous and forged bearer tokens receive denial, fake tenant/user HTTP headers do not change scope, and ungranted INSERT/UPDATE/DELETE return rejection. Final SQL confirmed 3 native Auth, 2 app owners, 2 batches, 11 unmodified helpers and the single **scratch-only** scoped SELECT policy. [AG3.1 test design](KHELTRIVA_DEVBOT_AG3.md).

**LIMIT:** The policy created and tested by AG3.1 is **synthetic nonhistorical**, not the authentic full production RLS policy set. Coach, Parent and Super Admin roles, Coach assignments, real player/financial scopes, Storage, the protected 82-version historical replay and B4 remain **PENDING**. The Windows C3.4B2 local database remains untouched and unverified.

**APPROVED AG2:** PR #4 was merged into `payment-module-finalization` at `97b7d267`; [post-merge native CI run 43023539387](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43023539387) PASS. AG3 is isolated in its own feature branch; `main` and Vercel unchanged.

## Kheltriva DevBot AG2 — real Supabase Auth CI PASS (11 November 2026)

**AG2 IMPLEMENTED / REAL CI TESTED / PR #4 MERGED:** [GitHub Actions 43022481533](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43022481533) successfully started a fresh CI-only, unlinked Supabase CLI v3.0.0 stack. Seven pure safety tests passed. Native GoTrue rejected a malformed JWT, issued and verified real bearer sessions for one unmapped smoke account and Academy Owners A/B, and exact existing synthetic SQL mapped both owner UUIDs. Fresh SQL checked **3 native Auth users, 2 scoped app users, 2 batches, 11 helper functions**, and RLS/client grant invariants.

**IMPORTANT SCOPE:** AG2 tested native Auth and FK mappings, **not actual positive/negative cross-tenant PostgREST RLS** (AG3). The original Windows C3.4B2 local database is untouched and still awaiting its separate read-only check. The protected historical replay, Storage/finance and B4 release remain **NO-GO**. [AG2 test design](KHELTRIVA_DEVBOT_AG2.md).

**COST/DEPLOYMENT:** Standard public-repo GitHub Linux runner only; no hosted Supabase, paid AI API, prod secrets, canonical migrations, Vercel or main-branch change. Owner merge approval pending.

## Kheltriva DevBot AG1 validation (11 November 2026)

**QUICK PASS:** [GitHub run 43003179195](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43003179195) succeeded without Owner PowerShell.

**FULL SUITE REPORT:** [Run 43003373047](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43003373047) passed self-tests, B2.9 Auth static guards, npm install and React build; Jest has 16 failures/474 passes (4 suites failing). **Verified pre-existing** on parent SHA [Phase 7.5 run 42988928180](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42988928180). No unrelated application code changes.

**AG1 focused CI PASS** ([run 43004019069](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43004019069)); **PR #3 OPEN / OWNER APPROVAL PENDING**; push now runs Auth static checks, while frontend/all options continue to show existing test debt. **AG2 real GoTrue integration pending.** C3.4B2 laptop persistence remains unresolved; no hosted DB writes or deployment.

## Kheltriva DevBot V1 — AG1 implementation (11 November 2026)

**IMPLEMENTED IN FEATURE BRANCH / CI PENDING:** Deterministic CI test runner with short mobile-friendly summary; no secrets, DB mutation, deployment or paid AI. Four suites: quick, auth-static, frontend, all. [Design & limits](KHELTRIVA_DEVBOT_V1.md). Merging/activation requires review. AG2 real disposable Supabase GoTrue tests not implemented.

**C3.4B2 LOCAL PENDING:** Owner B script failed due to mismatched success marker; correction CI passed but fresh read-only local DB verification has not been reported. Never rerun signup.

**Last Updated:** 11 November 2026 (B2.9-C1 disposable RLS CI PASS; C2 local preflight prepared, full Supabase replay pending)
**Current Version:** V1.0 Beta (development; not release sign-off)  
**Current Git Branch:** `payment-module-finalization`


## C3.4B2 reported script failure — incident review pending (11 November 2026)

**OWNER EXECUTED / SQL PERSISTENCE NOT VERIFIED:** B2's GoTrue signup advanced to mapping SQL, but PowerShell incorrectly compared the SQL's B2 success message with B1's success marker. The code mismatch is confirmed; the database might already contain a valid B2 owner mapping. **Do not rerun signup or mapping SQL.** A separate read-only SQL check of local counts and both owner roles is required before closing B2.

**IMPLEMENTATION FIX:** B2 marker corrected and CI regression test added. This fixes misleading status detection, not an established database failure. Real cross-academy JWT/RLS and B4 remain blocked.

## B2.9-C3.4B1 local PASS / C3.4B2 CI PASS (11 November 2026)

**B1 OWNER-TESTED PASS:** Real local GoTrue session and FK-backed Academy A `academy_owner` mapping succeeded; 2 Auth users, 1 app user, 11 private helpers and 2 synthetic batches. No cross-academy RLS was exercised.

**B2 PREPARED / CI PASS / OWNER RUN PENDING:** [GitHub Actions 42987891004](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42987891004) passed 43/43 safety tests, PowerShell parsing and a synthetic PostgreSQL 17 mapping transaction for second Academy B owner. Actual GoTrue B2 signup and SQL have NOT run in the Owner's isolated environment. [C3.4B2 plan](PS_L2_3B_B2_9_C3_4B2_OWNER_B_20261111.md).

**BLOCKED:** C3.4 coach identity setup, real signed-JWT role/tenant RLS proof, Storage/finance, protected historical replay and B4.

## B2.9-C3.4B1 — first role identity (11 November 2026)

**B1A OWNER-TESTED PASS (original CI 38/38 PASS):** [GitHub Actions 42986582846](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42986582846) passed 38 Python static guards, PowerShell parser checks, and independent native-shaped PostgreSQL 17 mapping SQL. No actual new GoTrue account was created in CI.  Read-only FK preflight confirmed `1|0|0|0|0|1|1`. Implementation provisions one Auth-issued Academy Owner A in isolated scratch, links exactly one app user using guarded SQL, preserves 5 RLS-enabled app tables, and grants no new client access. [B1a reference](PS_L2_3B_B2_9_C3_4B1_OWNER_A_20261111.md).

**NOT YET TESTED:** Signed JWT role/tenant helper evaluation, Coach B/Owner B mappings, cross-tenant RLS positive/negative cases, historical replay, Storage/finance, B4.

## B2.9-C3.4A verified / C3.4B planned — 11 November 2026

**C3.4A OWNER-TESTED PASS:** One invented account was created through the real isolated GoTrue Auth API, and a bearer session verified using `GET /auth/v1/user`. Output: `local_auth_users=1`, `app_users=0`, `current_state_helpers=11`, `synthetic_batches=2`; no historical replay or hosted modifications.

**C3.4B PLANNED / NOT IMPLEMENTED:** Create new synthetic, real local GoTrue accounts for role-based tests; bind their actual UUIDs to minimal synthetic `public.users` and coach/batch mappings **only after review**. The first smoke account's randomly generated password was deliberately not retained, so it is not a reusable test login. See [C3.4B design](PS_L2_3B_B2_9_C3_4B_ROLE_IDENTITY_PLAN_20261111.md).

**PENDING / NOT AUTHORIZED:** Actual JWT-based cross-tenant RLS, Storage, finance/35 scenarios, 82 historical migrations and B4 production integration.

## B2.9-C3.4A — Native local Supabase Auth preflight PASS (11 November 2026)

**OWNER VERIFIED:** `local_api_verified=true`, `publishable_key_available=true`, `email_confirmations_disabled=true` in the isolated `kheltriva-b29-disposable` workspace, with Supabase CLI v3.0.0.

**C3.4A HISTORICAL PRE-EXECUTION STATUS (NOW OWNER-TESTED PASS):** [Run 42983842960](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42983842960) passed **32/32 static Python safeguards**, PowerShell syntax parsing, and existing disposable PostgreSQL tests. No actual GoTrue Auth signup was run by CI.  Prepared a fail-closed one-user GoTrue signup + GET /auth/v1/user session check using only the real LOCAL service, with in-memory credentials and post-state guards. No app-table grants, RLS changes, historical replay or billing. [Checkpoint plan](PS_L2_3B_B2_9_C3_4_LOCAL_AUTH_PLAN_20261111.md).

**Next gate:** CI syntax/static checks, followed by Owner-only local run of the script. Real multi-tenant positive/negative RLS and Storage/finance tests remain pending.
## B2.9-C3.3B closed / C3.4A local Auth next (11 November 2026)

**C3.3B LOCAL PASS:** Owner's separate-session SELECT returned 11|2|0|t|f|t, verifying persistence of 11 current-state helpers and intended private schema usage. Original historical helper provenance remains unresolved.

**C3.4A HISTORICAL PLAN (NOW OWNER-TESTED PASS):** Create a single invented account through the **real local Supabase Auth API**, then verify its actual bearer session without printing tokens. No real tenant data or production changes. [C3.4A plan](PS_L2_3B_B2_9_C3_4_LOCAL_AUTH_PLAN_20261111.md).

**STILL BLOCKED:** Real app role/RLS positive-negative tests, Storage, finance, full B3 historical replay, B4 deployment.
## B2.9-C3.3B pinned helpers local installation (11 November 2026)

**C3.3A LOCAL PASS:** Owner confirmed COMMIT, five RLS-enabled synthetic tables, two invented batches, zero Auth/app users, native auth.uid() retained (`5|2|0|0|t`).

**C3.3B OWNER EXECUTED / IN-TRANSACTION VALIDATION PASS; INDEPENDENT PERSISTENCE CHECK PENDING:** Owner executed precheck, unchanged 11 helpers, and postcheck with `psql -X --single-transaction -v ON_ERROR_STOP=1` in `supabase_db_kheltriva-b29-disposable`. Output showed 11 `CREATE FUNCTION`, no SQL errors, and `C3.3B CURRENT HELPERS VERIFIED | 11 | 2 | 0 | t`. No explicit `COMMIT` line appeared (possible with psql-managed single transaction), so a separate-session SELECT will verify persistence. Original  [GitHub Actions 42981068438](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42981068438) passed 27/27 Python safety/source guards plus a full precheck/11-helper/postcheck atomic transaction in an independent native-shaped PostgreSQL 17 instance. CI's Auth shim is FAKE and never used locally; it is not real Supabase Auth verification.  Atomic precheck + unchanged 11-helper current-state SQL + postcheck with native Auth SHA-256 preservation, 11 pinned helper-body hashes, ownership/search paths/grants and missing JWT negative tests. [C3.3B plan](PS_L2_3B_B2_9_C3_3B_LOCAL_HELPERS_20261111.md).

**BLOCKED:** Historical replay, actual Auth-JWT positive tests, storage/finance 35-scenario validation and B4 implementation.

## B2.9-C3.3A — native local Supabase synthetic prerequisite fixture (11 November 2026)

**OWNER ENVIRONMENT VERIFIED:** Local isolated Supabase PostgreSQL, Auth and API Gateway running after optional-service exclusions. Local Auth returned HTTP 200; native auth.uid()/roles and absent app tables/private schema all verified with six `t` values.

**IMPLEMENTED / CI GUARDS PASSED / LOCAL EXECUTION PENDING:** [GitHub Actions 42978924163](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42978924163) passed **21/21** Python guard tests plus the prior disposable PostgreSQL helper/RLS SQL checks. The new local-native schema SQL has NOT been executed. Guarded, transaction-scoped **native** Supabase prerequisite SQL creates only five RLS-enabled synthetic app tables and two synthetic batch records; no Auth role/function recreation, no customer/financial data. Exact local Docker container run awaits Owner and CI safety validation. [C3.3A reference](PS_L2_3B_B2_9_C3_3A_NATIVE_SUPABASE_PREREQUISITE_20261111.md).

**STILL BLOCKED:** Authentic original SQL helper provenance, 14 quarantines, 6 historical divergences, full B3 Supabase Auth/RLS/Storage/finance replay, 22 legacy agreement approvals and B4 billing integration.

## B2.9-C1/C2 — Owner-authorized disposable-only reconstruction (11 November 2026)

**AUTHORIZED:** Current 11-function B2.9 snapshot as a nonhistorical disposable testing baseline (GitHub Actions first), and preparation of a local unlinked Supabase validation plan. **NOT authorized:** production project access changes, actual player/payment data, canonical migration edits, paid infrastructure or B4 activation.

**IMPLEMENTED AND CI PASS:** Isolated PostgreSQL 17 workflow [42971178667](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42971178667): B2.9 source integrity **5/5**, new RLS test safeguards **6/6**, existing helper role assertions and newly constructed synthetic Super Admin/Owner/Coach/Parent/anonymous RLS isolation assertions all PASS.

**C2 OFFLINE VALIDATION:** Read-only PowerShell preflight static safeguards **4/4 PASS** in [GitHub Actions 42971621790](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42971621790). Across B2.9 baseline, extended RLS and preflight checks **15/15 Python tests passed**; isolated PostgreSQL synthetic SQL checks also PASS. Full local Supabase test remains NOT RUN.

**LOCAL PREPARATION:** Read-only Windows PowerShell environment preflight added, plus [local Supabase validation preparation](PS_L2_3B_LOCAL_SUPABASE_PREPARATION_20261111.md). This checks Docker/CLI/archive presence only; it does not start containers or replay SQL. Full local Supabase Auth/RLS/Storage/finance 35-scenario validation remains NOT RUN.

**HISTORICAL REPLAY AND B4:** Still blocked pending original helper provenance / approved scratch reconstruction, six source divergences, 14 quarantined SQL dispositions, all 22 legacy agreement approvals, financial anomaly reconciliation, and actual isolated Supabase security tests. Synthetic JWT via a GUC cannot certify real authentication.

## B4 subscription lifecycle integration — assessed NO-GO (11 November 2026)

**READ-ONLY AUDIT:** 22 active legacy agreements (all open-ended), three academy mismatches, one linked to inactive player; 26 dues and 42 payments. Proposed PS-L2.3 period/policy/event tables and period due FK absent from active Supabase; no hosted branches, pg_cron or btree_gist. The 35 B3.6 real role/finance tests have not run. Missing original helper provenance and Owner reconciliation prevent B4 live integration. Fail-closed B4 readiness validator **6/6 PASS** ([run 42969566233](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42969566233)); assessment remains NO-GO. [B4 report](PS_L2_3B_B4_INTEGRATION_READINESS_20261111.md).

**NO-GO:** No new subscription schema, RPCs, automatic renewal, due generator, production credentials or payment data changed. B4 remains BLOCKED until unlinked Supabase replay and explicit Owner security/product acceptance.

## B3.7B historical helper dependency review (11 November 2026)

**REVIEWED:** The original `20260903173804` first-use statement creates `private.coach_academy_id`, four Coach assignment policies, and schema USAGE grant, but calls four foundational helpers missing their original CREATE statements. Parent email-based resolver at `20260908062059` precedes the `parents.user_id` revision at `20260912142706`. Three candidate reconstruction approaches documented, none approved. [B3.7B report](PS_L2_3B_B3_7B_HELPER_DEPENDENCY_REVIEW_20261111.md).

**BLOCKED:** Authentic helper origin, disposable reconstruction choice, full B3 Supabase security replay, legacy 22-agreement review and B4 subscription integration.

## B3.7A — historical helper chronology (11 November 2026)

**READ-ONLY REVIEW DONE / CI PASS:** The retained 82/168 original-source ledger has no identifiable foundational CREATE for the 11 current B2.9 helpers or private schema. All 11 current live function hashes and metadata match the pinned B2.9 manifest. Historical parent function uses email at 20260908062059, before parents.user_id and revised helper at 20260912142706. No historical provenance or replay approval was inferred. [B3.7A details](PS_L2_3B_B3_7A_HISTORICAL_HELPER_CHRONOLOGY_20261111.md).

**BLOCKED:** Authentic original helper source, audited scratch bootstrap approval, B3 full Supabase Auth/RLS/Storage/finance replay, 22 legacy subscription activation, and B4 lifecycle integration.

## B3.6 non-executable reconstruction planning (11 November 2026)

**IMPLEMENTED / CI PASSED:** 82 original migrations ordered in a sanitized plan; 14 B3.5C quarantine treatments; six divergent sources, helper/parent/finance chronology, 35 role, Storage and financial synthetic scenarios (all NOT_RUN). Python contract and independent [GitHub Actions B3.6 validation](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42966102654) **PASS — 11/11 synthetic tests at `fd08c9b`**. Recovery evidence workflow [42966102497](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42966102497) also **PASS**. [B3.6 report](PS_L2_3B_B3_6_DISPOSABLE_RECONSTRUCTION_PLAN_20261111.md).

**BLOCKED:** Essential SQL DDL/data split approval, original helper provenance, isolated Supabase Auth/RLS/Storage replay, 35 runtime role and financial tests, owner security sign-off, 22 legacy subscription renewals, PS-L2.3 integration. No executable SQL, canonical migration changes, production data changes or live credentials affected.

## B3.5C technical disposition register checkpoint (11 November 2026)

**IMPLEMENTED (docs/metadata only):** Sanitized 14-case technical disposition report and non-executable register added with strict false replay/production flags, preserving original sources in the private archive. Owner B3.5B scan output: 82 versions, 168 elements, 14/14 structurally scanned; manual_review=false and replay=false. Original SQL reviewed with active Supabase SELECT only. All 14 technically classified, **0 approved**. See [B3.5C technical dispositions](PS_L2_3B_B3_5C_TECHNICAL_DISPOSITIONS_20261111.md).

**VALIDATION:** B3.5 synthetic Python tests **13/13 PASS** at source SHA `e7d7227` ([CI 42964368559](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42964368559)); recovery evidence CI **PASS** ([42964368588](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42964368588)). Full frontend Jest is a separate open regression gate (4 failed suites / 16 failed tests, 474 passed), unrelated to documentation/SQL reviewer. No live mutation or executable replay occurred.

**PENDING/BLOCKED:** Manual essential DDL/data split, historical helper privilege/creation order, RLS/SECURITY DEFINER and multi-tenant negative tests in an unlinked disposable Supabase, financial ledger discrepancies (11 due/transaction mismatches, 10 paid dues without linked entries), full B3 reconstruction and B4 subscriptions. No deployed billing automation or legacy auto-renewal.

## PS-L2.3B B3.5 local historical SQL security-review preparation (11 November 2026)

**Implemented/tested:** Private-only original-source structural reviewer with complete 82-migration/168-element B3.3 fingerprint gate, exact 14-case B3.4 quarantine coverage, masked SQL categories, grant/RLS/trigger/finance manual review checklist and strict no-replay flags. [GitHub Actions 42957811902](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42957811902) **PASS, 12 synthetic tests**. Existing frontend/financial/RLS code and canonical migrations unchanged.

**Connected live catalog (SELECT only):** RLS is enabled for six current player/parent/attendance/batch/payment_dues tables; 42 current private functions (35 SECURITY DEFINER), 114 current policies referencing private schema. This does **not** verify historical grant, function, trigger or SQL replay equivalence.

**Pending:** Actual B3.5 local scan of the owner's private B3.4 original SQL archive, manual classification and owner sign-off of 14 historical data/procedural SQL cases (including historical player UUIDs and payment/receipt backfills), complete unlinked disposable Supabase reconstruction, RBAC tenant-negative/finance parity tests and B4 lifecycle integration. Production unchanged. See PS_L2_3B_B3_5_PRIVATE_SECURITY_REVIEW_20261111.md.

## PS-L2.3B B3.4 local archive attestation — owner validation PASS (11 November 2026)

**Owner-executed and output-confirmed:** After the Windows CRLF checkout verifier repair, the owner ran the password-free local B3.4 `--finalize-existing` command on `supabase/recovery/historical-baseline/.recovery-private/baseline-b3-4-001`. Their PowerShell output reported **82 migration versions, 168 original SQL array elements, `source_hashes_verified_before_archive=true`, and `ready_for_disposable_replay=false`**. The existing archive manifest was present. Finalization's code path re-attests the complete B2.7 source archive and all 168 B3.3 element hashes without applying SQL. This is **user-supplied local verification output**; GitHub and connected Supabase cannot directly inspect the private local archive.

**State change:** B3.4 actual local archival verification **PASSED** (as reported), replacing the earlier *archive pending* status. Historical record-specific operations (14 reviewed/quarantined candidates), helper provenance, source security approval, full disposable Supabase Auth/RLS/finance replay, and B4 subscriptions remain **PENDING/BLOCKED**. No production database, credentials, canonical migrations or customer payment records changed.

## B3.4 recovery note — Windows CRLF source-hash false mismatch (11 November 2026)

A Windows local owner import stopped during post-export analysis at original version 20260920041653. Original Git LF content was reverified to match the pinned remote SQL hash after one trailing LF removal; a Windows CRLF working copy can fail the previous strict local-binary check.

B3.1 now accepts CRLF line-endings **only when CRLF-to-LF normalization produces the exact pinned source hash**. Mixed line endings and real SQL content changes still fail. [B3.1 CI 42954533764](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42954533764) **PASS — 12 tests**.

The earlier B3.4 run can have already written its private original archive before the post-archive check failed. A new --finalize-existing mode checks the existing archive's original hashes and creates only a sanitized final attestation; no SQL export, deletion, overwriting or database access. [B3.4 CI 42954795483](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42954795483) **PASS — 15 tests**. The owner still needs to execute the local finalization; actual archive verification status PENDING.

From repository root after pulling the branch:

    $private = "supabase\recovery\historical-baseline\.recovery-private"
    Test-Path "$private\baseline-b3-4-001\manifest.json"
    python supabase/recovery/historical-baseline/b3_4_import_dashboard_csv.py --root . --finalize-existing --output "$private\baseline-b3-4-001"

Run the finalization command **only if Test-Path returns True**; otherwise inspect filenames without deleting any private source files. Detailed B3.4 development report is in frontend/docs/PS_L2_3B_B3_4_PRIVATE_ARCHIVE_ACQUISITION_20261111.md.

**Still blocked:** full disposable Supabase replay, historical DML quarantine approval, Auth/RLS/finance parity, and PS-L2.3 subscription deployment. Hosted database, canonical migrations and credentials unchanged.

## PS-L2.3B B3.4 private historical source acquisition preparation (11 November 2026)

**Implemented/tested:** Password-free SQL Editor CSV import workflow b3_4_import_dashboard_csv.py. It accepts privately exported original migration statement arrays, verifies B2.4 full-history fingerprints and all 168 B3.3 element-level SHA-256 hashes **before archival**, then reuses B2.7 archive attestation. **12 synthetic CI tests PASS** ([run 42889010851](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42889010851)). Connected Supabase SELECT-only count remains 82 historical versions / 168 original elements.

**Review register:** 14 historical DML/procedural migrations with potential production-data impacts remain quarantined, source/privilege/DDL split **not approved**. No raw SQL in GitHub; no migration executed.

**Pending owner action:** Export five Google-authenticated SQL Editor CSV batches at offsets 0/20/40/60/80 into the ignored local private directory and run importer. **Actual protected SQL archive NOT YET CREATED OR VERIFIED**. Full B3 disposable Supabase/Auth/RLS/finance replay and B4 actual subscription billing integration remain BLOCKED. Production database/migrations/passwords/payments/subscriptions unchanged. See PS_L2_3B_B3_4_PRIVATE_ARCHIVE_ACQUISITION_20261111.md.

## PS-L2.3B B3.3 original SQL statement-source audit (11 November 2026)

**Original source evidence:** The connected Supabase ledger retains **82 migrations, 168 SQL array elements (361,302 UTF-8 bytes)**. All 168 original source element SHA-256 hashes, order and lengths were captured as sanitized metadata. The original `20260823093317` remote schema has 87 semicolon-free array entries, whereas Git has 87 delimited statements: in-memory statement-aware lexical comparison finds **87/87 token-equivalent positions**. This **corrects the prior whole-concatenation token-mismatch assessment**; it does not prove security, constraint or real replay parity.

**Implemented and tested:** `b3_3_original_source_audit.py` and twelve focused tests, [GitHub Actions 42886946692](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42886946692) **PASS**. The tool validates committed source metadata now and can verify all 168 original SQL element hashes when a protected raw archive exists. No raw SQL or real user/payment data committed; no migration SQL executed.

**Blocking:** Private full original SQL archive not yet generated/verified, other six-source comparison security sign-off pending, two historical player-cleanup UUID discrepancies quarantined, 14 data/procedural cases require review. Original helper provenance, complete B3 Supabase Auth/RLS/financial replay and B4 subscription integration remain **NOT TESTED**. No live DB/credentials/payment changes. Report: `PS_L2_3B_B3_3_ORIGINAL_STATEMENT_REVIEW_20261111.md`.

## PS-L2.3B B3.2 source reconciliation checkpoint (11 November 2026)

**Implementation:** Redacted six-divergence inventory and `b3_2_reconciliation_design.py` with 10 tests. [GitHub Actions 42883854807](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42883854807) **PASS**, non-executable **82-entry** review manifest generated and retained as a short-lived artifact; no application or active migrations modified.

**Evidence:** 25 strict Git-content links, 57 unlinked remote records (6 same-version differences, 51 no content match), 8 retimestamped links, 14 data/procedural quarantine cases. Initial remote/Git schema shares 17 detectable CREATE names but is not proven equivalent; two historical player-batch cleanups contain changed UUID selector literals. Original private authorization helpers remain a **current-state test reconstruction**, not historical source.

**Blocked:** Original historical SQL immutable archive/review, six difference decisions, approved statement-level treatment of customer/payment backfills, 11-helper source/privilege timing, disposable-only executable tree, complete Supabase/Auth/RLS/payment B3 replay and B4 subscription lifecycle validation. Existing legacy 22 subscription agreements remain on automatic-billing HOLD. No hosted schema, credentials, payments, dues, receipts or subscriptions changed. See `PS_L2_3B_B3_2_SOURCE_RECONCILIATION_20261111.md`.

## PS-L2.3B B3.1 historical migration assembly checkpoint (11 November 2026)

**Implemented and tested:** Offline `b3_1_assembly_manifest.py` plus 9 tests and CI generation of **82 ordered historical metadata records**, with original source version/name/hash, verified strict Git SQL-content links, original historical sequence, B2.9 helper insertion candidate and per-migration data/procedural quarantine. [GitHub Actions 42882011251](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42882011251) **PASS**, review-only manifest available as CI artifact. No SQL files generated or executed.

**Review status:** 25 strict Git-content links, 57 remote unlinked, 6 content divergences, 51 remote with no content link, 15 unmatched Git files, 14 specifically quarantined historical data/procedure migration records; **all 82 entries remain PENDING**. Duplicate `20260926133000` and 12-digit `202610210001` remain unresolved. Current 11-helper snapshot is **not authentic historical provenance**.

**Blockers:** Complete private original SQL archive, source and historical data/backfill review, correct parent schema timing, temporary-only migration tree, actual B3 Supabase Auth/RLS/finance replay and B4 subscription integration remain **not completed**. Hosted database/migrations/password/payments/subscriptions unchanged; 22 legacy agreements remain on auto-billing HOLD. Report: `PS_L2_3B_B3_1_HISTORICAL_ASSEMBLY_REVIEW_20261111.md`.

## PS-L2.3B B3.0 replay-readiness audit (11 November 2026)

**Source implemented:** Read-only local metadata analyzer `supabase/recovery/historical-baseline/b3_0_replay_readiness.py`, focused tests and GitHub CI checking seven explicit replay-readiness gates. **All gates are currently blocked**; a PASS in B3.0 CI means the blockers were reliably detected, not that the database migrated successfully.

**Important findings:** Four helper definitions overlap between the old 7-helper CI stub and verified B2.9 11-helper snapshot; the old `current_parent_id()` references `parents.user_id` before historical creation and uses `check_function_bodies = off`. Repo's migration history remains 40 local files against 82 remote versions with a duplicated `20260926133000` and an irregular 12-digit `202610210001_private_player_photo_storage.sql`. Six source divergences and 51 unmatched remote versions remain; current helpers are not authenticated historical source.

**Not yet tested:** Complete disposable Supabase Auth/RLS/finance migration replay, B4 candidate migration and real subscription lifecycle. Existing 22 legacy agreements remain HOLD for automatic billing; live Supabase data, migrations and credentials unchanged. See `PS_L2_3B_B3_0_SUPABASE_REPLAY_READINESS_20261111.md`.

## PS-L2.3B B2.9 verified current-state helper reconstruction (11 November 2026)

**Source implemented:** Test-only SQL snapshot/manifest of **11 live `private` authorization functions** with verified current SHA-256 hashes, exact source and grants. Separate synthetic setup, role-negative assertions and GitHub workflow run against PostgreSQL 17; existing canonical migrations and historic CI bootstrap **not modified**.

**Validation:** [GitHub Actions 42878988432](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42878988432) **PASS** — 5 integrity tests and synthetic PostgreSQL execution/authorization checks (Super Admin, Owner, Coach, foreign coach/academy denial, missing user context). This validates only the 11 current helper definitions, **not complete Supabase Auth, RLS, migration history or payment behavior**.

**Remaining gates:** 82 migration original provenance (especially 11 missing helper origins, 6 same-version SQL divergences, 51 remote without strict content match, local `20260926133000` collision), protected raw archive, B3 local Supabase replay and B4 real subscription integration. Existing 22 legacy subscription agreements remain on automatic billing HOLD; no live schema/data/credential change. See `PS_L2_3B_B2_9_CURRENT_AUTH_BOOTSTRAP_20261111.md`.

## PS-L2.3B B2.8 read-only live authorization audit (10 November 2026)

**Investigated via connected Supabase (SELECT only):** 11 foundational `private` authorization helpers all present, current definitions intact and unchanged versus prior 2026-11-09 SHA-256 inventory (11/11), `postgres`-owned, `SECURITY DEFINER`, `STABLE`, configured search paths. All referenced `public` tables originate in the first recorded schema migration. Seven helpers have direct live RLS-policy dependencies and four `can_access_*` helpers have no direct calls in scanned live policy/function definitions. Two role wrappers depend on `current_user_role`. A test-only helper reconstruction now has a source in the live catalog, **not an original historical provenance claim**.

**Migration differences clarified:** three same-version Sept 20 SQL files have matching lexical tokens, two historical player-batch data cleanups differ in quoted UUID values, and the initial schema token stream differs. No differences are yet approved as equivalent. Historical helper origins, full archive, B3 disposable replay and B4 subscription/finance/RLS integration remain **PENDING/BLOCKED**. No production data, schema, credentials, migrations or subscriptions changed. Detailed audit: `PS_L2_3B_B2_8_LIVE_AUTH_DEPENDENCY_AUDIT_20261110.md`.

## PS-L2.3B B2.7 private source archival readiness (10 November 2026)

**Implemented:** `run_verified_private_archive.py` and `attest_private_archive.py` verify all 82 migration identities and source SQL fingerprints before writing any private file, then create SHA-256-verified, Git-ignored SQL evidence and non-executing parity/risk reports. Archive traversal, duplicate-version and overwrite controls hardened. [Recovery CI 42751093715](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42751093715) **PASS — 43 tests**.

**Operational gate still pending:** Actual full original SQL private archive must be generated once by the owner on a trusted computer with a read-only-capable `psql` connection; connected Supabase cannot write directly to the owner's filesystem. This was **not completed** in this session. Do not claim B3 source replay or B4 Auth/RLS/finance parity.

**Original subscription lifecycle issue still open:** automated expiry, pause/resume, prorated billing, renewal and next-period payment-due creation not deployed. Legacy 22 agreements remain HOLD for auto-billing. All hosted schema, finance records and migration ledger unchanged. See `PS_L2_3B_B2_7_PRIVATE_ARCHIVE_READINESS_20261110.md`.

## PS-L2.3B B2.6 source inspection checkpoint (10 November 2026)

**Source review:** All 82 hosted migration SQL records inspected with SELECT-only queries, 168 recorded array elements segmented into 790 top-level statements by a non-executing lexer. Detected **11 migration records with 20 direct data-changing SQL statements**, and **7 with procedural DO blocks**; a previous 54-migration broad keyword screen was conservative. Historical player/parent reconciliations, payment counter and dues adjustments, and unfiltered enquiry backfills require distinct review. Metadata only was committed.

**Implemented/tested:** Offline `inspect_historical_statements.py`, 7 new tests, CI source-evidence checks and README. [GitHub Actions 42748372167](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42748372167) **PASS: 28 total recovery tests**.

**Unfinished:** Full privately archived original SQL export (not yet saved), six content-divergent migrations, 11 unproven foundational `private` helpers, timestamp mapping, disposable Supabase migration replay and actual subscription/finance/RLS parity. No hosted schema or financial data changed; existing 22 legacy subscription agreements remain HOLD for automatic billing. See `PS_L2_3B_B2_6_SOURCE_SQL_TRIAGE_20261110.md`.

## PS-L2.3B B2.5 recovery review checkpoint (10 November 2026)

**Implemented:** Comprehensive metadata-only 82-record recovery review queue, 11 unresolved helper origin gates, and a fail-closed non-executable `build_review_candidate.py` validator. [GitHub Actions 42744787611](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42744787611) **PASS — 21 focused tests** including generation of the blocked review plan from actual evidence.

**Stop condition:** Of 82 remote migrations, 25 strict Git content matches, 6 same-version SQL divergences, 51 without strict content linkage, 15 unmatched Git files, and a local `20260926133000` collision. Two same-version player-history reconciliations (`20260920041516`, `20260920041606`) differ in quoted literal SQL values. Do not replay historical cleanup without verified original statements and review.

**Pending:** Private full SQL export/sensitive-data inspection; provenance of 11 foundational `private` helpers; migration assembly sign-off; full disposable Supabase/Auth/RLS/financial replay; PS-L2.3 proposal local parity. Candidate is `ready_for_disposable_replay=false`; **no live schema/finance/billing changes**, and 22 historical agreements remain HOLD for automation. See `PS_L2_3B_B2_5_REVIEW_GATE_20261110.md`.

## PS-L2.3B B2.4 SQL parity checkpoint (9 November 2026)

**Source work:** Implemented offline historical migration content comparator, seven tests, README documentation and metadata-only `parity-fingerprints-readonly-20261109.json`. Recovery GitHub Actions [42615314401](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42615314401) **PASS (15 total tests)**.

**Live read-only SQL parity:** 82 remote ledger versions / 40 Git SQL files. 17 byte-exact + 6 trailing-LF + 2 leading-LF matches = **25 strict content matches** (8 verified retimestamped). 6 same-version content discrepancies, 51 unmatched remote migrations and 15 unmatched Git files still require review. Two Git files share migration version `20260926133000`.

**Security gate:** Full quarantined historical SQL export and original baseline helper provenance (11 functions) unresolved. No clean disposable Supabase replay or actual subscription/finance/RLS integration PASS. PS-L2.3 proposal remains unapplied, legacy 22 subscription agreements remain HOLD for automated billing, and hosted data/schema remain unchanged. Detailed report: `PS_L2_3B_B2_4_SQL_CONTENT_PARITY_20261109.md`. Next B2.5 source review; no production migration approval granted.

## PS-L2.3B B2.3/B2.4 audit update (9 November 2026)

**Implemented and tested:** Offline `analyze_replay_dependencies.py` and four new tests (8 total recovery tests green in [GitHub Actions 42610773284](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42610773284) at `acb03aa2`). Quarantined statement input only; no hosted SQL changes.

**Critical finding:** No stored historical migration explicitly creates the `private` schema or foundational `current_user_role()` / `is_super_admin()` functions. The deployed functions exist, but their historical source provenance is unresolved; `parents.user_id` was added in version `20260912142706`. The current migration history **cannot yet reconstruct itself**.

**Outstanding:** Full raw SQL quarantine/export, content comparison, 11 helper provenance findings, timestamp collision resolution, fresh Supabase replay, real role/finance tests, Owner acceptance. Existing PS-L2.3 proposal stays **unapplied** and all 22 legacy subscriptions stay HOLD.

## Current PS-L2.3B milestone — recovery evidence tooling (9 November 2026)

**Source implemented:** `supabase/recovery/historical-baseline/` contains read-only SQL export tooling, tests, quarantine controls, documentation and an 82-record **metadata-only** historical migration inventory. GitHub branch `payment-module-finalization`; no new active migration, payment writes or schema modification.

**Verification:** Four exporter integrity tests passed locally; focused recovery CI [42609954991](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42609954991) **PASSED** at `ed2eb184`. Exporter has not performed the full database-history SQL export. There is no clean Supabase replay or real Auth/RLS/payment integration PASS. Historical provenance remains unresolved for 11 foundational private helpers and local timestamp collision `20260926133000`.

**Next:** B2.3 sensitive-data-reviewed evidence extraction and helper/version reconciliation, then B2.4 dependency-safe replay preparation. **Do not promote PS-L2.3 to production or remove legacy subscription HOLD.**

## Latest PS-L2.3 staging-readiness gate — BLOCKED by incomplete historical migration replay (6 November 2026)

**Implemented:** Local-only Supabase CLI CI workflow and test-only authorization bootstrap/parity script; no production migrations or app code changed. [Local replay run 42204705752](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42204705752) **FAIL** before installing proposed PS-L2.3 schema: historic `private` authorization helpers are absent from repository's self-contained baseline; the earlier two runs exposed missing `private` schema and parent-column ordering. These private helpers exist in the live project but their migration lineage is incomplete in Git. **Do not mark real Supabase integration validated.**

**Still passed:** Synthetic PostgreSQL 17 candidate suite [run 42195789707](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42195789707). **Still pending:** PS-L2.3B historical migration baseline reconstruction, authentic Supabase RLS/trigger/tenant tests and separate Owner sign-off for any live migration. No hosted database modifications. Full blocker record: `PLAYER_SUBSCRIPTIONS_PS_L2_3_LOCAL_REPLAY_GAP_20261106.md`.

## Latest implementation checkpoint — PS-L2.3 isolated tuition schema candidate (6 November 2026)

**Source implemented (unapplied):** Created `supabase/proposals/subscriptions/ps_l2_3_foundation.sql` with academy billing policy versions, additive locked-price/renewal-HOLD agreement fields, period ledger, append-only events, nullable period-to-due key, tenant/event identity constraints, GiST **cross-agreement regular-tuition overlap exclusion**, and RLS read access scoped to Owner/SA/linked Parent. Original direct create/edit forms remain unchanged; new contract activation fields are guarded against old UI writes. No renewal/payment RPC or jobs.

**Automated validation:** Disposable GitHub Actions PostgreSQL 17 [CI run 42195789707](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42195789707) on `5afae2a` **PASS** for synthetic legacy preservation/HOLD, negative cross-agreement dates and tenant cases, wrong due/event keys, append-only audit, idempotency uniqueness, RLS permissions and role isolation. This **does not** validate complete live Supabase Auth/RLS/payment triggers, transaction renewal concurrency or financial collection. No frontend Jest/build required/run for schema-only changes.

**Live Supabase unchanged:** Postcommit SELECT-only snapshot: 22 subscriptions, 26 dues, 42 payment rows, no new three PS-L2.3 tables and no `payment_dues.subscription_period_id` in live schema. No financial mutations or migrations applied. **Camp fee policy also approved:** Owner chooses free, included in tuition or separately chargeable for each camp; no camp module/fees implemented.

**Pending:** Real isolated Supabase migration parity and security review, separately approved live DDL, existing financial cascade/privilege hardening, PS-L0B Owner reconciliation, and future atomic lifecycle RPCs/fee integration. Detailed report: `PLAYER_SUBSCRIPTIONS_PS_L2_3_ISOLATED_CANDIDATE_20261106.md`.

## Latest Owner decision checkpoint — PS-L2.2 D1–D7 (6 November 2026)

**Owner D1–D7 APPROVED 6 November 2026:** Only one date-effective **regular tuition** entitlement per player/academy, regardless of whether a monthly/quarterly period belongs to a different subscription agreement. Special camps (e.g., Diwali) may run simultaneously as **separate nonrecurring programme enrolments**, optionally linked to the existing agreement; their pricing/free/included policy is **undecided** and camp implementation is separate. Scheduled-session proration is academy default with calendar-day option; only Owner-approved holidays/cancellations affect session counts; existing agreement prices/cycles/alignment stay fixed except prospective Owner change; zero-eligible-session fee deferred/manual exception; Coach Paused roster-only; financial cascade/privilege fixes independently approved for execution. **Business rules approved, no SQL/app migration authorized.** See `PLAYER_SUBSCRIPTIONS_PS_L2_2_OWNER_DECISIONS_20261106.md`.

**Implementation:** No app, database or payment changes, tests or browser acceptance in this documentation phase. All legacy agreements remain HOLD; PS-L2.3 is unapplied design/tests only.

## Latest design checkpoint — PS-L2.2 schema, RLS, atomic billing proposal (6 November 2026)

**Proposed only:** Field-level academy policy, agreement rate/HOLD, subscription periods, append-only events and nullable per-period due link. Documented UNIQUE/index/overlap rules; role-specific RLS plus GRANT matrix; guarded PostgreSQL Create/Renew/Extend/Pause/Resume/Reprice transaction with row locking, exact paise and idempotency; cascade and TRUNCATE hardening, non-destructive rollback and isolated testing plan.

**Actual state:** No database DDL, migration, RLS changes, RPC/React writes or generated dues. No runtime tests for this design-only task. 22 legacy records still require Owner reconciliation. PS-L1P2 preview and historical dues unchanged. **Next:** Owner design/policy sign-off before PS-L2.3 unapplied migration candidate. See `PLAYER_SUBSCRIPTIONS_PS_L2_2_SCHEMA_SECURITY_TRANSACTIONS_20261106.md`.

## Latest architecture checkpoint — PS-L2.1 reviewed (6 November 2026)

**Read-only inspected:** Existing subscriptions, plans, dues, payments, corrections, Parent UPI and schedule relationships; associated React create/update/deactivation, financial RPC/trigger, RLS policies, database grants and FKs. **Proposed, not implemented:** durable agreement -> multiple billing periods -> one new pending tuition due per period; approved rate/price/proration snapshot; immutable extension/pause/resume/reprice history; academy billing configuration.

**Risks:** Current subscription-to-due and due-to-payment cascade-delete FKs must be protected; financial tables have broad grants including TRUNCATE requiring separate least-privilege audit, though no direct UI exploit is established. Role Matrix Coach subscription read differs from live RLS. Fresh data now has 3 academy mismatches vs 4 historical; all 22 legacy end dates remain NULL. No approved legacy activation.

**Status:** PS-L2.1 review documented, **zero database/app/financial changes** and no new automated tests to run. Next PS-L2.2 proposed schema/constraints/RLS/transaction/rollback design, then separate Owner approval before migration. See PLAYER_SUBSCRIPTIONS_PS_L2_1_ARCHITECTURE_REVIEW_20261106.md.

## Latest implementation checkpoint — PS-L1P2 read-only fee preview (6 November 2026)

**Implemented:** First-period fee preview for a selected player and monthly plan on the management **Player Subscriptions** page, using a separate `SubscriptionFeePreview.js` component. The Owner/Super Admin must explicitly choose the preview-only monthly model (fixed calendar or anniversary). Fixed-month previews require an explicit method (scheduled training sessions or calendar days). Displays first-period dates, next renewal date, source recurring Plan.amount, ratio, discount and estimated first-period amount. Responsive CSS and accessible form labels added.

**Read-only behavior:** Existing `getPlayerScheduleEnrollments` provides academy/player/batch-scoped active training schedules and enrollment dates; the preview further checks active flags and tenant/batch/center consistency and fails closed if no suitable assignments. Player/plan academy mismatch blocks calculation. No holidays/cancellations are excluded. The page explicitly warns that **Create subscription does not save calculated end dates, billing model, discount or dues**. Original subscription create/edit/deactivate, duplicate-active prevention, seven-per-page listing and financial queries are untouched. No DB/RLS/migration/academy-setting/payment changes.

**Automated tested:** [Subscriptions CI 42169267470](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42169267470) at `7e0ddb4` passed **203/203 targeted tests** (10 new preview, 4 Player Subscriptions, 18 workspace, 24 Sidebar, 86 PS-L1, 61 PS-L1P1) and **React production build**. Separate [full frontend run 42169267502](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42169267502) still fails 16/490 in four unrelated Coach Profile/Player Performance suites.

**Pending:** Manual Academy Owner/Super Admin desktop/mobile acceptance, real authorized schedule and negative-RLS browser scenarios; academy billing-method policy/default, holiday/cancellation handling, PS-L0B Owner review, price/period/dues persistence and PS-L2 proposal-only schema design. See `PLAYER_SUBSCRIPTIONS_PS_L1P2_PREVIEW_20261106.md`.

## Latest implementation checkpoint — PS-L1P1 pure monthly proration calculator (6 November 2026)

**Owner-approved product rule:** Both `fixed_calendar_month` and `anniversary_month` billing models, to be configured by academy. First partial fixed-calendar periods may use proration; anniversary-based periods retain full rolling-month entitlement. Fixed-month method is explicit per quote; no default method/holiday policy finalized.

**Implemented source:** New pure `subscriptionProration.js` and 61 Jest tests. Integer-paise half-up pricing; inclusive day ratio or actual scheduled-session ratio using ISO weekdays, distinct session IDs, player enrollment dates and optional approved exclusions. Zero eligible sessions produces review flag, **not** automatic billing. Full recurring contracted price remains separate from the initial prorated fee.

**Focused CI validated:** [Run 42167075145](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42167075145) at `00eb8d3`: **61/61 new + 86/86 lifecycle + 45/45 Subscriptions regressions = 192/192 tests; React production build PASS.** Full application [run 42167075109](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42167075109) still **FAIL 16/479** in unrelated Coach Profile/Player Performance suites.

**Boundary:** No academy configuration, quote UI, period price snapshot, Supabase schema/RLS, payment due, scheduler or financial data write. 22 legacy subscription records remain held for PS-L0B Owner reconciliation. Next phase PS-L1P2 preview/data-scope design and PS-L2 proposal-only billing schema. Handoff: `PLAYER_SUBSCRIPTIONS_PS_L1P1_PRORATION_20261106.md`.

## Latest planning checkpoint — PS-L1P mid-cycle proration design (6 November 2026)

**New requested behavior:** A child joining a monthly plan during January should be charged fairly for a partial fixed calendar month, potentially by the remaining scheduled Mon/Wed/Fri sessions. **No business logic or database implemented yet:** calendar alignment is not the same as existing PS-L1 rolling-anniversary periods. Recommend academy-configurable fixed/anniversary alignment and schedule-based first-month quote for fixed-month billing; await Owner decision. January 2027 verified 13 Mon/Wed/Fri sessions, seven from the 15th (INR 1,500 example: INR 807.69); daily method 17/31 = INR 822.58. Source tables `batch_schedules` and `player_batch_schedules` support schedule/enrollment discovery but there is no holiday/cancellation ledger. Plan fee vs actual due amount requires future PS-L2 period price snapshot. **No code/SQL/billing changes in this checkpoint.** See `PLAYER_SUBSCRIPTIONS_PRORATION_PROPOSAL_20261106.md`.

## Prior checkpoint — PS-L1 calendar/extension/pause calculator (6 November 2026)

**Implemented:** `frontend/src/utils/subscriptionLifecycleDates.js` contains pure date-only helpers for calendar cycles `monthly/quarterly/half_yearly/yearly`, inclusive validity periods, preserved 29/30/31 anniversary anchors, vacation-day end-date extensions, verified paid days frozen at pause and restoration after resume. Future renewal anniversary rebaselining occurs only after an adjustment, not a normal February-clamped renewal. No browser/React/DB imports.

**Focused validation PASSED:** On source commit `387e1210`, [Subscriptions run 42163864483](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42163864483) passed **86 lifecycle tests, 45 workspace/sidebar/Player Subscriptions tests = 131/131, and production React build**. The separate full-frontend [run 42163864482](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42163864482) failed **16/418 cases (4/45 suites)** in Coach Profile/Player Performance, unrelated to PS-L1.

**Boundary:** The helper is **not wired** to Player Subscriptions form or Subscription Plans, Attendance, Parent Portal, Payment Dues or database. No end dates were written; no RLS/policy, migration, scheduler, subscription, due or collection mutation. Owner PS-L0B per-record agreement/reprice/paid-through/activation approval is **still pending**; 22 historical subscriptions remain excluded from automatic billing. No UI acceptance applies to this helper-only phase. Next technical phase PS-L2 **draft schema/RLS/idempotency design, not migration**. See `PLAYER_SUBSCRIPTIONS_PS_L1_CALCULATOR_20261106.md`.

## Prior checkpoint — PS-L0B reconciliation + contracted-price policy (6 November 2026)

**Confirmed financial policy:** Original agreed recurring subscription price remains locked for an enrolled player until Academy Owner explicitly approves a **future-only** price change. No historic contracted price snapshot exists in the database; current plan amount and historic due amounts cannot independently establish original agreement terms. Contract updated to v1.1, no application migration.

**Read-only PS-L0B completed:** 22 active subscriptions, all missing end dates, with 26 linked dues (19 Paid, 4 Partial, 3 Pending). Identified **four academy mismatches, four players holding two active subscriptions (eight subscription rows), one inactive player with an Active subscription, five subscriptions without dues and ten Paid dues with no directly linked payments row**. A pseudonymized per-subscription matrix separates ten P0 integrity, one P1 no-due-only and eleven P2 standard evidence-review cases. No row has a verified paid-through date or original contracted price, so **none is eligible for automatic renewal**.

**Deliverable:** `PLAYER_SUBSCRIPTIONS_PS_L0B_RECONCILIATION_20261106.md` with all 22 pseudonymous audit references, risk flags, due-status counts and a **SELECT-only private identification query**. Names, raw UUIDs, amounts, transaction references and receipt numbers were not committed. Source review is complete; Owner per-row corrective and activation decisions are **PENDING**. No subscription, payment, RLS, SQL migration, Cron or app-source changes.

**Next independent implementation:** PS-L1 pure calendar-month validity / free extension / pause-and-resume calculations and comprehensive Jest edge tests, after reviewing the date contract. Do not deploy scheduled renewal or create future dues until the separate schema/payment approval and legacy reconciliation acceptance.

## Prior checkpoint — Player Subscriptions PS-L0A lifecycle contract (6 November 2026)

**Approved business rules, planning only:** 1/3/6/12-month calendar validity, Owner-approved vacation extension, automatic renewal with one pending payment due per prospective period, freeze/resume unused paid calendar days, retain paused players in Coach attendance roster, and reconcile all legacy rows before any new billing. Preserve existing financial ledger, payment collection and receipts.

**Source-of-truth review:** Latest branch `cdd029d`. Live read-only inspection found 22 active subscriptions with null end dates, four cross-academy player/plan associations (six linked dues, five paid/partial), and one active subscription for an inactive player. No safe algorithm can infer current paid-through dates from old start dates alone. No Cron scheduler has been deployed.

**Architecture plan:** Keep the stable `player_subscriptions.id` referenced by `payment_dues`; introduce a period/history ledger, adjustment events, transaction-level duplicate guards and RLS only after the separate schema approval. Avoid retroactive generated dues and hold mismatched/inactive/unknown-paid-through subscriptions out of automated renewal until Owner review. **No implementation or database changes occurred in this checkpoint.**

**Immediate next safe phase:** PS-L0B anonymized, read-only legacy reconciliation matrix, including linked payment evidence and Owner decisions on prospective activation dates. PS-L1 later develops a pure date-calculation utility and edge-case tests, without database changes. Pending billing price-change policy before automatic due generation. See `PLAYER_SUBSCRIPTIONS_LIFECYCLE_CONTRACT_20261106.md`.

## Prior checkpoint — Player Subscriptions PS1 (6 November 2026)


**Scope:** Independently optimize Player Subscriptions after Owner accepted the consolidated navigation direction. Subscription Plans remain an independent module and have not been redesigned.

**PS1 source implemented:** Compact owner Academy/Center/Batch scope toolbar (academy shown as read-only context); reduced duplicate assignment heading, denser field alignment and selection summary; conditional **Clear form** while composing an assignment, using the existing form reset; existing **Cancel edit** remains. Subscription count label now says *matching* for filtered results. Original Player/Plan/Start date selections, Create/Update/Deactivate, duplicate-active warning, status/column filters, seven-record pagination, Supabase queries and access control are unchanged.

**Automated validation:** At `92f28d8`, [focused CI 42154238168](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42154238168) **PASS: 45/45 tests across 5 suites and React production build** (18 workspace, 24 Sidebar, 3 new Player Subscriptions). Full-app [Phase 7.5 run 42154238060](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42154238060) **FAIL: 16/332 tests across four Coach Profile/Player Performance suites**, separate regression. No database schema/RLS/migration changes or business-data writes.

**Pending:** Owner/Super Admin actual browser, responsive 320–1440px and controlled assignment/Edit/Deactivate/filters regression. PS2 mobile record details and actions planned as separate phase. **Subscription Plans UX phase not started.** See `PLAYER_SUBSCRIPTIONS_PS1_20261106.md`.

## Prior checkpoint — Subscriptions SM1–SM3 (6 November 2026)

**Intent:** Academy Owner requested one combined Subscriptions navigation/workspace, like Attendance, before later independent improvements to the two management modules.

**Implemented:** Shared `SubscriptionsWorkspace.js` and link-based `SubscriptionsWorkspaceTabs.js` / CSS. Finance sidebar now has a single **Subscriptions** entry for Super Admin and Academy Owner. The canonical URLs are `/subscriptions?view=players` (default Player Subscriptions) and `/subscriptions?view=plans`. Old `/player-subscriptions` and `/subscription-plans` URLs retain protected redirects, additional query params and hash. The legacy components are still rendered intact, including their independent Layouts, queries, mutation functions and original pagination (7 player subscriptions / 5 plans). The tab cards warn when switching away from a populated/edited form; unrelated browser navigation is not fully guarded.

**Data and security:** No changes to Supabase, role matrix, RLS or business records. Super Admin/Academy Owner management remains behind the original ProtectedRoute roles and existing database policies. Coach/Parent management routes continue to deny access. The existing duplicate-active subscription UI check remains unchanged; no new database uniqueness or transaction guarantee is implied.

**Validation:** [Subscriptions CI run 42153066796](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42153066796) at `da0cdb55`: **18/18 workspace tests and 24/24 Sidebar tests passed; React production build passed**. The Attendance scoped workflow at initial code commit `0fc4165e` also passed. The full app Jest at `0fc4165e` remains **FAIL 4/43 suites, 16/329 tests** for Coach Profile / Player Performance, outside SM2–SM3.

**Acceptance:** Browser UI, small-screen responsive behavior, plan CRUD, subscription assignment/edit/deactivation, old bookmarks, save state across view switches and authorized role/tenant negative tests are **pending**. No production release sign-off claimed. Next: Owner verifies the merged navigation; then separate UX phases for Player Subscriptions and Subscription Plans. See `SUBSCRIPTIONS_SM1_SM3_WORKSPACE_20261106.md`.

## Prior checkpoint — Attendance AM7.3 completed in source (6 November 2026)

**Owner acceptance:** AM7.1–AM7.2 visual changes were confirmed acceptable. Owner requested completing remaining AM7.3, which is implemented and focused-CI validated. This is **not** confirmation of AM7.3 manual browser or production security acceptance.

**History scalability:** A separate `services/attendanceHistoryService.js` now retrieves only the requested five records with a server-side **exact filtered count**. The service preserves authorized batch-ID-based Center filtering for legacy attendance with null `center_id`, selected Academy/Batch/Status/From/To constraints, and uses a debounced **Player name search** with an inner `players` relationship so matches can be found beyond the current page. The former Player ID dropdown and fetch-all/client-side slicing are removed from History. Rows have stable date-descending, ID-descending ordering; invalid/empty center scopes avoid widening the query; database remains the final RBAC/RLS boundary. After edits or soft deletion, the page is refreshed and clamps to the final existing page when necessary.

**Automated validated:** Source at `98cb6cb1` after commits `8c2b7b95`, `bbdc7731`, `85b927ab`, `ccbe95b9`, `98cb6cb1`. GitHub Actions [Attendance run 42150812932](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42150812932) **PASS: 11/11 suites, 98/98 Jest tests and React production build**. Active Supabase read-only checks confirmed schema, RLS policies, queryable join columns, and five-row pagination at current modest dataset volumes. There was **no live authenticated browser or cross-tenant negative-RLS test**. Full-app Jest at the same SHA remains **FAIL: 4/41 suites, 16/304 tests** in Coach Profile/Player Performance.

**Development closure versus release gate:** All scoped AM7 implementation phases **completed in source and focused-automated-tested**. AM7.1–AM7.2 Owner visual acceptance completed. AM7.3 live browser/role/multi-tenant, high-volume load and Vercel production verification remain unverified; do **not** claim full production release readiness. No Supabase schema migration, SQL writes, policy change, RLS bypass, RPC or modified attendance insert/update/delete behavior.

## Prior checkpoint — Attendance AM7.1–AM7.2 (6 November 2026)

**Implementation:** Optimized `AttendanceHistory.js` and CSS: removed redundant tall History/Records headings, compacted the filter toolbar (Academy selection only for Super Admin; Owner/Coach see scoped academy context), retained Center/Batch/Player/Status/From-To and Reset, and compacted the records counter. On tablet/mobile, the 8-column table rows render as responsive cards showing all fields — including previously hidden Status, Marked By and session details — plus authorized per-record actions. Existing `formatAttendanceSessionLabel` provides weekday and 12-hour time for available schedule records. Legacy attendance fallback remains.

**Preserved:** Same read-only Supabase `attendance` query, server-applied academy/batch/center/date filters, client-side Player/Status filters and five-record pagination; `updateAttendanceStatus`, `softDeleteAttendance`, Coach UTC seven-calendar-date restrictions and RLS/authorization remain unchanged. No database migrations, policies, RPCs, new privileges or attendance record mutations were made.

**Automated validation:** GitHub commits `226cd33` and `c5e9f9e`; [AM1–AM7 run 42148002910](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42148002910) on `c5e9f9e` **PASSED 10/10 focused Jest suites, 86/86 tests and React production build**. Full application Jest still **FAILED 4/40 suites, 16/292 tests**, confined to Coach Profile and Player Performance; track outside AM7. AM6 visual change approval preceded this phase, not full security/release sign-off.

**Still pending:** Owner/Coach/Admin/Parent browser/regression, 320/375/430/768/1440px visual accessibility review, edit/delete/filters/legacy/deep-link controlled fixture behavior and negative RLS testing. AM7.3 history dataset-scale review (current fetch-all + client pagination) is separate and not implemented. See `ATTENDANCE_AM7_HISTORY_UX_20261106.md`.

## Prior checkpoint — Attendance AM6.6 (5 November 2026)

**Source implemented:** Removed the large Daily Operations header blocks and abbreviated the roster headings in both Academy Owner and Coach Mark Attendance. Academy Owner's four-filter area now shows the selected batch's **recurring active weekdays** (e.g. Runs: Mon · Wed · Fri) from a separate read-only `batch_schedules` query scoped by batch/center; the date-scoped session and roster queries are unchanged. Coach Assigned Session dropdown and its compact context line now make **batch, center, weekday and 12-hour start/end** explicit. Existing marked/recorded/save labels and actions are preserved.

**Verification:** Source at `b97b58c`, follow-up accessibility-test/CI fixes at `a546615d` and `728652df`. The scoped Attendance GitHub Actions run [41962962698](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/41962962698) passed **10/10 Jest suites, 82/82 tests and React production build** at `728652df`. The full frontend suite at the same SHA failed **4/40 suites, 16/288 tests**, all in Coach Profile / Player Performance tests; track independently, not as Attendance test failures.

**Manual/release gate open:** No Owner/Coach screenshot or browser acceptance, phone/tablet/desktop review, direct negative role/tenant/RLS execution, or production release verification recorded for AM6.6. **AM7 History UX remains planned.** No database migration, attendance mutation service, RLS/RPC, Auth or role-matrix change.

## Prior checkpoint — Attendance AM6.1–AM6.5 (5 November 2026)

**AM6 daily marking UX — implemented:** Owner `Attendance.js` now shows selected academy as text context (no redundant disabled academy dropdown), with compact **Center → Batch → Date → Session** filters and 12-hour weekday/session labels. Coach `CoachAttendance.js` retains Date/Assigned Session filters, also with 12-hour session presentation. Both workflows share `AttendanceRosterSummary.js`: one compact live Total/Present/Absent/Unmarked strip above their player roster, removing the oversized/repeated totals cards. The action bar communicates unmarked count/readiness rather than repeating totals.

**Marking and save behavior:** Original P/A radio inputs are retained with larger accessible 44px targets, distinct green/red selected chips, clear status text and responsive player-name wrapping. Mark All/Reset remain unsaved drafts. Owner Save is blocked until roster/session ready and all players marked; previously recorded attendance remains read-only and directed to History for corrections. Coach Reset restores fetched existing P/A status (or clears new unsaved marks); Update/Save is blocked until fully marked and still respects the existing seven-calendar-date edit window. Current Supabase insert/update service methods are unchanged.

**Responsive / validation:** `Attendance.css` now supports four Owner filter columns on desktop, two on tablet and one on narrow phones, compact roster totals and responsive action/footer controls. `attendancePresentation.test.js` contains 5 authored display/tally tests; Owner page has 3 new AM6 tests, Coach page has 3 new AM6 tests and its existing gating expectation was updated. AM1–AM6 scoped GitHub Actions workflow includes new tests and production React build. **No exact-HEAD Jest/build, live browser/viewport/role acceptance or deployment release gate is confirmed** at this checkpoint. No database/schema, RLS, RPC, permissions or Attendance History changes. See `ATTENDANCE_AM6_MARK_UX_20261105.md` and repository root `DEVELOPMENT_CONTINUITY.md`.

## Prior checkpoint — Attendance AM5 (5 November 2026)

**AM5 canonical routing — implemented in GitHub:** `frontend/src/pages/AttendanceWorkspace.js` routes all authorized staff through `/attendance?view=mark|history`, mounting the unchanged Owner Mark, Coach assigned-session Mark, or History component based on the authenticated database role. Academy Owner and Coach default to Mark; Super Admin is history-only; Parent retains no attendance management permission. Invalid/missing `view` is normalized with replace navigation. Existing `/coach-attendance` and `/attendance-history` URLs retain their original role guards and redirect to the canonical workspace while preserving query parameters and hash.

**Navigation/deep links:** One Attendance sidebar entry and shared view cards now target canonical links. Coach Dashboard and Academy Owner Dashboard now include `view=mark` without losing schedule/date/batch or center/batch context; generic Dashboard metrics go to `view=history`, while its quick action offers Mark only to Owner and History to Super Admin.

**AM5 regression/CI:** Added actual `ProtectedRoute` + `AttendanceWorkspace` routing tests for role defaults, Super Admin Mark denial, Parent/direct-route denial, legacy redirects with query/hash, invalid view values, and Coach/Owner component selection. Updated sidebar, selector and page link tests. The existing Attendance GitHub Actions workflow now covers AM1–AM5 tests and runs `npm ci` plus a React production build. Source review and diff checks are available, but **no confirmed exact-HEAD Jest pass, full-build result, user mobile/browser role acceptance or live negative RLS regression** has been recorded. **AM5 is not release-signed-off.**

**Boundaries:** No changes to attendance INSERT/UPDATE/soft-delete services, data-scope helpers, `ROLE_MATRIX.md`, database schema, RLS policies or RPCs. Original Coach per-row update remains non-transactional. AM6 and AM7 are separate pending UX optimization phases. Detailed checkpoint: `ATTENDANCE_AM5_ROUTING_20261105.md`; architecture `PROJECT_ARCHITECTURE.md`; root `DEVELOPMENT_CONTINUITY.md`.

## Prior checkpoint — Attendance AM2–AM4 (5 November 2026)

**AM2 Owner/Admin marking — implemented:** Academy Owner keeps current batch/session/date filters and save path. Direct Super Admin `/attendance` is redirected to `/attendance-history` after authenticated user load, with Owner-only mark/save guards and UTC future-date prevention. No route removal; Owner dashboard query parameters remain intact.

**AM3 Coach marking — implemented:** Original `/coach-attendance` session/date/batch deep links and insert/update remain. Roster loads only after an assigned session is verified. Existing attendance older than the UTC seven-calendar-date RLS edit window is shown read-only with disabled actions and save-time guards. Update requests detect zero permitted rows instead of reporting blanket success. Existing non-transactional per-row updates remain, so partial-update errors require manual review.

**AM4 History — implemented:** Existing filters, five-per-page pagination, soft deletion and role-scoped query remain. Coach old-record Edit is hidden and replaced with Read-only; new `attendanceEditWindow.js` helper matches verified live Supabase `CURRENT_DATE-6`.. `CURRENT_DATE` in UTC and is checked again on save. Academy Owner and Super Admin retain historical Edit/Delete. Shared `updateAttendanceStatus` now rejects silently denied zero-row updates.

**Validation:** Live attendance RLS policies/function and database timezone were inspected **read-only**; no data changes, migrations, RLS/RPC, auth or relationship modifications. **22 AM2–AM4 cases + 18 AM1 navigation cases = 40 authored test cases**, and the existing Attendance CI workflow was extended to cover these plus the React production build. **No confirmed exact-HEAD Jest pass, build result, deployment, manual browser acceptance or negative RLS audit** as of this checkpoint. User plans to review AM2–AM4 together. See `ATTENDANCE_AM2_AM4_20261105.md` and root `DEVELOPMENT_CONTINUITY.md`.

## Prior checkpoint — Attendance AM1 (5 November 2026)

**Attendance workspace (AM1 implemented):** Added a single role-aware **Attendance** sidebar entry and compact Mark Attendance / Attendance History selection cards across the **existing** `Attendance.js`, `CoachAttendance.js` and `AttendanceHistory.js` pages. Academy Owner Mark -> `/attendance`; Coach Mark -> `/coach-attendance`; Super Admin sees **History only** -> `/attendance-history`; Parent remains excluded from attendance management. Current routes, guards, dashboard deep-link query parameters, marking/saving, History filters and edit/soft-delete code remain unchanged. New `AttendanceWorkspaceTabs.js`/CSS, selector/sidebar Jest tests and focused GitHub Actions workflow are committed; **tests authored, not executed**, latest-head build/role/mobile acceptance **pending**. Known deferred scope: AM2 Super Admin direct marking page mismatch versus live INSERT RLS; AM4 Coach History edit-button visibility older than 7 days; AM5 canonical route migration/legacy compatibility. No schema, RLS, RPC or permission change. See `ATTENDANCE_AM1_WORKSPACE_20261105.md` and root `DEVELOPMENT_CONTINUITY.md`.

## Prior development checkpoint — Kheltriva (3 November 2026)

**Coaches & Assignments:** CMA1–CMA4 and CMA6 UI changes are implemented, including one Coaches sidebar entry, selection cards, compact forms, session chips and mobile actions. CMA5 source/test authoring is recorded; runtime regression and manual acceptance remain pending. See `COACHES_CMA5_REGRESSION_AND_ISSUES_20261103.md` and the repository-root `DEVELOPMENT_CONTINUITY.md`.

**Coach Profile:** CP1–CP3 compacted the header, removed stretched Training Scope whitespace, placed Certifications beneath training and collapsed the certificate editor. CP4 added keyboard focus/accessibility and viewport-specific layout refinements. CP5 updated/expanded the existing `CoachProfile.test.js` suite to 12 authored tests, alongside a role/viewport regression checklist. **Neither current-head Jest/build nor role/browser acceptance has been verified here.** See `COACH_PROFILE_CP1_CP3_20261103.md` and `COACH_PROFILE_CP4_CP5_20261103.md`.

**Player Performance (PM1–PM4 and PM5 preparation):** Super Admin, Academy Owner and Coach share `Player Performance`; Parent remains report-only. PM2 provides scoped report auto-selection/deep links; PM3 supplies the collapsed nine-skill assessment editor; PM3.1A–E adds role-aware Center/Batch/Assessment Status player filtering and 25-result pagination (**visually accepted; development closed**). **PM4 implemented:** cross-page mobile/overflow/focus refinements, keyboard player-picker option navigation, reduced-motion support, Parent screen-reader Report heading, and named report charts with exact text-based trend values. **PM5 prepared:** 14 Assessments and six Report authored component tests alongside prior navigation/utility tests and a focused cross-role regression matrix. Current-HEAD Jest/build, Vercel deployment and Owner/Coach/Admin/Parent browser/RLS acceptance are **pending**, NOT confirmed passed. No database migrations, RLS/RPC, RBAC or scoring-contract changes. See `PERFORMANCE_PM4_PM5_REGRESSION_20261103.md`, earlier PM1–PM3.1 documentation and root `DEVELOPMENT_CONTINUITY.md`.

**Player Profile (PP1–PP5 source):** PP1–PP4 compact profile identity, Player/Parent contact cards, weekly training and overall attendance/fee snapshots, plus a staff-only Performance deep link remain implemented inside `Players.js`. **PP5 implemented** the existing dialog's keyboard focus containment/Escape handling/focus restoration, nested row-action keyboard protection, narrow-screen wrapping/touch-target/reduced-motion styling, and **8 authored component regression cases** across Owner/Coach/Admin, deep link, empty/error states and keyboard behavior; **5 existing presentation helper tests** are retained. Dedicated `.github/workflows/player-profile-validation.yml` installs locked dependencies, runs scoped Jest and builds React. **No confirmed current-HEAD Jest pass, user/browser/viewport acceptance, Vercel release gate or live negative RLS regression** has been recorded. Parent remains denied by existing Players management routing; Owner-only header actions and Coach fee restrictions preserved. No business-data, RLS/RPC or photo-service changes. See `PLAYER_PROFILE_PP5_REGRESSION_20261104.md`, `PLAYER_PROFILE_PP1_PP4_20261103.md` and root `DEVELOPMENT_CONTINUITY.md`.

**Player Photos (PH1 and PH3; 4 November 2026):** Browser-side player photo optimization is implemented in `utils/playerPhotoOptimization.js` and wired at the existing `playerPhotoService.js` upload boundary. JPG/PNG/WebP originals up to 10 MB are resized to a maximum 512px longest edge and progressively converted to WebP (target <=100 KiB; hard max 150 KiB) **before** the private Storage upload. Both Player Profile and Edit Player now describe the accepted original and optimized storage limits. The existing academy/player scope, private signed URLs, rollback of newly uploaded files and older JPG/PNG paths are retained. Seven optimizer and five service tests are **authored, not executed**; current-head build and controlled browser/Storage verification **pending**. Supabase private bucket remains at its existing 2 MiB cap; **no bucket config, migration, RLS, RPC or old-object deletion**. At the PH1/PH3 checkpoint replacement cleanup was deferred; PH4 has since been implemented (see PH4/PH5 entry). Bucket-level enforcement remains a separate decision. See `PLAYER_PHOTO_PH1_PH3_20261104.md` and repository-root `DEVELOPMENT_CONTINUITY.md`.

**Player Photos (PH4 and PH5; 4 November 2026):** Live Supabase read-only check confirmed a test player's approximately 5 MB original photo was stored as **27,982 bytes of WebP**. Private `player-photos` bucket contained three objects, including one older unreferenced PNG. Storage Owner DELETE and player RLS policies were inspected; **no live data, bucket policy or RLS modifications were made**. PH4 now performs conditional player/academy/previous-path compare-and-set updates, verifies DB references, and only then removes the previous same-player/academy photo through the Storage API. Concurrency conflicts and ambiguous update errors avoid deleting a potentially active file. Cleanup errors do not undo a successful photo replacement; both upload surfaces show nonfatal warnings. **PH5:** 7 optimizer, 4 cleanup-guard, and 14 service Jest cases authored (**25 total, not executed**). Latest-head build/Jest, controlled owner upload/replace test, cross-role RLS verification and deployment acceptance **remain pending**. Existing 2 MiB bucket limit unchanged; a tighter 256 KiB server-side cap is a separate consideration, not applied. Historical orphan was retained. See `PLAYER_PHOTO_PH4_PH5_20261104.md` and root `DEVELOPMENT_CONTINUITY.md`.

**Player Photo PH5 review/CI checkpoint (4 November 2026):** Completed implementation/security source review and committed a dedicated photo-only GitHub Actions workflow (locked npm install, 25 authored Jest cases and React production build). The workflow regex was corrected after source inspection. Vercel reported a **successful deployment** for workflow-creation commit `90f1365361cecdcc169ff2b03d029ff56a030924`. **No verified Jest run result** is available through the connected GitHub API, and no authorized live replacement/deletion browser test was performed. PH5 development preparation may be treated as closed for continuing feature work, but **automated verification, role/browser acceptance and photo cleanup behavior in production remain unverified**, not release-ready. CI: `.github/workflows/player-photo-validation.yml`; exact acceptance matrix: `PLAYER_PHOTO_PH4_PH5_20261104.md`. Existing historical orphan retained; bucket/RLS policies unchanged.

**Unresolved/deferred:** Full Enquiries E5 validation, Coach/assignment CMA5 regression, Coach Profile CP5 execution and the two coach assignment lifecycle issues remain open while feature/UI development continues. Prior historical "COMPLETE" entries below do not automatically establish test coverage on the current Git HEAD. Preserve multi-tenant RBAC/RLS and follow the current implementation before future changes.

## 1. Project Overview

AcadPro is a football academy management SaaS platform for India, built with React, JavaScript, React Router, Supabase Authentication, Supabase PostgreSQL, Git/GitHub and Vercel.

The platform uses academy-level multi-tenancy, centralized permissions/data scope and Supabase Row Level Security as the database authorization boundary.

## 2. Current Development Phase

### Phase 5 — Platform Hardening & Product Completion

**Phase 5.1 — Role Security and RLS Validation: COMPLETE**

Completed:
- Role and academy access review
- Centers and player-batches mutation-policy hardening
- Cross-academy isolation tests
- Coach assignment isolation validation
- Parent isolation foundation and validation
- Database policy and security-findings review

Manual validation covered Super Admin, Academy Owner, Coach and Parent scenarios, cross-academy access, mutation attempts and direct ID/URL tampering.

**Phase 5.2 — Player Module Hardening & Bulk Import: COMPLETE**

Completed:
- Transactional player create/update functions
- Server-side validation and role/academy scope enforcement
- Player/parent duplicate protection
- Player-batch invariant enforcement
- Deferred invariant validation and unique current mapping protection
- Reconciliation of active player-batch inconsistencies
- Cleanup of duplicate active parent records without deleting player rows
- Function EXECUTE privilege hardening
- Excel-based Bulk Player Import with parser, validator, template and preview workflow
- Super Admin-only import authorization
- Transactional bulk insert with parent reuse/create
- Bulk import rollback and duplicate rejection testing

Historical verification recorded:
- Browser player create/edit/batch-change regression passed
- Academy Owner cross-academy authorization tests passed
- Forced transaction rollback test passed
- Bulk Player Import success and rollback tests passed
- Jest: 5 suites passed, 34 tests passed
- Production build completed successfully

### Phase 7 — Security Advisor Remediation: IN PROGRESS

**Completed on 11 October 2026**
- Enabled RLS on `public.trial_attendance` and `public.inquiries`.
- Revoked direct `anon` and `authenticated` privileges on those tables; both were empty when inspected.
- Revoked direct client privileges on `public.payment_number_counters`, keeping it for server-side/database use.
- Verified RLS is enabled and client SELECT/INSERT is denied for all three tables.
- Reviewed the original seven flagged `SECURITY DEFINER` RPCs. All seven have an empty `search_path`; anonymous and PUBLIC execution are denied. P1.4 adds two intentionally authenticated `SECURITY DEFINER` RPCs (`submit_parent_upi_payment` and `review_parent_upi_payment`) with empty search paths, explicit role/scope checks, and anon/PUBLIC execution revoked. The Security Advisor snapshot on 12 October 2026 reports ten authenticated SECURITY DEFINER RPC warnings: seven pre-existing functions, the two P1.4 submission/review RPCs, and the P1.5 accepted-claim recording wrapper. These are reviewed findings; keep intentional grants only with role/scope tests and documented dependencies.
- Reviewed role, authentication, academy-scope and business-rule checks in the payment correction and parent coach RPCs.
- Confirmed frontend dependencies exist for the coach profile RPCs, parent coach RPCs and payment collection RPC. Do not revoke authenticated execution or change them to SECURITY INVOKER without regression testing.

**Remaining / deferred**
- Review and harden `update_my_coach_profile(...)`: confirm live role-resolution logic, add explicit authentication/coach-role and input validation as appropriate, preserve the current RPC contract, and regression-test.
- Review/test the seven authenticated `SECURITY DEFINER` functions and their frontend call sites. The Advisor warning may remain when authenticated execution is intentional.
- Re-run Security Advisor after further changes.
- Leaked-password protection is unavailable on the current Supabase Free plan; accepted as a documented plan limitation and deferred until a plan upgrade is justified.
- At the pre-Enquiries Phase 7 snapshot, the three RLS-enabled/no-policy INFO findings (`inquiries`, `trial_attendance`, `payment_number_counters`) were intentional deny-by-default configurations. Enquiries R2 has since added the scoped `inquiries` SELECT policy; the remaining no-policy INFO findings are `trial_attendance` and `payment_number_counters`.

Detailed record: `docs/PHASE_7_SECURITY_ADVISOR_REMEDIATION.md`.

### P1.4 — Parent UPI Payment Submission and Verification: IMPLEMENTED; VALIDATION PENDING

Implemented on 12 October 2026:
- Parent Financial Overview form for submitting a UPI claim against a linked child's outstanding due.
- Claim captures amount, UPI transaction reference/UTR, payment date and optional note.
- Academy Owner review queue with accept/reject decisions and rejection reason.
- Super Admin read-only queue access; Coach and anonymous access denied.
- New `parent_payment_submissions` table, RLS, role/academy-scoped RPCs, unique UTR and one-active-claim-per-due constraints.
- Acceptance revalidates the current remaining due. Submission/review do not change the payment ledger or issue receipts.

Automated validation passed on 12 October 2026: **13 Jest suites / 86 tests passed** and the production build compiled successfully. Run: https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/38196597158

Live Supabase checks confirmed both migrations are recorded, RLS is enabled, authenticated clients have SELECT but no direct INSERT/UPDATE/DELETE, the two RPCs deny anon execution and use empty search paths, and the active-claim index is present. Security Advisor was run; the two new authenticated SECURITY DEFINER RPC warnings are intentional and documented.
- Complete browser acceptance from `docs/P1.4_PARENT_UPI_SUBMISSION_REVIEW.md`, including negative cross-parent/cross-academy tests and unchanged-ledger checks.
- P1.5 is implemented and applied: `record_accepted_parent_upi_submission(uuid)` invokes the existing secured `collect_payment` RPC in the same transaction, attaches the submitted UTR, records the payment ID/receipt metadata, updates the claim to `recorded`, and rejects duplicate posting. Browser acceptance remains pending.

### P1.3 — Parent Portal UPI QR and WhatsApp Sharing: AUTOMATED VALIDATION PASSED; BROWSER ACCEPTANCE PENDING

Implemented on 12 October 2026:
- Display enabled academy UPI details in Parent Portal for the selected linked child.
- Keep the existing Parent Financial Overview display.
- Add a user-initiated WhatsApp share link for academy name, payee, UPI ID and QR URL.
- Add component tests for enabled/disabled settings, QR-only configuration and share-message content.
- No schema, Storage, RLS or payment-ledger changes.

Still required:
- Automated validation passed: 11 Jest suites, 75 tests, and production build.
- Complete Parent Portal browser validation, including switching linked children and opening the WhatsApp share link.

### P1.2 — Academy UPI Settings: AUTOMATED VALIDATION PASSED; BROWSER ACCEPTANCE PENDING

Implemented on 12 October 2026:
- Academy-scoped `academy_payment_settings` table with RLS and least-privilege grants.
- Public-read QR bucket `academy-upi-qr`, owner-only object mutations scoped by academy UUID path.
- Owner configuration screen, Super Admin read-only view, and enabled settings in Parent Financial Overview.
- UPI/QR validation tests and documented browser acceptance checklist.
- Three new migrations recorded in the live ledger; historical migration drift was preserved.

Still required before marking complete:
- Automated Jest/build validation passed on the current feature branch.
- Complete browser acceptance across Academy Owner, Super Admin, Parent and negative cross-tenant scenarios.
- Re-run Supabase Security Advisor; distinguish new findings from existing intentional findings.

## 3. Module Status

| Module | Status | Current State |
|---|---|---|
| Authentication | Core complete | Supabase Auth and role-based login flows working; Forgot Password remains pending |
| RBAC | Validated | Role, academy and parent isolation validation completed |
| Academy Management | Complete | CRUD implemented |
| Center Management | Complete | CRUD implemented |
| Batch Management | Complete | CRUD implemented; Academy Owner creation verified |
| Coach Management | Core complete | Coach assignment implemented |
| Player Management | Hardened | CRUD, transactional writes and current player-batch integrity implemented |
| Bulk Player Import | Complete | Super Admin-only Excel import with validation and transactional rollback |
| Attendance | Core complete | Marking, editing, history, soft delete and role rules implemented |
| Subscription Plans | Complete | CRUD and role security implemented |
| Player Subscriptions | Complete | Assignment and management implemented |
| Payment Dues | Complete | Generation, status, remaining amount, editing and filtering implemented |
| Payment Collections | P3 COMPLETE | Atomic collection RPC, generated references, correction workflow, admin-only financial access, Coach denial and legacy reconciliation verified |
| Receipt Management | P2 COMPLETE | Database-generated unique receipt numbers, legacy receipt backfill and frontend receipt display/print integration implemented |
| Dashboard Analytics | Complete | Role-aware KPIs, attendance and collection analytics implemented |
| Parent Portal | Complete for current V1 scope | Linked child summary, batch details, coach details, attendance, dues, payment history, receipt workflow and parent isolation implemented |
| Player Performance | V1 complete | Assessment entry/report, role-aware mutation scope, historical tracking, parent read-only access and RLS/RBAC regression verified |
| Reports | Planned | Not started |
| Notifications | Planned | Not started |
| Academy UPI Settings | Automated validation passed; browser acceptance pending | Owner-managed UPI ID/QR, Super Admin read-only, parent linked-child display; payment submission and UTR verification deferred |
| Parent UPI QR / WhatsApp sharing | Automated validation passed; browser acceptance pending | Parent Portal and Financial Overview display; user-initiated WhatsApp share; no payment ledger changes |
| Parent UPI submission / owner review | Implemented; automated validation pending | Claim form, secure RPCs, owner verification queue; accepted claims do not alter ledger; P1.5 posting deferred |
| Online Payments / Razorpay | Planned | Production flow pending; no Razorpay code or credentials in P1.2 |

## 4. Current Priorities

1. Complete Enquiries R3 automated validation and browser acceptance, then proceed to R4 status/trial-date UI and R5 owner-only conversion as separate phases.
2. Use controlled fixtures or an isolated database branch for Enquiries write-path and cross-tenant negative tests; do not create fake enquiries in the active database.
3. Keep the P1.6 UPI release gate in `docs/P1.6_UPI_RELEASE_CHECKLIST.md` separate and blocked until its own browser/security/ledger checks pass.
4. Continue Phase 7 Security Advisor remediation only as a separately scoped task; leaked-password protection remains unavailable on the current plan.

## 5. Parent Portal Completion Status

Complete for the current V1 scope.

Verified features include:
- Parent authentication and protected routing
- Linked children and player summary
- Academy, center, batch, age group and training-time details
- Multiple active coaches per batch and parent-safe coach profile data
- Attendance summary and history
- Pending dues
- Payment history
- Receipt details and Print / Save PDF workflow
- Parent-specific RLS validation and cross-parent isolation
- Parent end-to-end browser regression

Parent-safe coach visibility uses dedicated RPCs that scope results to the authenticated parent and linked players.

## 6. Database and Security Status

RLS is enabled on the major role-sensitive tables, including academies, attendance, batches, centers, coach_batch_assignments, coach_batches, coaches, parents, payment_dues, payments, player_batches, player_subscriptions, players, subscription_plans and users.

Phase 7 table lockdown:
- `public.inquiries`: R2 access model is applied; authenticated SELECT is scoped by Super Admin / Academy Owner / authorized Coach policy, direct authenticated writes are denied, and mutations use validated RPCs. See `docs/ENQUIRIES_R2_DATABASE_SECURITY.md`.
- `public.trial_attendance`: RLS enabled; direct anon/authenticated privileges revoked; no policies by design until an access model is required.
- `public.payment_number_counters`: RLS enabled; direct client privileges revoked; intended for server-side/database use.
- Leaked-password protection: unavailable on Supabase Free; deferred.
- The latest documented Security Advisor snapshot reports 13 authenticated `SECURITY DEFINER` warnings: 10 pre-existing findings plus the three scoped Enquiries RPCs. Review each function's authorization/search path before changing grants or security mode. Two no-policy INFO findings remain for intentionally locked-down `trial_attendance` and `payment_number_counters`.

## 7. Technical Debt and Deferred Work

- Forgot Password flow
- Phase 7 security review and RPC regression
- Historical migration-source reconciliation (remote migration ledger and repository migration files differ; see `supabase/MIGRATION_RECONCILIATION.md`)
- Automated payment reminders
- Razorpay production integration
- Performance-advisor optimization
- Production QA and security hardening

## 8. Development Rules

```text
Inspect current state → Plan minimal change → Implement → Build/Test → Functional Test → RBAC/Data-Scope Test → Review diff/status → Document → Commit
```

- Frontend filtering must never be treated as the primary security boundary.
- Do not replay or edit the live migration ledger to make it match repository filenames. Historical migration reconciliation remains incomplete; see `supabase/MIGRATION_RECONCILIATION.md`.
- Never claim a build, test, deployment or browser verification unless it was actually run and observed.
- Preserve RPC signatures and existing workflows unless the implementation and regression tests are updated together.

## 9. Working Baseline and Handoff

**Branch:** `payment-module-finalization`  
**Latest focus:** P1.2/P1.3 are implemented; P1.4 submission/review migrations are applied and browser acceptance remains pending. P1.5 source code and migration are now committed: an Academy Owner can explicitly record an accepted claim through a new database wrapper around the existing secured `collect_payment` RPC, with payment/receipt/balance writes in one transaction and duplicate recording blocked. The P1.5 migration is applied to the live database (ledger version `20261012025707`) and verified. GitHub Actions passed Jest and production build on run https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/38197741398; browser/security acceptance is pending. Vercel previously reported preview deployment rate-limited for 24 hours on the current plan. Phase 7 RPC hardening remains deferred until the payment UX validation gate.

Useful documents:
- `docs/PHASE_7_SECURITY_ADVISOR_REMEDIATION.md` — current findings and remediation record
- `supabase/MIGRATION_RECONCILIATION.md` — migration history drift and safe reconciliation rules
- `frontend/docs/PROJECT_ARCHITECTURE.md` — architecture, roles and data scope

**Separate payment release gate:** P1.4/P1.5 browser and security acceptance remains pending, including exactly-once posting, receipt generation, balance updates, stale-balance rollback and role isolation. Vercel preview was previously rate-limited; do not claim browser acceptance until actually tested. Current development focus is Enquiries R3; see `docs/ENQUIRIES_R3_FRONTEND_IMPLEMENTATION.md`.


## P1.6 Scope Correction — 12 October 2026

The Expenses feature changes previously added under P1.6 were reverted because they are outside the parent UPI payment integration scope. P1.6 remains the payment integration regression, documentation and release gate; do not introduce new Expenses functionality as part of this phase. P1.4/P1.5 UPI code and payment ledger workflows were preserved. Browser acceptance remains pending.


## P1.6 UPI Release Gate — 12 October 2026

The approved P1.6 scope is regression testing, role/security verification, documentation and release readiness for P1.2–P1.5 UPI integration. No Expenses feature work belongs in this phase. See `docs/P1.6_UPI_RELEASE_CHECKLIST.md`. Automated CI and live schema/grant inspection have passed on the previously recorded head; browser acceptance and CI for the documentation head remain pending. Overall release is blocked until the browser/RBAC/ledger acceptance gates pass.


## AcadPro Enquiries V1 — R2 Database/Security Foundation (12 October 2026)

**R1 specification:** frozen in `docs/ENQUIRIES_MODULE_SPEC.md`.  
**R2:** applied and live-verified; frontend implementation has not started.

- Live migration: `20261012035934 / enquiries_r2_database_security`.
- Extended `public.inquiries`; added status/trial/conversion fields, constraints, indexes and audit fields.
- RLS-enabled, authenticated SELECT only; no direct authenticated INSERT/UPDATE/DELETE; anon denied.
- Added role/academy/center-scoped `create_inquiry`, `update_inquiry` and Academy Owner-only `record_inquiry_conversion` RPCs, each SECURITY DEFINER with an empty search path.
- Coach center access is derived from active coach-batch assignments, batches and centers. Read-only scope smoke test passed for allowed vs foreign-academy center.
- `public.trial_attendance` remains untouched and locked down. No live enquiry/player test records were created.
- Security Advisor now reports 13 authenticated SECURITY DEFINER warnings (10 previously reviewed plus the 3 new scoped enquiry RPCs). Two unrelated RLS-enabled/no-policy INFO findings remain for `trial_attendance` and `payment_number_counters`; leaked-password protection remains a plan limitation.
- Controlled transaction/authorization tests and browser acceptance are still pending; do not mark the feature release-ready.

Detailed record: `docs/ENQUIRIES_R2_DATABASE_SECURITY.md`. Next phase: **R3 — Enquiries service, list and quick-create UI**.


## AcadPro Enquiries V1 — R3 Frontend (13 October 2026)

- [x] Enquiry service reads through the R2 RLS policy and creates through the validated `create_inquiry` RPC.
- [x] Role-aware list: Super Admin read-only; Academy Owner and Coach can quick-capture within their R2-authorized scope.
- [x] Search, status/source/center filters, Super Admin academy filter, optional source/note, owner-optional center and coach-authorized center selection.
- [x] Advisory duplicate warning; no automatic merge or rejection.
- [x] Protected route, role-appropriate sidebar links, responsive styling, loading/error/empty/success states and validation tests added.
- [ ] Run Jest and production build on the latest head; confirm GitHub Actions status.
- [ ] Browser acceptance, including role visibility and read-only filter behavior. Do not create fake leads in the active Supabase project.

Detailed implementation and acceptance checklist: `docs/ENQUIRIES_R3_FRONTEND_IMPLEMENTATION.md`. R4 status/trial-date editing and R5 conversion remain out of scope for this implementation.


## AcadPro Enquiries V1 — R4 Status and Trial Tracking (13 October 2026)

- [x] Added inline status/trial-date editor to the Enquiries list for Academy Owner and Coach.
- [x] Status changes call the R2 `update_inquiry` RPC with the existing enquiry fields; no direct table writes or new migration.
- [x] Trial Scheduled requires a trial date in the UI and is also enforced by the database RPC/constraint.
- [x] Converted enquiries remain immutable in the UI; conversion is not exposed through ordinary status editing.
- [x] Reopening Lost is available to Academy Owner only; Coaches cannot reopen Lost enquiries.
- [x] Added validation tests for valid/invalid status and trial-date combinations.
- [ ] Run Jest and production build on the latest head; check GitHub Actions result.
- [ ] Browser acceptance: status changes, trial date required, Lost reopen role restriction, Converted read-only, and cross-center/academy access denied.
- [ ] Exercise write-path authorization using controlled fixtures or an isolated Supabase development branch; do not create fake records in the active project.

R4 code is implemented but is not verified/release-ready until automated and browser acceptance pass. R5 Academy Owner-only conversion remains separate.


## AcadPro Enquiries V1 — R5 Atomic Player Conversion (13 October 2026)

- [x] Added owner-only conversion action and enrollment dialog.
- [x] Uses the existing `record_inquiry_conversion` SECURITY DEFINER RPC; no direct browser Player/Parent writes and no separate non-atomic enquiry update.
- [x] Prefills the enquiry's player name, phone and DOB summary; collects parent name, gender, joining date, center and batch; parent email/address are optional.
- [x] Center is fixed when already assigned; otherwise owner selects an active center. Batch list is scoped to the selected center.
- [x] Added conversion validation unit tests.
- [x] Documented R5 design and acceptance checklist in `docs/ENQUIRIES_R5_ATOMIC_CONVERSION.md`.
- [ ] Run Jest, production build and check GitHub Actions on the latest R5 head.
- [ ] Browser acceptance for owner-only access, conversion success/retry, parent reuse, batch invariants and rollback using a genuine enrollment or controlled isolated fixtures.
- [ ] Do not convert the user's existing enquiry unless it is a genuine enrollment decision; do not create fake test Players in the active database.

R5 is implemented but not verified/release-ready until automated, CI and browser acceptance pass. R6 regression and release readiness remain.


## AcadPro Enquiries V1 — R6 Regression and Release Readiness (13 October 2026)

- [x] Added consolidated regression/release checklist at `docs/ENQUIRIES_R6_REGRESSION_RELEASE_CHECKLIST.md`.
- [x] Defined role matrix, existing application regression coverage, isolated transactional tests, browser acceptance, data-safety constraints and explicit release exit criteria.
- [ ] Run `npm test -- --watchAll=false` from `frontend` on the latest branch head and record exact results.
- [ ] Run `npm run build` from `frontend` on the latest branch head and record exact results.
- [ ] Confirm GitHub/Vercel status for the exact tested HEAD.
- [ ] Complete controlled authorization/transaction tests in an isolated Supabase development environment.
- [ ] Complete browser acceptance for Super Admin, Academy Owner, Coach, Parent/anonymous and existing player/payment/attendance/Parent Portal flows.
- [ ] Update this section with actual evidence and tested commit SHA before calling R6 PASS.

A Vercel success was observed for documentation commit `041a8c27e063abd32d853d2078c84bc69eaa922a`; this is not a substitute for checking the latest HEAD. No local Jest/build or browser/transaction test is claimed as passed. R6 remains **validation in progress**, not release-ready.


## Current Development Handoff — 13 October 2026

**Code validation baseline:** `fa87d7d79152a3807f7c86e070d4b3be9ec97b50` on `payment-module-finalization`.

### Enquiries V1 / R6 checkpoint
- R1 specification, R2 database/security foundation, R3 list/quick capture, R4 status/trial tracking and R5 Academy Owner-only atomic Player conversion are implemented.
- User ran the latest code's frontend test suite: **14 Jest suites / 101 tests passed**.
- User ran the production build: **compiled successfully**. Non-failing warnings remain for React Router v7 future flags, multiple GoTrueClient instances in `App.test.js`, and an unwrapped React state update in a Parent UPI component test.
- GitHub combined status for the tested code commit reported Vercel success.
- User verified the latest Preview deployment can open `/enquiries` and `/parent-upi-submissions` as Academy Owner; expected sidebar links render.
- Read-only live database review confirmed the enquiry table's direct-write restrictions, the scoped SELECT policy, and the three enquiry RPCs' empty search paths / anon execution denial.
- The existing converted enquiry has a Player, Parent and player-batch mapping. No live test data was created.

### Deferred release validation — explicitly postponed
The user has chosen to return to these checks later so development can continue. Do not mark R6 or Production release-ready. Remaining items:
- Isolated success/retry/concurrency/rollback and role/cross-tenant authorization tests.
- Full browser acceptance for Super Admin, Academy Owner, Coach, Parent/anonymous and the Enquiries lifecycle.
- Existing-module regression for Player CRUD, Attendance, subscriptions, payment dues/collections/receipts, Parent Portal and UPI flows.
- Final diff/status review and Production verification.

Live data inspected during read-only checks: 1 enquiry, 49 players, 59 parents, 48 player-batch rows, 42 payments, 26 payment dues, 131 attendance rows and 0 trial-attendance rows. No Supabase development branches were listed. Never create disposable enquiry/player records or run rollback/concurrency tests against this live project.

Latest Security Advisor snapshot: 13 authenticated SECURITY DEFINER warnings, two intentional RLS-enabled/no-policy INFO findings (`payment_number_counters`, `trial_attendance`), and leaked-password protection unavailable on the current plan. The enquiry RPC warnings still require role/tenant runtime tests; this is not a release approval.

**Current state:** Enquiries implementation and automated validation are complete for the observed code HEAD; R6 release validation is **deferred / in progress**. Continue development on the current branch without representing deferred checks as passed.
