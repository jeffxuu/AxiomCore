<#
.SYNOPSIS
Pull daily Markdown logs and the SQLite snapshot from the cloud Axiom Core
server back to the local working tree.

.DESCRIPTION
Runs every 5 minutes via Windows Scheduled Task (AxiomCorePullSync). Reads
DPAPI-encrypted SSH config, then:

  1. scp /opt/axiom-core/logs/daily/*.md → ./logs/daily/
  2. scp /opt/axiom-core/data/axiom_core.db → ./data/axiom_core.db

Both targets are gitignored (data/*.db, logs/), so this just keeps the local
working copy hot for inspection. The Markdown mirrors that ARE tracked in git
flow through GitHub via the cloud-side auto-sync, not through this script.

.PARAMETER DryRun
Print commands without executing.
#>
[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'

$RepoRoot      = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SecretsScript = Join-Path $PSScriptRoot 'axiom_secrets.ps1'
$LogDir        = Join-Path $RepoRoot '.sync_logs'
$LogFile       = Join-Path $LogDir 'cloud_to_local_sync.log'

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Log {
    param([string]$Msg)
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $LogFile -Value "[$stamp] $Msg"
}

function Get-Secret {
    param([string]$Key, [string]$Default)
    try {
        $val = & powershell -NoProfile -ExecutionPolicy Bypass -File $SecretsScript -Action get -Key $Key 2>$null
        if ($LASTEXITCODE -eq 0 -and $val) { return $val.Trim() }
    } catch {}
    return $Default
}

try {
    $SshHost   = Get-Secret -Key 'AXIOM_SSH_HOST'
    $SshUser   = Get-Secret -Key 'AXIOM_SSH_USER' -Default 'root'
    $SshKey    = Get-Secret -Key 'AXIOM_SSH_KEY_PATH'
    $RemoteApp = Get-Secret -Key 'AXIOM_REMOTE_APP_DIR' -Default '/opt/axiom-core'

    if (-not $SshHost -or -not $SshKey) {
        Log "missing SSH config; run axiom_secrets.ps1 -Action set"
        exit 2
    }

    $target = "$SshUser@$SshHost"
    $opts = @('-i', $SshKey, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')

    $localDaily = Join-Path $RepoRoot 'logs\daily'
    $localData  = Join-Path $RepoRoot 'data'
    if (-not (Test-Path $localDaily)) { New-Item -ItemType Directory -Path $localDaily -Force | Out-Null }
    if (-not (Test-Path $localData))  { New-Item -ItemType Directory -Path $localData -Force | Out-Null }

    # Use `scp -r` for the daily logs directory. -p preserves mtimes so subsequent
    # sed/grep tools see a stable timeline.
    $remoteDaily = "${target}:${RemoteApp}/logs/daily/."
    $remoteDb    = "${target}:${RemoteApp}/data/axiom_core.db"

    if ($DryRun) {
        Write-Host "[DryRun] scp $($opts -join ' ') -rp $remoteDaily $localDaily"
        Write-Host "[DryRun] scp $($opts -join ' ') -p $remoteDb $localData"
        exit 0
    }

    & scp @opts -rp $remoteDaily $localDaily 2>$null
    Log "pulled logs/daily/ ← $remoteDaily (exit $LASTEXITCODE)"
    & scp @opts -p $remoteDb $localData 2>$null
    Log "pulled data/axiom_core.db ← $remoteDb (exit $LASTEXITCODE)"
}
catch {
    Log "ERROR: $_"
    exit 1
}
