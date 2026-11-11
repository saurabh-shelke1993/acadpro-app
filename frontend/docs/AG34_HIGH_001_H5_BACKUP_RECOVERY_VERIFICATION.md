# AG34-H5 — Private database backup integrity and recovery verification

**Date:** 11 November 2026  
**Target:** Supabase `acadpro-db` (`ulyealhkmlorsbdiknrh`) on Free plan  
**Phase status:** local verification utility implemented; actual H4 private files are on the product owner's Windows computer and **are not accessible to GitHub, CI or ChatGPT**. Restore is **NOT verified** until a genuinely isolated restore and application recovery test pass.  
**Production:** AG34-HIGH-001 remains **OPEN**, AG3.4E remains **NO-GO**, and no hosted migration is authorized.

## 1. What H4 proved — and what it did not

The operator shared a successful `AG34-H4 STOP: PREPARATION COMPLETE, NO HOSTED DDL EXECUTED` output, including SHA256 of two files in a private `LOCALAPPDATA/Kheltriva/AG34-H4-...` directory:

- `backup/schema_public_auth_storage_migrations.sql`
- `backup/data_public_auth_storage_migrations.sql`

It also populated an isolated CLI workspace with the original 82 remote recorded migrations and staged exactly one source-matched pending migration, version `20261111165330`.

**File creation, a hash printed at backup time, and migration fetch do not establish backup recoverability.** H4 used separate sequential `db dump` calls: the schema and data files were not captured under a guaranteed common PostgreSQL snapshot. H4 did **not** create a separate `--role-only` dump. It also did not export the physical bytes of Storage objects, so recovering only the SQL cannot recover uploaded player and academy images. These limitations must remain visible in release decisions.

## 2. Live read-only evidence used to assess coverage

A new **read-only** query on the hosted database returned these snapshot counts. These are indicators for required nonempty table coverage, **not** exact restored-row targets after concurrent user activity:

| Relation | Snapshot rows |
| --- | ---: |
| `public.academies` | 5 |
| `public.players` | 51 |
| `public.coach_batch_assignments` | 11 |
| `auth.users` | 8 |
| `storage.objects` | 9 (metadata, not object bytes) |
| `supabase_migrations.schema_migrations` | 82 |

The H5 inspector requires schema-definition and data-INSERT markers for **all six**. The inspector does not parse sensitive SQL literals, count records, send data to the network or execute SQL. It verifies that the **existing two H4 exports still match their original SHA256 hashes**; this detects changes or corruption since H4, but not an incomplete export that was already incomplete when first written.

## 3. Run H5.1 on the same Windows computer

After updating the `payment-module-finalization` branch with the H5 development PR, open **Windows PowerShell** and re-enable the pinned Supabase CLI 3.0.0 wrapper if necessary. Do not update to v3.1.0 during this deployment. The script may read roles from hosted Supabase via the already authenticated CLI; this is a **read-only** export.

```powershell
cd "$HOME\Documents\acadpro-app"
git switch payment-module-finalization
git pull --ff-only origin payment-module-finalization

# If supabase is not a recognized command in this PowerShell window:
function supabase { & npx.cmd --yes supabase@3.0.0 @args }

# If the current window blocks locally checked-out scripts:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force

.\scripts\devbot\ag34_h5_verify_local_backup.ps1
```

The script selects the sole `AG34-H4-*` workspace under `%LOCALAPPDATA%\Kheltriva`; if several H4 workspaces exist, supply **`-ReleaseRoot "<YOUR_H4_PRIVATE_WORKSPACE>"`** using the path printed by H4. It then requests the **original SCHEMA and DATA SHA256 strings** printed by H4 (each exactly 64 hexadecimal characters); paste them **only into your local prompt**. Never paste SQL, passwords or tokens in chat.

The script checks the original H4 files exist, fetches `roles.sql` privately with **`supabase db dump --role-only`** if missing, then calls `ag34_h5_backup_inspector.py`. The Python program validates **both original hashes**, SQL text/not-binary format, six critical table definitions, six nonempty table INSERT markers and a separate roles export.

A successful result is:

```text
AG34-H5 PASS: original SHA-256 integrity, six critical schema tables, six nonempty table export markers, roles export present.
AG34-H5 RECOVERY GATE: NOT VERIFIED — no isolated SQL restore executed.
AG34-H5 STORAGE: SQL metadata does not contain the underlying object files.
AG34-H5 STOP: NO HOSTED DDL OR MIGRATION EXECUTED.
```

**This is H5.1 integrity/coverage PASS only.** It is **not** a completed H5 backup-recovery signoff. If the scan fails, do not overwrite the original files to force a PASS. Inspect the reason privately and review a new complete snapshot/export strategy. Do not print or upload the contents of the dump.

## 4. H5.2 — Isolated restore proof (still required)

A proper restore test must occur in a **fresh, disposable Supabase-compatible PostgreSQL 17 environment** whose database connection is explicitly confirmed **local only**. The existing React development database, live Supabase, production `main`, and any other local named project's database must never be used as the destination.

The restore operator needs the private **roles + schema + data** files, as described in Supabase's [restore-to-self-hosted guide](https://supabase.com/docs/guides/self-hosting/restore-from-platform). A compatible bootstrapped Supabase environment and matching extensions/roles may be required. Merely importing a subset into vanilla PostgreSQL and calling it a full restore is **not** valid.

After initializing and inspecting an isolated destination:

1. Record its fresh local-only connection details and confirm it is a new disposable instance, not a linked hosted project. No production credentials are to be used as the destination.
2. Apply the *local* roles/schema/data files in the documented order using `psql --single-transaction --set ON_ERROR_STOP=1` against **only the inspected local destination**. Do not skip an import error or manually disable constraints to force a pass. Sensitive SQL must not enter CI logs or public artifacts.
3. Independently verify recovered **row counts and key foreign-key relationships** for `public.academies`, `public.players`, `public.coach_batch_assignments`, `auth.users`, and `storage.objects`, and migration ledger count/version/name. Compare the source and restored snapshot results, allowing for justified live changes after H4. Confirm RLS/policies and important helper functions are present. Verify the restored instance's settings and extensions.
4. Keep the restore separate from an application login test unless authentication secrets/providers and Storage objects are independently restored; SQL-only recovery is not a working full SaaS application.
5. Purge temporary data securely after documenting **sanitized PASS/STOP evidence only**. Never retain copies of user passwords/hashes, player medical data or personal information in the repo or chat.

If import fails due to differences between local Supabase-managed `auth`/`storage` schema and the exported definitions, **STOP** and investigate a purpose-built restore environment; do not weaken production or mark the backup verified. A fresh, known-restorable database snapshot and a documented restoration method are still required for release approval.

### Important limitations

- A `roles.sql` captured during H5 is later than the H4 schema/data exports and does **not** make the three dumps one transactionally consistent snapshot.
- Neither the SQL export nor `storage.objects` table restores actual files. At H4's snapshot, nine Storage metadata records existed; an actual Storage-object recovery strategy is independently required.
- Supabase Free has no automatic daily backup entitlement. These private logical exports must not be mistaken for managed PITR or a full backup.
- Even a successful local data restore cannot prove full production app recovery without Auth configuration, secrets, Storage file bytes, Edge Functions and environment configuration.

## 5. Release gate and evidence

| Gate | State |
| --- | --- |
| H4 schema and data exports reported by operator | **CREATED, hashes printed** |
| H5.1 local original checksum recheck | **PENDING USER EXECUTION** |
| H5.1 six-table schema/data and roles coverage | **PENDING USER EXECUTION** |
| H5.1 synthetic unit tests | **CI, not live backup verification** |
| H5.2 actual isolated full restore rehearsal | **PENDING** |
| Physical Storage object recovery | **PENDING** |
| AG34-H3 one-version migration CLI gate | **PREVIOUSLY SCRATCH TESTED, hosted unapplied** |
| Hosted security fix / user role manual QA | **NOT DEPLOYED / PENDING** |
| Security release gate | **AG34-HIGH-001 OPEN; AG3.4E NO-GO** |

**Do not run `supabase migration up` as part of H5 or treat H5.1 scanner PASS as full backup readiness.** No new hosted DDL, no version-history repair, no backup upload and no production release decision are authorized by this verification phase.
