# B2.9-C3.4B1 — one real local GoTrue Academy Owner A plus synthetic role mapping.
# RUN ONCE only in C:\Users\<current>\Documents\kheltriva-b29-disposable.
# No credentials, JWT or API keys are printed or saved. No hosted Supabase.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$expected = Join-Path $HOME 'Documents\kheltriva-b29-disposable'
$repo = Join-Path $HOME 'Documents\acadpro-app'
$container = 'supabase_db_kheltriva-b29-disposable'
$api = 'http://127.0.0.1:54321'
$mappingFile = Join-Path $repo 'supabase\tests\subscriptions\ps_l2_3_b2_9_c34b1_owner_a_mapping.sql'

if ((Get-Location).Path -ne $expected) { throw 'C3.4B1: wrong workspace; stop' }
if (-not (Test-Path -LiteralPath (Join-Path $expected 'supabase\config.toml'))) {
 throw 'C3.4B1: scratch Supabase configuration missing'
}
if (-not (Test-Path -LiteralPath $mappingFile)) {
 throw 'C3.4B1: mapping fixture not present, pull approved Git branch'
}
$config = Get-Content -LiteralPath (Join-Path $expected 'supabase\config.toml') -Raw
$emailSection = [regex]::Match($config, '(?ms)^\[auth\.email\]\s*\r?\n(?<body>.*?)(?=^\[|\z)')
if (-not $emailSection.Success -or
 $emailSection.Groups['body'].Value -notmatch '(?m)^\s*enable_confirmations\s*=\s*false\b') {
 throw 'C3.4B1: local email confirmations must remain off'
}

$health = & docker inspect -f '{{.State.Health.Status}}' $container
if ($LASTEXITCODE -ne 0 -or "$health".Trim() -ne 'healthy') {
 throw 'C3.4B1: expected local PostgreSQL container unhealthy'
}
$stateSql = "SELECT (SELECT count(*) FROM auth.users),(SELECT count(*) FROM public.users),(SELECT count(*) FROM public.coaches),(SELECT count(*) FROM public.coach_batches),(SELECT count(*) FROM public.coach_batch_assignments),(SELECT count(*) FROM public.batches),(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private');"
$stateBefore = (& docker exec $container psql -U postgres -d postgres -X -At -c $stateSql | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $stateBefore -ne '1|0|0|0|0|2|11') {
 throw 'C3.4B1: unexpected scratch schema or existing account mappings; stop'
}
$smokeCount = (& docker exec $container psql -U postgres -d postgres -X -At -c "SELECT count(*) FROM auth.users WHERE email LIKE 'b29-c34a-%@example.test';" | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $smokeCount -ne '1') {
 throw 'C3.4B1: original synthetic smoke Auth user not found; stop'
}

# CLI status is captured in memory and must not be printed (contains keys).
$statusText = (& npx.cmd --yes supabase@3.0.0 status -o env | Out-String)
if ($LASTEXITCODE -ne 0) { throw 'C3.4B1: local CLI status failed' }
$urlMatch = [regex]::Match($statusText, '(?m)^API_URL="?([^"\r\n]+)"?\s*$')
$keyMatch = [regex]::Match($statusText, '(?m)^PUBLISHABLE_KEY="?(sb_publishable_[A-Za-z0-9_-]+)"?\s*$')
if (-not $urlMatch.Success -or -not $keyMatch.Success -or
 $urlMatch.Groups[1].Value -ne $api) {
 throw 'C3.4B1: status URL/key does not match local-only configuration; stop'
}
$publishable = $keyMatch.Groups[1].Value

try {
 $r = Invoke-WebRequest -Uri "$api/auth/v1/health" -UseBasicParsing
 if ($r.StatusCode -ne 200) { throw 'Local Auth health is not 200' }
} catch {
 throw 'C3.4B1: local Auth API health failed before signup'
}

$nonce = [guid]::NewGuid().ToString('N').Substring(0,12)
$email = "b29-c34b1-ao-a-$nonce@example.test"
$password = [guid]::NewGuid().ToString('N') + 'Aa9!'
$body = @{ email=$email; password=$password } | ConvertTo-Json -Compress

try {
 $session = Invoke-RestMethod -Method Post -Uri "$api/auth/v1/signup" -Headers @{ apikey=$publishable } -ContentType 'application/json' -Body $body
 if (-not $session.access_token -or -not $session.user.id) {
  throw 'Auth did not issue a session'
 }
 $signedIn = Invoke-RestMethod -Method Get -Uri "$api/auth/v1/user" -Headers @{
  apikey = $publishable
  Authorization = "Bearer $($session.access_token)"
 }
 if ($signedIn.id -ne $session.user.id -or $signedIn.email -ne $email) {
  throw 'GoTrue session identity mismatch'
 }
 $id = [guid]::Parse([string]$signedIn.id)
} catch {
 throw 'C3.4B1: GoTrue request failed. A synthetic Auth user might exist; STOP, never retry automatically. Do not share tokens.'
}

# Local GoTrue has already created the Auth row. psql now binds that exact UUID.
# The SQL file has its own transaction precheck and rollback postcheck.
& docker cp $mappingFile ($container + ':/tmp/b29_c34b1_owner_a_mapping.sql') | Out-Null
if ($LASTEXITCODE -ne 0) {
 throw 'C3.4B1: fixture copy failed after signup; STOP, do not retry'
}
$mappingResult = (& docker exec $container psql -U postgres -d postgres -X --single-transaction -v ON_ERROR_STOP=1 -v ("owner_uuid=" + $id.ToString()) -f /tmp/b29_c34b1_owner_a_mapping.sql 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $mappingResult -notmatch 'B2\.9-C3\.4B1 OWNER A MAPPING VERIFIED') {
 throw 'C3.4B1: mapping SQL did not complete. Auth user may exist without mapping; STOP and inspect, do not retry.'
}

$stateAfter = (& docker exec $container psql -U postgres -d postgres -X -At -c $stateSql | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $stateAfter -ne '2|1|0|0|0|2|11') {
 throw 'C3.4B1: unexpected persisted database state; STOP and inspect'
}
$mappingCheck = (& docker exec $container psql -U postgres -d postgres -X -At -v ("owner_uuid=" + $id.ToString()) -c "SELECT count(*) FROM public.users u WHERE u.id=:'owner_uuid'::uuid AND u.role='academy_owner' AND u.academy_id='a0000000-0000-4000-8000-000000000001'::uuid;" | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $mappingCheck -ne '1') {
 throw 'C3.4B1: role mapping not persisted; STOP'
}

[pscustomobject]@{
 checkpoint = 'B2.9-C3.4B1 Owner A local Auth + app mapping'
 result = 'PASS'
 synthetic_role = 'academy_owner'
 synthetic_academy = 'Academy A'
 synthetic_auth_user_id = $id.ToString()
 local_auth_users = 2
 local_app_users = 1
 synthetic_batches = 2
 current_state_helpers = 11
 role_mapping_fk_verified = $true
 actual_auth_session_verified = $true
 rls_cross_tenant_tested = $false
 production_modified = $false
} | ConvertTo-Json
