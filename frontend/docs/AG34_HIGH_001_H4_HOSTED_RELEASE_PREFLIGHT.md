# AG34-H4 — Hosted Coach mapping lockdown: preflight and operator handoff

**Prepared:** 11 November 2026. **State:** read-only hosted preflight complete; safety script staged; **no hosted SQL/migration execution**.  
**Project:** `acadpro-db` (`ulyealhkmlorsbdiknrh`), Supabase organization plan **Free**, database region `ap-south-1`.  
**Approved target file:** `supabase/migrations/20261111165330_ag34_h1_legacy_coach_batches_client_lockdown.sql` on `payment-module-finalization`; no other migration is approved.  
**Production status:** **AG34-HIGH-001 OPEN; AG3.4E NO-GO**.

## 1. Live read-only verification (done)

The exact checked-in [H2 preflight SQL](../../supabase/security_remediation_proposals/ag34_h2_read_only_hosted_preflight.sql) was executed using connected Supabase read-only SQL and returned **`READY_FOR_SEPARATE_PRODUCTION_APPROVAL`**:

- 82 recorded historical versions; target version `20261111165330` absent.
- The 82 version/name digest is `09dcece659f31b05aa7db67c05374e44`, and stored history SQL digest is `8078e33fce865d46766ac894213d1e07`. All 82 stored SQL statements arrays present; no unsafe names/versions.
- `coach_batches` is **empty (0 rows)**, RLS enabled; all four original policies match the source-attested fingerprints; old authenticated CRUD and anon SELECT remain granted.
- Legacy helper functions unchanged; active `coach_batch_assignments` RLS enabled and **11** live records at this checkpoint.
- Read-only [H2 postflight](../../supabase/security_remediation_proposals/ag34_h2_read_only_hosted_postflight.sql) returned **`STOP_INVESTIGATE_NO_REGRANTS`** (expected because the fix is not yet deployed).
- The Supabase Security Advisor baseline still shows 14 authenticated-callable SECURITY DEFINER function warnings, two RLS-no-policy informational notices and one leaked-password-protection warning. These are **separate, unresolved** from HIGH-001.

**Every live preflight must be repeated immediately before a rollout.** Do not update expected manifest hashes automatically to accommodate drift.

## 2. Blocking operational constraints

The **Supabase Free** plan has no guaranteed scheduled backups; [Supabase Backup documentation](https://supabase.com/docs/guides/platform/backups) advises regular CLI exports for Free users. A local logical export is only an *evidence artifact*, not necessarily a verified full restore; before executing hosted DDL, the product owner/operator must confirm backup files are complete, protected and usable and that the recovery procedure is feasible. Database backup alone does **not** restore underlying Storage objects. Sensitive Auth/player records must never be uploaded to GitHub, ChatGPT or CI artifacts.

The connected Supabase `apply_migration` tool takes only a migration **name** and SQL, and **cannot specify the committed 14-digit version** `20261111165330`. The connected `execute_sql` call directly runs SQL **without automatically preserving the exact migration ledger version**. Neither satisfies our reviewed H3 atomic CLI/ledger mechanism, so **do not substitute these tools** or manually alter the ledger.

The connected GitHub tool can change code, but has **no privileged access to the operator's Windows terminal or hosted CLI credentials**. The approved production execution must therefore occur through an attended Supabase CLI v3.0.0 session operated in a protected local terminal, after backup and the exact single-version gate.

## 3. Windows operator: safe preparation (no remote DDL)

Run in **Windows PowerShell**, not Git Bash; replace the repository directory with your actual local checkout. Do **not** paste or send credentials or SQL dump files.

```powershell
cd "$HOME\Documents\acadpro-app"
git switch payment-module-finalization
git pull --ff-only origin payment-module-finalization
supabase --version
supabase login
.\scripts\devbot\ag34_h4_prepare_hosted_release.ps1
```

Script: `scripts/devbot/ag34_h4_prepare_hosted_release.ps1`. It **stops on dirty/unexpected Git checkout, wrong project/version, wrong Supabase CLI version, missing Python, failed backup, extra migration or mismatch of the 82-version manifest**. It creates a random private directory under `%LOCALAPPDATA%\Kheltriva\` and does the following only:

1. `supabase db dump --remote=ulyealhkmlorsbdiknrh --schema public,auth,storage,supabase_migrations --file <PRIVATE_SCHEMA_FILE>`.
2. `supabase db dump --remote=ulyealhkmlorsbdiknrh --schema public,auth,storage,supabase_migrations --data-only --file <PRIVATE_DATA_FILE>`.
3. Verify both outputs exist and are nonempty, compute SHA256 checksums. **Backups are not automatically restore-validated.**
4. In an **unlinked** throwaway CLI folder: `supabase init --yes`, then `supabase migration fetch --remote=ulyealhkmlorsbdiknrh`. This reads remote migration history and writes historical SQL **only to the private local folder**. It does **not** replay any of it.
5. Run [H3 operator gate](../../scripts/devbot/ag34_h3_operator_workspace_gate.py) twice: first require **82 historical/0 pending**, then copy the single approved canonical file into the temp migration folder and require **82 historical/1 pending** plus exact bytes.
6. Run `supabase migration list --remote=ulyealhkmlorsbdiknrh`, review output and **STOP**. The PowerShell script intentionally includes **no hosted `migration up` command or other DDL**.

If any step fails, do **not** apply SQL or retry blindly. Preserve error text without exposing secrets and investigate. If Supabase CLI needs Docker, a password or an interactive sign-in, complete it locally through the official prompt; **never send a credential into chat**.

## 4. Explicit deployment gate — not yet satisfied

Before a human executes the actual hosted migration:

- Verify the backup is sufficiently complete and that a restoration strategy exists; do not mistake a file-size check for recovery readiness.
- Freeze unrelated schema changes, choose an operator/change window, and repeat the read-only H2 preflight and 82-version SQL fingerprint check.
- Review the `migration list` from the **private unlinked workspace**. Reject any extra pending historical migration, missing history, `migration repair` recommendation or `--include-all` requirement.
- Verify that only the exact `20261111165330_ag34_h1_legacy_coach_batches_client_lockdown.sql` file is staged and matches GitHub; require the operator gate `--phase staged` PASS immediately before executing.
- Obtain explicit product-owner approval for **this exact hosted DDL** with backup/rollback preparedness; repository PR approval alone does not count.

Once those checks pass, the attended operator follows [H3 single-migration runbook](AG34_HIGH_001_H3_SINGLE_MIGRATION_DEPLOYMENT_MECHANISM.md) and runs **only one** `supabase migration up --remote=ulyealhkmlorsbdiknrh` command from the verified isolated workspace. It must be reviewed interactively. Do not use `db push` from the normal checkout, `migration repair`, `--include-all` or direct migrations-table edits.

## 5. Live postflight and manual role regression (pending)

After a separately approved hosted execution:

1. Verify new ledger count **83** and version `20261111165330` recorded exactly once; original 82 names/source digests unchanged (excluding target version).
2. Repeat the checked-in read-only H2 postflight. It must return `PASS_POLICY_LOCKDOWN`: **five** legacy policies and no anon/authenticated direct table grants; the zero-row legacy table, private helper definitions and active Coach mapping preserved.
3. Repeat Security Advisor; expect unrelated baseline warnings to remain separately tracked.
4. Academy Owner manually tests create/edit/deactivate modern Coach mapping; Coach tests assigned active batches; Parent tests parent-facing Coach info and training schedule; Super Admin tests cross-academy modern assignments. Verify no attendance/player/finance regression.
5. If CLI fails, do **not** blindly retry. Read-only compare ledger version and policy/grant state, then decide incident response. Emergency downshift is **not automatic**, preserves revoked grants, and requires separate approval.

## 6. Status contract

| Item | Status |
| --- | --- |
| Live source, policy and history preflight | **PASS, read-only** |
| H3 isolated single-version native JWT + CLI atomicity | **PASS** (PR #20) |
| H4 Windows backup/fetch preparation script | **STAGED; CI static validation** |
| Actual private live backup file and restore assurance | **NOT PERFORMED HERE** |
| Hosted CLI versioned migration execution | **NOT PERFORMED** |
| Live postflight and 4-role manual QA | **PENDING** |
| Production vulnerability AG34-HIGH-001 | **OPEN** |
| Overall AG3.4E release | **NO-GO** |

Never mark the hosted security finding CLOSED merely because GitHub CI passes, a script was committed or a preflight is green.
