# B2.9-C3.3B — Local native Supabase helper installation checkpoint

**C3.3A verified by Owner (11 November 2026):** SQL transaction COMMIT and outcome 5|2|0|0|t on isolated local container supabase_db_kheltriva-b29-disposable.

**C3.3B scope:** install the unchanged 11-current-state-helper snapshot, NOT original historical migrations, into that local scratch database after verifying exact fixture state. Never run the old B2.9 mock auth.uid() preconditions on the native local Supabase instance.

Run precheck SQL, pinned helper SQL and postcheck SQL in one PostgreSQL `psql -X --single-transaction -v ON_ERROR_STOP=1` command. The precheck rejects nonempty Auth, existing private schema, and wrong RLS/grants. It stores native auth.uid() OID and SHA256 in a temporary transaction-local table. Postcheck confirms native auth.uid() unchanged, exactly 11 functions with pinned SHA256 hashes, owner, SECURITY DEFINER, STABLE volatility, search paths, effective EXECUTE and private schema USAGE; verifies absent-JWT actor gets no role/academy/batch authorization. All postcheck failures roll back the complete function installation.

**CI scope:** Static validation plus existing synthetic PostgreSQL 17 B2.9 helper/RLS tests. This does not prove the new SQL executed against actual native Supabase; Owner must run once inside the scratch container and report the result.

**Still pending:** real local Supabase Auth-issued session tests; storage, finance, full 82-migration historical replay and 35 B3.6 runtime scenarios; B4 billing remains blocked. No canonical migration or production database changes.

## Owner local execution command (not run by ChatGPT)

Run from the isolated `kheltriva-b29-disposable` workspace on Windows, after pulling clean `payment-module-finalization`. Use this exact container and these exact three SQL files in **one atomic** PostgreSQL transaction (not a hosted database URL):

```powershell
$repo = Join-Path $HOME 'Documents\acadpro-app'
$container = 'supabase_db_kheltriva-b29-disposable'
if ((Get-Location).Path -ne (Join-Path $HOME 'Documents\kheltriva-b29-disposable')) { throw 'Wrong workspace' }
if (git -C $repo status --porcelain) { throw 'Repo has uncommitted edits' }
git -C $repo pull --ff-only origin payment-module-finalization
if ($LASTEXITCODE -ne 0) { throw 'Pull failed' }
$health = docker inspect -f '{{.State.Health.Status}}' $container
if ($LASTEXITCODE -ne 0 -or $health.Trim() -ne 'healthy') { throw 'Wrong/unhealthy database container' }
$src = Join-Path $repo 'supabase\tests\subscriptions'
$files = @('ps_l2_3_b2_9_c33b_precheck.sql', 'ps_l2_3_b2_9_live_helper_snapshot.sql', 'ps_l2_3_b2_9_c33b_postcheck.sql')
foreach ($name in $files) {
  docker cp (Join-Path $src $name) "${container}:/tmp/$name"
  if ($LASTEXITCODE -ne 0) { throw "Copy failed: $name" }
}
docker exec $container psql -U postgres -d postgres -X --single-transaction -v ON_ERROR_STOP=1 -f /tmp/ps_l2_3_b2_9_c33b_precheck.sql -f /tmp/ps_l2_3_b2_9_live_helper_snapshot.sql -f /tmp/ps_l2_3_b2_9_c33b_postcheck.sql
if ($LASTEXITCODE -ne 0) { throw 'Atomic helper installation rejected; stop for review' }
```

**Note:** The long docker exec/psql command deliberately uses one line to work in Windows PowerShell. A single transaction is essential: never run the precheck and snapshot separately. Expected successful output ends in `C3.3B CURRENT HELPERS VERIFIED|11|2|0|t` (formatting may vary) and `COMMIT`.

**C3.3B native local execution remains NOT RUN until Owner logs prove it.**
