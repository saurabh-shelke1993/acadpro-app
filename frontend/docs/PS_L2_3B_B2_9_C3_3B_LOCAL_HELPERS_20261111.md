# B2.9-C3.3B — Local native Supabase helper installation checkpoint

**C3.3A verified by Owner (11 November 2026):** SQL transaction COMMIT and outcome 5|2|0|0|t on isolated local container supabase_db_kheltriva-b29-disposable.

**C3.3B scope:** install the unchanged 11-current-state-helper snapshot, NOT original historical migrations, into that local scratch database after verifying exact fixture state. Never run the old B2.9 mock auth.uid() preconditions on the native local Supabase instance.

Run precheck SQL, pinned helper SQL and postcheck SQL in one PostgreSQL `psql -X --single-transaction -v ON_ERROR_STOP=1` command. The precheck rejects nonempty Auth, existing private schema, and wrong RLS/grants. It stores native auth.uid() OID and SHA256 in a temporary transaction-local table. Postcheck confirms native auth.uid() unchanged, exactly 11 functions with pinned SHA256 hashes, owner, SECURITY DEFINER, STABLE volatility, search paths, effective EXECUTE and private schema USAGE; verifies absent-JWT actor gets no role/academy/batch authorization. All postcheck failures roll back the complete function installation.

**CI scope:** Static validation plus existing synthetic PostgreSQL 17 B2.9 helper/RLS tests. This does not prove the new SQL executed against actual native Supabase; Owner must run once inside the scratch container and report the result.

**Still pending:** real local Supabase Auth-issued session tests; storage, finance, full 82-migration historical replay and 35 B3.6 runtime scenarios; B4 billing remains blocked. No canonical migration or production database changes.
