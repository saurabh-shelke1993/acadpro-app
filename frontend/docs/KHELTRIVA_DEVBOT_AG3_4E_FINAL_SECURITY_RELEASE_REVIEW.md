# AG3.4E — Consolidated security regression and production release decision

**Date:** 11 November 2026. **Artifact status:** automated fail-closed release gate implemented; **production release decision: NO-GO**.  
**Development branch:** `payment-module-finalization`; production `main` and hosted Supabase remain unchanged.  
**Owner instruction:** AG3.4 PRs may merge automatically after successful PR-specific tests. This is not permission for customer-data DML, hosted policy deployments, Vercel/main deployment or B4 billing activation.

## 1. Auditable delivered work

| Phase | Code/doc work | Validation evidence | Honest scope |
| --- | --- | --- | --- |
| AG3.4A | Read-only live RLS/helper/grant/advisor/storage/migration inventory | [PR #8](https://github.com/saurabh-shelke1993/acadpro-app/pull/8) | Inspected/merged, not a real Auth role exploit test |
| AG3.4B | Exact live Coach legacy-mapping policy replay and scratch-only role-gated candidate | [Native CI 43046427442](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43046427442) | Actual signed-JWT unauthorized Parent/Coach cross-Coach mapping writes reproduced in scratch; no hosted remediation |
| AG3.4C1 | Pinned 28 role-policy and seven helper fingerprints | [CI 43051827250](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43051827250) | Structural source fingerprint contract, not data-plane authorization |
| AG3.4C2 | Exact six deployed SELECT expressions and live active-Parent helper | [Native PR CI 43053546673](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43053546673) | 9/9 static safety tests and real JWT Parent A1/A2/B, Owner, Coach and SA role reads PASS, including inactive Parent |
| AG3.4D1 | Nine source-matched finance read predicates + six dependent helpers | [Native CI 43056181524](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43056181524) **PASS**, 9/9 static tests | Signed-JWT finance SELECT isolation for Parent/Owner/Coach/SA and inactive Parent; NO payment RPC/ledger mutation or overpayment signoff |
| AG3.4D2 | Source-hashed fourteen public `SECURITY DEFINER` functions, sixteen Storage policies, four bucket flags | Static fingerprint inventory | NOT real negative RPC mutation testing or object Storage authorization |
| AG3.4E | Evidence ledger, deterministic fail-closed release decision script, tests and GitHub Action | PR-specific offline CI | Explicit **NO-GO** until every critical/high risk and release-gate evidence is independently satisfied |

No step above establishes full-hosted-policy parity, historical replay, complete RBAC/financial privilege testing, or production acceptance.

## 2. Unresolved release-blocking findings

### HIGH — AG34-HIGH-001: legacy Coach mapping

The hosted `public.coach_batches` existing policies were reproduced from source-attested SQL and tested under native signed GoTrue JWTs. A Parent and Coach could add and delete an unauthorized cross-academy Coach-to-Batch mapping **in the disposable reconstruction**, where no extra production trigger invariants were present. The source-attested policy expressions are a high-confidence authorization risk. A role-gated candidate passed scratch regressions; **this candidate has not been deployed and the live risk remains**. The current application mostly writes `coach_batch_assignments`, so any production remediation needs a dependency/usage audit of the legacy table and the `private.can_access_batch()` helper.

### Unverified — fourteen authenticated-callable public RPCs

Security Advisor flags fourteen `SECURITY DEFINER` functions; catalog inspection shows empty explicit `search_path` and no effective `anon` EXECUTE. Source review observed role/academy guards for payment correction, collection, UPI submissions/review, enquiry mutation and Parent coach-profile lookup. These are positive source indications, **not** passing real-JWT negative mutation/transaction/rollback tests. Financial source integrity, idempotency, overpayment, concurrency, rejected/accepted payment state transitions and cross-tenant denial remain release blockers.

### Unverified — sixteen Storage RLS policies

Four buckets: three intentional public-read buckets (logos, UPI QR, Coach photos) and private `player-photos`. Bucket flags and all sixteen Storage policy fingerprints were captured; no signed-JWT object upload/read/replace/delete regression was performed.

### Unresolved frontend regression — AG34-GATE-006

The full `Phase 7.5 - Frontend validation` workflow [run 43056100352](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43056100352) failed **4 of 47 Jest test suites, 16 of 490 tests** (474 tests passed). The four failing suites are `CoachProfile.test.js`, `CoachPerformanceAssessments.test.js`, `PlayerPerformanceReport.test.js`, and `PerformanceWorkspaceTabs.test.js`. As tests failed, the subsequent React production build step was skipped.

The same four-suite/16-test pattern was present in [earlier run 43051886803](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43051886803) before AG3.4C2 and E. Since these AG3.4 changes are security test/docs infrastructure rather than UI source, these failures appear pre-existing, but precise root causes still need independent triage before any regression pass claim.

**Release blocker:** Repair or formally disposition the failures, rerun the full frontend test suite and CI React build, then obtain explicit acceptance. No unrelated UI changes were made as part of this security phase.

### Independent frontend build — PASS, full Jest remains FAIL

A separate non-deploy Node 20 React production build with `CI=true`, locked `npm ci`, and **dummy Supabase URL/key** compiled successfully in [run 43057423740](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43057423740), merged as [PR #15](https://github.com/saurabh-shelke1993/acadpro-app/pull/15). This establishes **build-only compilation**, not functional correctness.

The **full** [Phase 7.5 Jest run 43056100352](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43056100352) still has **16/490 failed tests across four suites**; its own build step was skipped. Thus the conjunctive release requirement `frontend_all_jest_and_build_green` is **false**. No real Vercel deployment or hosted Supabase connection occurred.

### Database migration and operational gap

Live migration ledger **82** entries; local repository **40** migration SQL files; **23** exact version-prefix matches, which do not imply byte-equal SQL source. Missing original security/migration sources prohibit a trustworthy 82-step historical replay. No live migration ledger repair, backfill or one-off reconciliation is authorized.

The original local Windows C3.4B2 Auth mapping persistence issue remains an independent, read-only check. Cross-role browser/manual QA and B4 billing data anomalies/migration reconciliation remain pending.

## 3. CI release gate behavior

`scripts/devbot/ag3_4e_security_release_gate.py` consumes `frontend/docs/AG3_4E_SECURITY_RELEASE_GATE.json` using a strict schema. It requires explicit booleans for production remediation, full 14 RPC runtime tests, all 16 Storage object tests, a clean full frontend test/build run, historical provenance, B3 replay, B4 acceptance, manual browser QA, Windows persistence, rollback plan and **fresh explicit production-release approval**.

- `python scripts/devbot/ag3_4e_security_release_gate.py --check-no-go` should **exit 0 while NO-GO is properly enforced**. This does **not** mean release security passed.
- `python scripts/devbot/ag3_4e_security_release_gate.py --require-production-go` **exits nonzero** in this state. No shell switch can override it.
- Ten offline unit tests cover missing fields, malformed values, persistent high-risk blocker, false release-go, missing evidence and branch safety.
- **Important limitation:** This is a CI advisory/evidence gate. It is NOT currently integrated into Vercel/main's protected deployment path, and data in the ledger must be independently attested before a future production signoff. It does not by itself prevent manual live deployment.

## 4. Actual release decision and exit plan

**AG3.4E implementation of the release assessment and reproducible NO-GO gate can be merged into the development branch. AG3.4 full security acceptance and production release are **NOT COMPLETE**.**

To change from NO-GO, a future controlled workstream must:
1. Design, build, run isolated source-matched negative JWT tests and approve a migration that hardens `coach_batches`; test its existing utility/legacy dependencies and rollback on a faithful environment, then separately authorize hosted rollout.
2. Build complete fourteen-RPC Auth/role/tenant direct-ID mutation/transaction/concurrency tests with disposable data and verify finance invariants.
3. Run direct object Storage permission tests for all sixteen policies across Parent/Coach/Owner/SA/unauthenticated users and image paths.
4. Restore and attest original historical migration sources and complete deterministic disposable replay before B3/B4 integration.
5. Finish cross-role browser manual QA, Windows Auth persistence and payment release QA; document production deployment/rollback and receive a new explicit Owner production authorization.

**Do not mark AG3.4 production security complete solely because all feature PRs were merged.**
