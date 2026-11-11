# Kheltriva B2.9-C3.4A — real LOCAL GoTrue/Auth session smoke.
# Disposable only. Never run in hosted Supabase or from the main repository.
# Creates ONE invented local Auth user via GoTrue, without touching app tables.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$expectedDirectory = Join-Path $HOME 'Documents\kheltriva-b29-disposable'
$container = 'supabase_db_kheltriva-b29-disposable'
$localUrl = 'http://127.0.0.1:54321'

if ((Get-Location).Path -ne $expectedDirectory) {
    throw 'C3.4A stopped: not in the isolated disposable workspace.'
}
if (-not (Test-Path -LiteralPath (Join-Path $expectedDirectory 'supabase\config.toml'))) {
    throw 'C3.4A stopped: disposable config.toml missing.'
}
$configText = Get-Content -LiteralPath (Join-Path $expectedDirectory 'supabase\config.toml') -Raw
$emailSection = [regex]::Match($configText, '(?ms)^\[auth\.email\]\s*\r?\n(?<body>.*?)(?=^\[|\z)')
if (-not $emailSection.Success -or
    $emailSection.Groups['body'].Value -notmatch '(?m)^\s*enable_confirmations\s*=\s*false\b') {
    throw 'C3.4A stopped: local email confirmations are not explicitly disabled.'
}

$health = & docker inspect -f '{{.State.Health.Status}}' $container
if ($LASTEXITCODE -ne 0 -or "$health".Trim() -ne 'healthy') {
    throw 'C3.4A stopped: expected disposable PostgreSQL is not healthy.'
}

# Every request must pass our local-state guard before synthetic account signup.
$stateQuery = "SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private'),(SELECT count(*) FROM public.batches),(SELECT count(*) FROM public.users),(SELECT count(*) FROM auth.users),to_regprocedure('auth.uid()') IS NOT NULL,has_schema_privilege('anon','private','USAGE'),has_schema_privilege('authenticated','private','USAGE');"
$preState = (& docker exec $container psql -U postgres -d postgres -X -At -c $stateQuery | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $preState -ne '11|2|0|0|t|f|t') {
    throw 'C3.4A stopped: expected exactly 11 helpers, two batches and no local Auth accounts. Do not retry.'
}

# Never print CLI status: even local status includes private keys.
$statusText = (& npx.cmd --yes supabase@3.0.0 status -o env | Out-String)
if ($LASTEXITCODE -ne 0) {
    throw 'C3.4A stopped: local Supabase status failed.'
}
$apiMatch = [regex]::Match($statusText,'(?m)^API_URL="?([^"\r\n]+)"?\s*$')
$keyMatch = [regex]::Match($statusText,'(?m)^PUBLISHABLE_KEY="?(sb_publishable_[A-Za-z0-9_-]+)"?\s*$')
if (-not $apiMatch.Success -or -not $keyMatch.Success) {
    throw 'C3.4A stopped: local publishable key or API URL is absent. Do not paste CLI status.'
}
if ($apiMatch.Groups[1].Value -ne $localUrl) {
    throw 'C3.4A stopped: API URL is not the local disposable endpoint.'
}
$publishableKey = $keyMatch.Groups[1].Value

try {
    $healthResponse = Invoke-WebRequest -Uri "$localUrl/auth/v1/health" -UseBasicParsing
    if ($healthResponse.StatusCode -ne 200) {
        throw 'Local Auth health endpoint did not return 200.'
    }
} catch {
    throw 'C3.4A stopped: local Auth health check failed; no account created.'
}

# Random invented identity. Credentials/tokens exist in memory only.
# Local confirmations are disabled; signup should return an Auth-issued session.
$nonce = [guid]::NewGuid().ToString('N').Substring(0,12)
$email = "b29-c34a-$nonce@example.test"
$password = ([guid]::NewGuid().ToString('N')) + 'Aa9!'
$payload = @{ email = $email; password = $password } | ConvertTo-Json -Compress

try {
    $signup = Invoke-RestMethod -Method Post -Uri "$localUrl/auth/v1/signup" -Headers @{ apikey = $publishableKey } -ContentType 'application/json' -Body $payload
    if (-not $signup.user.id -or -not $signup.access_token) {
        throw 'Local signup did not issue a session.'
    }
    $authUser = Invoke-RestMethod -Method Get -Uri "$localUrl/auth/v1/user" -Headers @{ apikey = $publishableKey; Authorization = "Bearer $($signup.access_token)" }
    if ($authUser.id -ne $signup.user.id) {
        throw 'Authenticated identity mismatch.'
    }
} catch {
    throw 'C3.4A Auth failed or returned unexpected data. A synthetic account may now exist; STOP. Do not retry without inspecting the local Auth user count. Never share tokens or keys.'
}

$postState = (& docker exec $container psql -U postgres -d postgres -X -At -c $stateQuery | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $postState -ne '11|2|0|1|t|f|t') {
    throw 'C3.4A post-state not as expected. STOP for review; do not retry.'
}

[pscustomobject]@{
    checkpoint = 'B2.9-C3.4A real local Auth session smoke'
    result = 'PASS'
    endpoint = $localUrl
    auth_issued_session_verified = $true
    synthetic_auth_user_id = [string]$authUser.id
    local_auth_users = 1
    app_users = 0
    current_state_helpers = 11
    synthetic_batches = 2
    historical_replay_performed = $false
    production_modified = $false
} | ConvertTo-Json
