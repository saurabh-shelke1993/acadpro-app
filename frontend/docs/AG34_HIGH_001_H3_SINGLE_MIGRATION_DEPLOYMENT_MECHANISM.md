# AG34-H3 — Safe single-migration deployment mechanism (NOT DEPLOYED)

**Date:** 11 November 2026  
**Live project:** `acadpro-db` / `ulyealhkmlorsbdiknrh` (Postgres 17)  
**Target version:** `20261111165330_ag34_h1_legacy_coach_batches_client_lockdown.sql`  
**Status:** **DESIGNED + SOURCE-AUDITED + NATIVE SCRATCH CLI TEST PASS; NO HOSTED DDL OR MIGRATION-LEDGER CHANGE**. Production HIGH-001 remains OPEN; overall AG3.4E remains NO-GO.

## 1. Decision — isolated fetch + single CLI migration up

**Preferred mechanism:** Build a **private throwaway CLI workspace**, fetch all *already-applied* migration statements from the remote's own `supabase_migrations.schema_migrations` ledger, validate that the fetched 82 version/name pairs are exactly those expected, stage **only** the reviewed H3 migration, then after explicit live-DB approval invoke `supabase migration up --remote=<project-ref>` from that workspace **once**. Do not use `supabase db push` or `supabase migration up` from the normal incomplete Git working tree.

### Why it is possible

Fresh read-only SQL confirmed:

| Requirement | Live value |
| --- | --- |
| Existing applied history | **82** distinct migration versions |
| Stored statements | **82/82** nonempty, stored in `supabase_migrations.schema_migrations.statements` |
| Stored names | **82/82**, safe alphanumeric/underscore path segments |
| Version format | **82/82** with 14 digits |
| Latest live version | `20261101082001` |
| New target version already applied | **0** |
| Filename-only history fingerprint | `09dcece659f31b05aa7db67c05374e44` |
| Version/name/statement fingerprint | `8078e33fce865d46766ac894213d1e07` |
| Legacy table / original policy | 0 rows, RLS enabled, four source-attested policies with old client grants |
| Modern assignment table | 11 live rows at read-only snapshot, RLS enabled |

The 82 historical SQL files produced by the CLI's `migration fetch` are reconstructed **from the deployed ledger's stored statement arrays**, NOT independently verified original Git source files. They belong **only** in this private throwaway workspace. Never commit them, paste their contents in a PR, upload them to CI artifacts, or replay them. They can contain one-off DML, data fixes or sensitive literals.

## 2. Why not use other mechanisms

- **Normal `supabase db push --remote` or `supabase migration up --remote` from the app checkout:** missing historical local versions cause CLI's migration-history reconciliation to fail or invite unsafe `--include-all` / repair suggestions. Never allow the CLI to apply any pending migration other than H3.
- **Manual `execute_sql` / SQL Editor:** may change policy but **does not automatically record** a matching migration version, leaving source and live ledger inconsistent.
- **Supabase MCP `apply_migration`:** executes one named migration but its current tool contract accepts only `name` and `query`, not the repository's fixed `version`. It may generate a different timestamp and create a provenance mismatch. Do not use it for this exact-version release.
- **`migration repair` or direct writes to `supabase_migrations.schema_migrations`:** unnecessary and explicitly outside this workstream. Never insert/delete applied historical records to make the CLI proceed.
- **Fake history placeholder migrations:** explicitly disallowed for this hosted plan. The actual 82 applied statement arrays exist and can be fetched directly.

## 3. Important atomicity correction in the H3 migration

The old H2 file contained explicit top-level `BEGIN; ... COMMIT;`. **Supabase CLI v3.0.0** detects authored transaction boundaries and executes file statements sequentially, inserting the version *after* the authored COMMIT. That creates a possible schema-committed/ledger-unrecorded failure window.

H3 removes **only the outer transaction control statements** from the not-yet-deployed canonical migration. Every RLS preflight, revoke, restrictive policy creation, postflight, refresh notification and checkpoint SELECT remains statement-for-statement identical to the reviewed H1 SQL. The CLI now places the migration DDL and version insert in the **same driver-managed transaction**. Do not run the revised file by copying SQL directly into a manual SQL Editor without a transaction; it is intended exclusively for the managed CLI migration engine.

**Source verification:** Supabase CLI v3.0.0 `apps/cli/src/command-internal/migration-apply.ts` chooses sequential execution when it finds `hasTransactionControl`; otherwise it batches the SQL plus `INSERT_MIGRATION_VERSION` transactionally. `migration up` uses `findPendingMigrations` to reject missing historical versions. `migration fetch` reads `schema_migrations` and writes fetched SQL files locally only. Sources: [CLI v3.0.0 migration apply](https://github.com/supabase/cli/blob/v3.0.0/apps/cli/src/command-internal/migration-apply.ts), [migration fetch](https://github.com/supabase/cli/blob/v3.0.0/apps/cli/src/command-internal/migration-fetch-run.ts), [migration up](https://github.com/supabase/cli/blob/v3.0.0/apps/cli/src/commands/migration/up/up.handler.ts).

## 4. Isolated native CLI rehearsal

[Native AG34-H3 disposable CI run 43067604744](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43067604744) **PASS** with Supabase CLI v3.0.0:

1. Seeded a *separate* local database with **82 invented applied historical migration entries** and the source-attested AG3.4B role/RLS fixture. No actual hosted migration SQL was retrieved in CI.
2. `supabase migration fetch --remote=postgresql://postgres:postgres@127.0.0.1:54322/postgres` recovered exactly 82 invented applied files in another unlinked temporary workspace.
3. With only H3 as the 83rd file, a deliberately inserted `SELECT 1/0` after the policy change made `supabase migration up` fail. **All four old policies, existing grants and 82 migration versions remained unchanged.**
4. Replaced the injected file with the exact H3 reviewed migration. The CLI applied **exactly one** new migration, wrote version **`20261111165330`** and name, kept the prior 82 ledger entries unchanged, and passed lockdown read-only postflight.
5. Repeated `migration up` was a no-op (83 entries still), real signed-JWT Coach/Parent/Owner/SA/anon direct legacy access was denied, and modern Coach assignment batch reads continued to pass.
6. Scratch Supabase and temporary fetched migration files were removed.

This is strong evidence for the execution mechanism, **not** proof that all 82 real historical statements would replay safely. There is no plan to replay them.

## 5. Operator procedure — preparation only until separate approval

**Only the read-only/fetch steps are authorized by this design review.** Hosted migration execution is a separate product-owner decision.

1. Obtain an independently reviewed snapshot/backup and recent Security Advisor output. Freeze unrelated schema deployments for the planned change window. Confirm `acadpro-db`, expected project ref, `payment-module-finalization` commit and Supabase CLI **v3.0.0**. No hosted credentials in GitHub Actions.
2. Run the existing **read-only** `supabase/security_remediation_proposals/ag34_h2_read_only_hosted_preflight.sql`; require `READY_FOR_SEPARATE_PRODUCTION_APPROVAL`. Check the historical 82-version fingerprint again with:

   ```sql
   SELECT count(*) AS versions,
          md5(string_agg(version || ':' || name, '|' ORDER BY version)) AS names_md5,
          md5(string_agg(version || ':' || coalesce(name,'') || ':' ||
              md5(array_to_string(statements,chr(31))), '|' ORDER BY version)) AS sql_md5
     FROM supabase_migrations.schema_migrations;
   ```
   
   Expected: count **82**, names `09dcece659f31b05aa7db67c05374e44`, SQL `8078e33fce865d46766ac894213d1e07`. Any mismatch: **STOP; recapture and review**. Never auto-update expected digests in response to a failed check.
3. Using a securely stored local database login, in a freshly created **unlinked** temporary folder **outside Git**, run:

   ```powershell
   supabase --version
   supabase init --yes
   supabase migration fetch --remote=ulyealhkmlorsbdiknrh
   ```

   Do **not** run `migration fetch` from the actual repository: CLI may overwrite its `supabase/migrations` directory. The temporary SQL files may contain sensitive one-off historical SQL.
4. Validate the workspace offline from the **repository code** (after the H3 PR is merged):

   ```powershell
   python <REPO_PATH>/scripts/devbot/ag34_h3_operator_workspace_gate.py --workspace <TEMP_WORKSPACE> --phase fetched
   ```

   It must say **82** historical versions and **0** new migrations. Then manually copy the **one exact** `<REPO_PATH>/supabase/migrations/20261111165330_ag34_h1_legacy_coach_batches_client_lockdown.sql` into `<TEMP_WORKSPACE>/supabase/migrations/`. Re-run the gate with `--phase staged`; it must say **82 historic + 1 pending** and byte-verify the reviewed file.
5. Run `supabase migration list --remote=ulyealhkmlorsbdiknrh` **from that temporary workspace**, inspect that exactly **82 previously applied versions match**, that only `20261111165330` is local-only and that no unrelated migration is pending. If the CLI asks to repair or include-all, **STOP**; never use those options.
6. **STOP HERE BEFORE APPLYING.** Obtain explicit Product Owner approval identifying the single version, guarded SQL, production target, operator, change window and safe emergency downshift. Ensure a reliable database connection and concurrent-deployment freeze.

Only after such approval, the designated operator may run the **single** command below from the already verified temp workspace, allowing CLI's confirmation prompt and inspecting its target/migration count:

```powershell
supabase migration up --remote=ulyealhkmlorsbdiknrh
```

Do **not** use `--include-all`, `--yes` in unattended CI, `db push`, `migration repair` or manually execute the SQL outside the transaction-owning CLI engine.

## 6. After-deploy verification and incident safeguards

- Rerun `supabase migration list --remote=ulyealhkmlorsbdiknrh` from the same isolated workspace. The new version must be recorded exactly once. Query count: **83**; the original 82 metadata/SQL fingerprint must remain unchanged, with the new entry excluded from the hash.
- Run the **read-only** `ag34_h2_read_only_hosted_postflight.sql`; require `PASS_POLICY_LOCKDOWN`, five policies and no direct client grants. Check modern `coach_batch_assignments` count against the immediate preflight snapshot (11 was the historical checkpoint, not an invariant).
- Review the Supabase Security Advisor baseline and run manual Owner/Coach/Parent/Super Admin browser regression for active assignments and Parent/Coach portals; no live mutation probes that create unauthorized data.
- If the CLI fails or the connection drops, **do not retry blindly**. Inspect migration version and policy/grant state read-only: unchanged 82/four old policies means no successful migration; 83/five policies means deployed; any mixed/unknown state requires incident review.
- The guarded `ag34_h2_emergency_grants_only_downshift.sql` was rehearsed *only in scratch*; use on hosted only by a separately approved incident-response decision and **never re-grant legacy direct client access**.
- Destroy the temporary workspace safely when the release record is complete. Do **not** publish its historic SQL files or persist secrets.

## 7. Status and outstanding blockers

| Item | State |
| --- | --- |
| 82 migrations have remotely stored SQL for fetch | **READ-ONLY VERIFIED** |
| H3 CLI-managed atomic transaction version | **IMPLEMENTED / SCRATCH TESTED** |
| 82 historical entries + 1 new version mechanism | **SCRATCH NATIVE CI PASS** |
| Offline exact 82 filename manifest gate | **IMPLEMENTED / STATIC TESTED** |
| Historical source provenance / B3 replay | **UNRESOLVED** (ledger statements are not proof of original Git files) |
| Live H3 DDL, new version entry, app browser QA | **NOT EXECUTED** |
| Coach mapping HIGH-001 in hosted environment | **OPEN** |
| Overall AG3.4E production release | **NO-GO** |

**No standing GitHub PR approval authorizes the hosted SQL command.**
