<#
.SYNOPSIS
Five-minute auto-commit + push for the Axiom Core repo.

.DESCRIPTION
Detects working-tree changes. If any are present, stages them, commits with a
timestamped message, and pushes to origin/main. If the tree is clean, exits 0
without touching git.

Designed to be wired into a Windows Scheduled Task every 5 minutes:

  schtasks /Create /TN AxiomCoreGitSync `
    /TR "powershell -ExecutionPolicy Bypass -File C:\Users\ouc\Desktop\AxiomCore\scripts\auto_git_sync.ps1" `
    /SC MINUTE /MO 5 /F

.PARAMETER NoPush
Skip the `git push`. Useful for testing the commit logic without burning a
remote round-trip.
#>
[CmdletBinding()]
param([switch]$NoPush)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot

# Single source of truth for the log location. We never push the log itself
# because the directory is gitignored.
$LogDir  = Join-Path $RepoRoot '.sync_logs'
$LogFile = Join-Path $LogDir 'auto_git_sync.log'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Write-Log {
    param([string]$Message)
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $LogFile -Value "[$stamp] $Message"
}

try {
    $status = & git status --porcelain 2>$null
    if ($LASTEXITCODE -ne 0) { throw "git status failed (exit $LASTEXITCODE)" }
    if (-not $status) {
        Write-Log "clean tree — nothing to do"
        exit 0
    }

    $changedCount = ($status -split "`n").Count
    Write-Log "detected $changedCount changed entries"

    & git add -A
    if ($LASTEXITCODE -ne 0) { throw "git add failed (exit $LASTEXITCODE)" }

    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $msg   = "Auto sync $stamp"
    & git commit -m $msg | Out-Null
    if ($LASTEXITCODE -ne 0) {
        # `git commit` returns non-zero when nothing new is staged (e.g., only
        # gitignored files changed). Treat that as a no-op, not a failure.
        Write-Log "git commit reported no changes; exiting"
        exit 0
    }
    Write-Log "committed: $msg"

    if (-not $NoPush) {
        & git push origin main
        if ($LASTEXITCODE -ne 0) { throw "git push failed (exit $LASTEXITCODE)" }
        Write-Log "pushed to origin/main"
    } else {
        Write-Log "push skipped (-NoPush)"
    }
}
catch {
    Write-Log "ERROR: $_"
    exit 1
}
