# Kheltriva DevBot AG3.4A — Live RLS/Authorization Inventory and Security Regression Plan

**Checkpoint:** 11 November 2026 (Asia/Kolkata)  
**Source:** read-only Supabase catalog and Security Advisor, compared with `payment-module-finalization` at merge `9b8ba8edd4c4be7790ad0b5e48c5d8f2c26b36b9` and the current Role Matrix.  
**Live project inspected (read-only):** `ulyealhkmlorsbdiknrh` (`acadpro-db`, ACTIVE_HEALTHY). The older `borsjaktqcuicmuiuldc` project is INACTIVE and is **not** a substitute.  
**Status:** AG3.4A catalog inspection completed; suspected gaps require reproduction; **no deployed-policy parity signoff**. No DDL, writes, Auth-user impersonation, migration execution or service-role operations were performed.

## 1. Why AG3.4 differs from AG3.1–AG3.3

- AG3.1 Owner, AG3.2 Coach and AG3.3 Parent/Super Admin: **owner-accepted, merged, real GoTrue JWT → PostgREST CI PASS** on *purpose-built disposable-only policies*.
- Those tests are sound evidence for their **synthetic scope**, but do **not** prove that the live `public` and `storage` policy text, actual helpers, grants, RPCs and original migration history are equivalent.
- AG3.4 begins with live catalog verification and **negative authorization risk triage**. Actual mutation testing must use a separately approved *unlinked synthetic* environment with explicitly attested policy dependencies. Do not test destructive operations against hosted records.

## 2. Read-only catalog baseline (observed, not certification)

| Surface | Live inspection |
|---|---|
| Public base tables | **28**; all have RLS enabled |
| Public RLS policies | **103** across those tables; **2 tables have zero policy** |
| Private-schema functions | **42**, including 11 previously pinned current-state helpers |
| Public `SECURITY DEFINER` functions | **14**, authenticated EXECUTE, no effective anon EXECUTE in the checked function privileges; all have empty `search_path` configurations |
| Public views | **0** |
| Storage buckets | **4**: public `academy-logos`, `academy-upi-qr`, `coach-photos`; nonpublic `player-photos` |
| Supabase migration ledger | **82** applied version records; latest `20261101082001` |
| Repository `supabase/migrations/` | **40** SQL files, with **23** exact version-prefix matches to the live ledger; **59 live versions** lack exact local prefix matches and **15 distinct local version prefixes** are absent from the live ledger (some local files share a prefix). **Version matches do not establish SQL content equality.** |

**Interpretation:** No observed RLS-disabled public table is an encouraging baseline, not a role-permission proof. A SQL GRANT to `authenticated` or `anon` does not itself show exposure when RLS filters rows. Conversely, RLS policy evaluation must be tested even where frontend route guards hide the operation.

The older `supabase/MIGRATION_RECONCILIATION.md` records a historical **64 live / 24 local** snapshot; retain that historical evidence and use the live 82/40 numbers **only for this current checkpoint**, without rewriting history.

## 3. Security Advisor baseline (observed)

Read-only Security Advisor findings at this checkpoint:
- **2 informational `rls_enabled_no_policy`:** `public.payment_number_counters`, `public.trial_attendance`. Both also have no direct `anon`/`authenticated` table grants in the catalog check. Maintain deny-by-default; do not invent policies solely to remove informational lint.
- **14 warning `authenticated_security_definer_function_executable`:** authenticated-callable public RPCs spanning payment corrections/collection, inquiries, Parent coach lookups, Parent UPI submissions/reviews and Coach profile editing. These require per-function role/tenant checks and dependency-aware tests; *their warning status alone does not prove an exploit*. Their checked `search_path` is empty; no effective anon EXECUTE in the observed function privileges.
- **1 leaked-password protection disabled warning:** previously documented Free-plan/deferred control; check plan entitlement before changing Auth settings.

References: [Supabase RLS no-policy lint](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [authenticated SECURITY DEFINER lint](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 4. Prioritized inspection findings

### AG3.4-F1 — HIGH-PRIORITY **POTENTIAL** Coach mapping authorization gap (NOT exploitation-tested)

The actual `public.coach_batches` RLS policies and table grants were inspected directly:

- `coach_batches_select`: allows `private.is_super_admin()` **OR** `private.batch_academy_id(batch_id) = private.current_academy_id()` **OR** a Coach-linked row. The academy-equality branch does **not** include an Academy Owner role predicate.
- `coach_batches_insert`, `coach_batches_update`, `coach_batches_delete`: allow Super Admin **OR** a batch whose academy equals `private.current_academy_id()`; they do **not explicitly require Academy Owner**. UPDATE additionally uses the same academy-only `WITH CHECK`.
- `authenticated` currently has SELECT, INSERT, UPDATE and DELETE table grants; the policies target `authenticated`. `private.current_academy_id()` returns the signed-in app user's `public.users.academy_id` regardless of role.
- No non-internal trigger was found on `public.coach_batches`. Its checked foreign keys link `coach_id` to `coaches.id` and `batch_id` to `batches.id`; **no checked FK enforces same-academy coach and batch**.
- The current UI `CoachBatchMapping.js` and `dataScope.js` use **`coach_batch_assignments`**, which has different role-aware policies. The legacy `coach_batches` table remains present and directly grantee-accessible.
- The pinned `private.can_access_batch(uuid)` checks `coach_batches` membership and does not require `is_active`. In contrast, `private.is_coach_assigned_to_batch(uuid)` checks active `coach_batch_assignments`. The inspected public table policies reference the latter; investigate other helper/RPC dependencies before asserting impact.

**Risk hypothesis:** A signed-in Coach or Parent with an academy ID could satisfy the same-academy predicate to list or mutate legacy mapping rows, contrary to the current Role Matrix. This is a **catalog-based suspected gap**, **not** a demonstrated unauthorized write or confirmed exploitable path. Other runtime constraints must be evaluated through negative real-JWT tests in a disposable instance before any remediation.

**Next proof gate:** Build a read-only exact-definition/ACL attestation, then test Parent, Coach, Owner and SA JWTs against an approved disposable reconstruction of the *actual* `coach_batches` policies and relevant dependencies. Assert role denial, same- and cross-academy denial, active/inactive mapping behavior, FK behavior, and transaction/data invariants. **Do not exercise an unauthorized write on production.** Any remediation gets its own approved migration, test and rollback plan.

### AG3.4-F2 — Parent production helper differs from synthetic fixture (PARITY GAP, not vulnerability conclusion)

Live `private.current_parent_id()` is a `SECURITY DEFINER` function which joins `public.parents` to `public.users`, requires the signed-in `auth.uid()`, requires `lower(coalesce(u.role,''))='parent'`, and requires `parents.is_active=true`. AG3.3 used `parents.user_id` and `auth.uid()` in a new **synthetic** policy, but its minimal Parent fixture omitted `parents.is_active`. Therefore positive tests do not prove the deployed inactive-Parent denial or every linked-player/financial policy. The pinned AG2 11-helper snapshot is only a **subset** of the live 42 private functions.

**Next proof gate:** Verify full helper source/dependency provenance and test active/inactive Parent, same-academy other Parent, foreign academy, multiple linked children, direct-ID payment/attendance/subscription SELECT, and Parent coach-profile RPC denial surfaces using real scratch JWTs and verified policy text.

### AG3.4-F3 — Centers and assignment read-scope contract review (ROLE MATRIX ALIGNMENT PENDING)

`centers_select` uses `private.is_super_admin() OR academy_id=private.current_academy_id()` without an explicit role restriction. For an Auth account carrying an academy ID, the second condition is broader than a strict 'Owner and assigned Coach only' interpretation of the current Role Matrix. Parent Portal displays selected center information, so **do not presume all Parent center visibility is unintended**. Confirm legitimate Parent/Coach read requirements and test direct table access before changing the rule.

### AG3.4-F4 — Financial RPC, Storage and migration provenance remain unverified

- Finance policy snapshots show role-scoped SELECT on payments and parent submissions; Super Admin `ALL` on subscription plans, subscriptions and dues, while payment mutations primarily go via callable `SECURITY DEFINER` RPCs. No role-by-role mutation/overpayment replay was conducted in AG3.4A.
- Storage policies include public-read logos, academy UPI QR and coach photos, and authenticated per-record private player-photo access. Bucket public flags reflect intended design, **not an all-object permission audit**.
- Full original 82-migration replay is **still blocked**, with known timestamp/name drift, historical missing source and high-risk data migrations. Do not auto-backfill, rewrite history, reconcile customer finances, or replay current-state function snapshots as if historical.

## 5. Controlled AG3.4 roadmap (planned, not implemented)

| Phase | Scope | Exit criterion |
|---|---|---|
| **AG3.4A** | Live read-only inventory and risk triage | Catalog and report reviewed; no production mutation (**inspection completed, Owner review pending**) |
| **AG3.4B** | Exact deployed Coach mapping policy parity + negative JWT | Source/ACL/trigger/FK dependencies attested; genuine scratch policy loaded; Coach/Parent/Owner/SA tests PASS; remediation considered only if proven |
| **AG3.4C** | Parent linked-player and active-record parity, Coach scope, Super Admin read/control parity | Source-verified policies/extra helpers; direct-ID positive/negative JWT and cross-tenant regressions PASS |
| **AG3.4D** | Finance, 14 authenticated-definer RPCs, storage policy/grant audits | Role-by-role mutation/denial and integrity invariants; no unauthorized cross-tenant finance access |
| **AG3.4E** | Consolidated policy/role contract, migration-provenance and release audit | All critical/high findings dispositioned; full deterministic regression, manual acceptance, docs and explicit release decision |

**Not implied:** AG3.4A does not unblock B3 protected historical replay, B4 subscription/billing integration or production deployment.

## 6. Next action and restrictions

- Request Product Owner acceptance of **this report/triage**, then implement **AG3.4B** as a small, separate PR on `payment-module-finalization`. No status can be promoted from candidate to confirmed exploit until negative JWT evidence exists.
- For any future `coach_batches` policy change: first inspect existing services, helper dependencies, live grants/FKs/triggers, real Role Matrix contract and exact SQL migration ancestry. Prepare versioned migration and rollback, run isolated native CI, require manual approval before any hosted DDL.
- Preserve original Windows local C3.4B2 persistence incident, B3 history safeguards and B4 NO-GO. Do not execute signed-in test users against hosted app data or attempt to bypass RLS through privileged runtime credentials.
