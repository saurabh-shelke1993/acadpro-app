# Kheltriva B2.9-C2: READ-ONLY local Supabase environment preflight.
# Nonhistorical disposable reconstruction TESTING ONLY.
# Does NOT start Docker, start/stop Supabase, execute SQL, reset databases,
# generate migrations, contact hosted Supabase, or print secrets.
param([string]$RepoRoot = ".")

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath $RepoRoot).Path
$planFile = Join-Path $root "supabase\recovery\historical-baseline\b3_6_disposable_plan_20261111.json"
$sourceFile = Join-Path $root "supabase\tests\subscriptions\ps_l2_3_b2_9_live_helper_snapshot_manifest.json"
$protected = Join-Path $root "supabase\recovery\historical-baseline\.recovery-private\baseline-b3-4-001"

if (-not (Test-Path -LiteralPath $planFile -PathType Leaf)) {
    throw "B3.6 fail-closed review plan missing."
}
if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
    throw "B2.9 pinned helper manifest missing."
}
$plan = Get-Content -LiteralPath $planFile -Raw | ConvertFrom-Json
$source = Get-Content -LiteralPath $sourceFile -Raw | ConvertFrom-Json

if ($plan.schema -ne "kheltriva-b3-6-review-only-v1" -or
    $plan.source_version_count -ne 82 -or
    $plan.source_element_count -ne 168 -or
    $plan.quarantined_version_count -ne 14) {
    throw "Historical source metadata changed; stop for review."
}
if ($source.source_type -ne "live-current-state-not-historical" -or
    $source.authoritative_historical_provenance -ne $false -or
    $source.production_replay_approved -ne $false -or
    @($source.functions).Count -ne 11) {
    throw "B2.9 helper provenance/approval guard failed."
}
if ($plan.guards.ready_for_disposable_replay -ne $false -or
    $plan.guards.ready_for_production -ne $false) {
    throw "B3.6 approval flags unexpectedly changed; do not proceed."
}

$git = Get-Command git -ErrorAction SilentlyContinue
$docker = Get-Command docker -ErrorAction SilentlyContinue
$supabase = Get-Command supabase -ErrorAction SilentlyContinue

$branch = "unknown"
if ($null -ne $git) {
    try {
        $result = & $git.Source -C $root branch --show-current 2>$null
        if ($LASTEXITCODE -eq 0 -and $result) { $branch = "$result".Trim() }
    } catch {}
}
$dockerRunning = $false
if ($null -ne $docker) {
    try {
        $version = & $docker.Source info --format "{{.Server.Version}}" 2>$null
        $dockerRunning = ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace("$version"))
    } catch {}
}
$cliVersion = "not-installed"
if ($null -ne $supabase) {
    try {
        $version = & $supabase.Source --version 2>$null
        if ($LASTEXITCODE -eq 0 -and $version) { $cliVersion = "$version".Trim() }
    } catch {}
}

# Safe output: boolean checks only; no private paths, original SQL,
# user/customer identifiers, payment values, keys or tokens.
[PSCustomObject]@{
    checkpoint = "B2.9-C2 read-only local preflight"
    git_branch = $branch
    git_branch_expected = ($branch -eq "payment-module-finalization")
    private_archive_folder_present = (Test-Path -LiteralPath $protected -PathType Container)
    docker_cli_installed = ($null -ne $docker)
    docker_engine_running = $dockerRunning
    supabase_cli_version = $cliVersion
    nonhistorical_helper_count = @($source.functions).Count
    original_versions_expected = $plan.source_version_count
    historical_elements_expected = $plan.source_element_count
    quarantines_remain = $plan.quarantined_version_count
    runnable_history_approved = $false
    full_supabase_replay_completed = $false
    production_changes_authorized = $false
} | ConvertTo-Json -Depth 4

# No database is started or modified by this script.
