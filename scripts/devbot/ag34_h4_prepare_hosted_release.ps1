# AG34-H4: Operator-only, read-only remote preparation on Windows PowerShell.
# Refuses to deploy; backs up live schemas/data into a PRIVATE user folder and
# fetches the 82 existing migration history entries into an UNLINKED temp project.
# Never commit, share, upload or archive the fetched SQL or database export.
[CmdletBinding()]
param(
    [string]$ProjectRef = 'ulyealhkmlorsbdiknrh',
    [string]$Version = '20261111165330'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Checked {
    param([string]$Label,[string[]]$Args)
    Write-Host ("AG34-H4: " + $Label)
    & supabase @Args
    if ($LASTEXITCODE -ne 0) { throw "AG34-H4 STOP: $Label failed" }
}

if ($ProjectRef -ne 'ulyealhkmlorsbdiknrh' -or $Version -ne '20261111165330') {
    throw 'AG34-H4 STOP: unexpected target or migration version'
}
if (-not $env:LOCALAPPDATA) {
    throw 'AG34-H4 STOP: Windows user-private LOCALAPPDATA is required'
}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
    throw 'AG34-H4 STOP: execute from an actual Git checkout'
}
$branchName = (& git -C $repoRoot branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branchName -ne 'payment-module-finalization') {
    throw 'AG34-H4 STOP: checkout the approved development branch first'
}
$status = (& git -C $repoRoot status --porcelain)
if ($LASTEXITCODE -ne 0 -or @($status).Where({ $_.Trim() -ne '' }).Count -ne 0) {
    throw 'AG34-H4 STOP: local Git working tree must be clean'
}
$versionOutput = (& supabase --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $versionOutput -notmatch '^3\.0\.0($|\s)') {
    throw 'AG34-H4 STOP: Supabase CLI 3.0.0 required'
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw 'AG34-H4 STOP: Python is required for the reviewed offline history gate'
}
$sourceFile = Join-Path $repoRoot ('supabase/migrations/' +
    $Version + '_ag34_h1_legacy_coach_batches_client_lockdown.sql')
$gate = Join-Path $repoRoot 'scripts/devbot/ag34_h3_operator_workspace_gate.py'
if (-not (Test-Path $sourceFile) -or -not (Test-Path $gate)) {
    throw 'AG34-H4 STOP: approved migration source or offline gate missing'
}
# All output is outside GitHub and outside the repository. No remote writes.
$releaseRoot = Join-Path $env:LOCALAPPDATA ('Kheltriva/AG34-H4-' + [guid]::NewGuid().ToString('N'))
$backups = Join-Path $releaseRoot 'backup'
$workspace = Join-Path $releaseRoot 'unlinked-cli'
New-Item -ItemType Directory -Path $backups -Force | Out-Null
New-Item -ItemType Directory -Path $workspace -Force | Out-Null
$schemaPath = Join-Path $backups 'schema_public_auth_storage_migrations.sql'
$dataPath = Join-Path $backups 'data_public_auth_storage_migrations.sql'
$remoteArg = '--remote=' + $ProjectRef
$schemas = 'public,auth,storage,supabase_migrations'
$finished = $false
try {
    # Read-only dump; all data includes sensitive Auth and player information.
    Invoke-Checked 'export private logical schema backup' @(
        'db','dump',$remoteArg,'--schema',$schemas,'--file',$schemaPath
    )
    Invoke-Checked 'export private logical data backup' @(
        'db','dump',$remoteArg,'--schema',$schemas,'--data-only','--file',$dataPath
    )
    foreach ($f in @($schemaPath,$dataPath)) {
        if (-not (Test-Path $f) -or (Get-Item $f).Length -lt 100) {
            throw 'AG34-H4 STOP: logical database export failed integrity presence check'
        }
    }
    Push-Location $workspace
    try {
        Invoke-Checked 'initialize isolated no-link project' @('init','--yes')
        Invoke-Checked 'fetch 82 applied migrations to private local files only' @(
            'migration','fetch',$remoteArg
        )
        & python $gate --workspace $workspace --phase fetched
        if ($LASTEXITCODE -ne 0) {
            throw 'AG34-H4 STOP: fetched 82-version manifest mismatch'
        }
        $target = Join-Path $workspace ('supabase/migrations/' +
            $Version + '_ag34_h1_legacy_coach_batches_client_lockdown.sql')
        if (Test-Path $target) { throw 'AG34-H4 STOP: target already present before staging' }
        Copy-Item -LiteralPath $sourceFile -Destination $target -ErrorAction Stop
        & python $gate --workspace $workspace --phase staged
        if ($LASTEXITCODE -ne 0) {
            throw 'AG34-H4 STOP: exactly-one pending migration check failed'
        }
        Invoke-Checked 'list pending migration history (read-only)' @(
            'migration','list',$remoteArg
        )
        $finished = $true
    }
    finally { Pop-Location }
    foreach ($f in @($schemaPath,$dataPath)) {
        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $f).Hash
        Write-Host ("AG34-H4 private backup: " + $f)
        Write-Host ("AG34-H4 SHA256: " + $hash)
    }
    Write-Host ('AG34-H4 private unlinked workspace: ' + $workspace)
    Write-Host 'AG34-H4 STOP: PREPARATION COMPLETE, NO HOSTED DDL EXECUTED.'
    Write-Host 'Review backups for restorability, preflight SQL and the single pending version.'
    Write-Host 'Never share backup contents, fetched migration files, passwords or keys.'
}
finally {
    if (-not $finished) {
        Write-Warning ('AG34-H4 stopped. Private working files may remain at ' + $releaseRoot)
        Write-Warning 'Do not retry or apply migration until the failed gate is investigated.'
    }
}
