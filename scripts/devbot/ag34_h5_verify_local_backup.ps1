# AG34-H5 Windows local-only backup verification; NO hosted database changes.
# Existing H4 SQL files stay under LOCALAPPDATA and are never uploaded/printed.
# This verifies SQL hashes/critical table coverage and obtains a separate
# role-only snapshot. It DOES NOT prove a full database restore.
[CmdletBinding()]
param(
    [string]$ReleaseRoot,
    [string]$SchemaSha256,
    [string]$DataSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$referenceProject = 'ulyealhkmlorsbdiknrh'
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$inspector = Join-Path $sourceRoot 'scripts/devbot/ag34_h5_backup_inspector.py'
if (-not (Test-Path $inspector)) {
    throw 'AG34-H5 STOP: local backup inspector missing'
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw 'AG34-H5 STOP: Python 3 not available'
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    throw 'AG34-H5 STOP: Supabase CLI 3.0.0 unavailable. Enable pinned CLI in current PowerShell window.'
}
$cliVersion = (& supabase --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $cliVersion -notmatch '^3\.0\.0($|\s)') {
    throw 'AG34-H5 STOP: use tested Supabase CLI v3.0.0'
}
if (-not $env:LOCALAPPDATA) {
    throw 'AG34-H5 STOP: local user-private APPDATA missing'
}
$allowedRoot = (Join-Path $env:LOCALAPPDATA 'Kheltriva')
if (-not (Test-Path $allowedRoot)) { throw 'AG34-H5 STOP: H4 private backup folder missing' }
if (-not $ReleaseRoot) {
    $all = @(Get-ChildItem -LiteralPath $allowedRoot -Directory -Filter 'AG34-H4-*')
    if ($all.Count -ne 1) {
        throw 'AG34-H5 STOP: specify -ReleaseRoot from H4 output (multiple or no H4 workspaces)'
    }
    $ReleaseRoot = $all[0].FullName
}
$release = (Resolve-Path -LiteralPath $ReleaseRoot -ErrorAction Stop).Path
$expectedPrefix = [System.IO.Path]::GetFullPath($allowedRoot).TrimEnd([char]'\') + '\'
if (-not $release.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase) -or
    -not (Split-Path -Leaf $release).StartsWith('AG34-H4-', [StringComparison]::Ordinal)) {
    throw 'AG34-H5 STOP: release root is not an H4 local private workspace'
}
$backup = Join-Path $release 'backup'
$schemaFile = Join-Path $backup 'schema_public_auth_storage_migrations.sql'
$dataFile = Join-Path $backup 'data_public_auth_storage_migrations.sql'
if (-not (Test-Path -LiteralPath $schemaFile) -or -not (Test-Path -LiteralPath $dataFile)) {
    throw 'AG34-H5 STOP: both original H4 export files are required'
}
if (-not $SchemaSha256) {
    $SchemaSha256 = Read-Host 'Paste SCHEMA SHA256 from original H4 output'
}
if (-not $DataSha256) {
    $DataSha256 = Read-Host 'Paste DATA SHA256 from original H4 output'
}
if ($SchemaSha256 -notmatch '^[0-9a-fA-F]{64}$' -or $DataSha256 -notmatch '^[0-9a-fA-F]{64}$') {
    throw 'AG34-H5 STOP: original SHA256 values must contain exactly 64 hex characters'
}
# The read-only role export complements H4's two exports; role snapshots are
# captured at a later point in time and are not a transactional 3-file snapshot.
$rolesFile = Join-Path $backup 'roles.sql'
if (-not (Test-Path -LiteralPath $rolesFile)) {
    Write-Host 'AG34-H5: Capturing private roles-only logical export (remote READ only).'
    & supabase db dump ('--remote=' + $referenceProject) --role-only --file $rolesFile
    if ($LASTEXITCODE -ne 0) {
        throw 'AG34-H5 STOP: roles-only read-only export failed'
    }
}
& python $inspector --backup-directory $backup --schema-sha256 $SchemaSha256 --data-sha256 $DataSha256
if ($LASTEXITCODE -ne 0) {
    throw 'AG34-H5 STOP: original H4 hash/critical table coverage check failed'
}
Write-Host 'AG34-H5 ROLES: private export present; complete recovery NOT proven.'
Write-Host 'AG34-H5 STOP: physical Storage objects and isolated restore rehearsal remain unverified.'
Write-Host 'No hosted migration or DDL was executed. Share only these PASS/STOP summary lines.'
