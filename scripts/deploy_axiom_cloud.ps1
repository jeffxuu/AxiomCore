<#
.SYNOPSIS
Deploy Axiom Core to the cloud server with destructive cleanup of the legacy
LifeOS install.

.DESCRIPTION
First-time deploy after greenfield rebuild. On invocation:

  Step 1  Read DPAPI-encrypted SSH config (host, user, key path, remote app dir).
  Step 2  SSH to the server and destructively remove the legacy LifeOS install:
            systemctl stop lifeos.service       (if exists)
            systemctl disable lifeos.service    (if exists)
            rm /etc/systemd/system/lifeos.service
            rm /etc/nginx/sites-enabled/lifeos-nginx.conf  (if symlink)
            rm /etc/nginx/sites-available/lifeos-nginx.conf
            rm -rf /opt/lifeos-app/
  Step 3  Tar local repository (excluding node_modules, .git, runtime db, logs)
          and upload via scp to /tmp/axiom_core_deploy.tgz on the server.
  Step 4  SSH to the server and bootstrap into $RemoteAppDir (default
          /opt/axiom-core/):
            mkdir, untar, npm ci, npm run build
            install /etc/systemd/system/axiom-core.service
            install /etc/nginx/sites-available/axiom-nginx.conf + symlink
            ensure /etc/axiom-core/env exists (create from env.example if missing)
            systemctl daemon-reload, enable, start axiom-core
            nginx -t && systemctl reload nginx
  Step 5  Health check via curl https://<host>/api/health

.PARAMETER DryRun
Print every SSH/scp command and exit without contacting the server.

.PARAMETER SkipDestroy
Skip Step 2 (legacy cleanup). Use this on second and subsequent deploys after
the server is already on Axiom Core.

.PARAMETER NoBuild
Skip `npm ci && npm run build` on the server. Useful if you uploaded a prebuilt
web/dist tarball.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1
  powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1 -SkipDestroy
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SkipDestroy,
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'

# Resolve repo root (parent of scripts/).
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SecretsScript = Join-Path $PSScriptRoot 'axiom_secrets.ps1'

function Get-Secret {
    param([Parameter(Mandatory=$true)][string]$Key, [string]$Default)
    try {
        $val = & powershell -NoProfile -ExecutionPolicy Bypass -File $SecretsScript -Action get -Key $Key 2>$null
        if ($LASTEXITCODE -eq 0 -and $val) { return $val.Trim() }
    } catch {}
    return $Default
}

# Load config. Missing required fields → instruct user to run `axiom_secrets.ps1 -Action set`.
$SshHost     = Get-Secret -Key 'AXIOM_SSH_HOST'
$SshUser     = Get-Secret -Key 'AXIOM_SSH_USER'     -Default 'root'
$SshKey      = Get-Secret -Key 'AXIOM_SSH_KEY_PATH'
$RemoteApp   = Get-Secret -Key 'AXIOM_REMOTE_APP_DIR' -Default '/opt/axiom-core'

$missing = @()
if (-not $SshHost) { $missing += 'AXIOM_SSH_HOST' }
if (-not $SshKey)  { $missing += 'AXIOM_SSH_KEY_PATH' }
if ($missing.Count -gt 0) {
    Write-Error "Missing required secrets: $($missing -join ', '). Run scripts\axiom_secrets.ps1 -Action set first."
    exit 2
}
if (-not (Test-Path $SshKey)) {
    Write-Error "AXIOM_SSH_KEY_PATH points to $SshKey which does not exist on disk."
    exit 2
}

$SshTarget = "$SshUser@$SshHost"
$SshOpts   = @('-i', $SshKey, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')

# When the SSH user is already root, we run the remote script straight through
# bash -s. Otherwise (e.g. Tencent's default `ubuntu` user) we wrap it with
# `sudo -n` so commands like `systemctl`, writes to /etc/, and rm -rf /opt
# succeed. -n keeps sudo non-interactive — if NOPASSWD is missing the deploy
# fails fast with a clear error rather than hanging on a password prompt.
$RemoteShell = if ($SshUser -eq 'root') { '/bin/bash -s' } else { 'sudo -n /bin/bash -s' }

function Invoke-Ssh {
    param([Parameter(Mandatory=$true)][string]$RemoteCommand, [switch]$AllowFail)
    if ($DryRun) {
        Write-Host "[DryRun] ssh $SshTarget $RemoteShell <<<EOF" -ForegroundColor DarkGray
        $RemoteCommand -split "`n" | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        Write-Host "[DryRun] EOF" -ForegroundColor DarkGray
        return $true
    }
    # Pipe the script over stdin instead of passing it as a single ssh argv
    # element. Multi-line scripts with quoting hazards (parens, quotes, $)
    # collapse to one line through ssh's argv path and break bash parsing;
    # stdin preserves them verbatim.
    $RemoteCommand | & ssh @SshOpts $SshTarget $RemoteShell
    $ok = ($LASTEXITCODE -eq 0)
    if (-not $ok -and -not $AllowFail) {
        throw "ssh command failed (exit $LASTEXITCODE)"
    }
    return $ok
}

function Invoke-Scp {
    param([Parameter(Mandatory=$true)][string]$LocalPath, [Parameter(Mandatory=$true)][string]$RemotePath)
    if ($DryRun) {
        Write-Host "[DryRun] scp $LocalPath $SshTarget`:$RemotePath" -ForegroundColor DarkGray
        return
    }
    & scp @SshOpts $LocalPath "${SshTarget}:${RemotePath}"
    if ($LASTEXITCODE -ne 0) { throw "scp $LocalPath → $RemotePath failed (exit $LASTEXITCODE)" }
}

Write-Host "=== Axiom Core deploy ===" -ForegroundColor Cyan
Write-Host "  target       = $SshTarget"
Write-Host "  remote app   = $RemoteApp"
Write-Host "  ssh key      = $SshKey"
Write-Host "  destroy old  = $(-not $SkipDestroy)"
Write-Host "  build remote = $(-not $NoBuild)"
if ($DryRun) { Write-Host "  DRY RUN: no commands will be sent" -ForegroundColor Yellow }
Write-Host ""

# ------------------------------------------------------------------
# Step 2: destructive cleanup of legacy LifeOS
# ------------------------------------------------------------------
if (-not $SkipDestroy) {
    Write-Host "[Step 2] Destroying legacy LifeOS install on $SshHost ..." -ForegroundColor Yellow
    $destroyCmd = @'
set -e
echo "  systemctl stop/disable lifeos.service (ignore errors if absent)";
systemctl stop lifeos.service 2>/dev/null || true;
systemctl disable lifeos.service 2>/dev/null || true;
echo "  remove systemd unit";
rm -f /etc/systemd/system/lifeos.service;
echo "  remove nginx config";
rm -f /etc/nginx/sites-enabled/lifeos-nginx.conf;
rm -f /etc/nginx/sites-available/lifeos-nginx.conf;
echo "  remove /opt/lifeos-app/";
rm -rf /opt/lifeos-app;
echo "  systemctl daemon-reload";
systemctl daemon-reload;
echo "  legacy cleanup OK";
'@
    Invoke-Ssh -RemoteCommand $destroyCmd
}

# ------------------------------------------------------------------
# Step 3: tar local repo and upload
# ------------------------------------------------------------------
Write-Host ""
Write-Host "[Step 3] Packing local repo and uploading ..." -ForegroundColor Yellow
$tarball = Join-Path $env:TEMP "axiom_core_deploy_$(Get-Random).tgz"
try {
    Push-Location $RepoRoot
    # Use git ls-files so we never ship runtime artifacts, secrets, or node_modules.
    # Fall back to a hard exclude list if not in a git repo.
    $useGitArchive = (Test-Path (Join-Path $RepoRoot '.git'))
    if ($useGitArchive) {
        Write-Host "  using git archive (only tracked files)" -ForegroundColor DarkGray
        if (-not $DryRun) {
            & git archive --format=tar.gz -o $tarball HEAD
            if ($LASTEXITCODE -ne 0) { throw "git archive failed (exit $LASTEXITCODE)" }
        }
    } else {
        Write-Host "  using tar with exclude list" -ForegroundColor DarkGray
        if (-not $DryRun) {
            & tar -czf $tarball `
                --exclude='node_modules' --exclude='.git' --exclude='__pycache__' `
                --exclude='data/*.db*' --exclude='logs' --exclude='.claude' `
                --exclude='*.tgz' --exclude='*.zip' --exclude='.axiom-secrets' `
                .
            if ($LASTEXITCODE -ne 0) { throw "tar failed (exit $LASTEXITCODE)" }
        }
    }
    Pop-Location

    Invoke-Scp -LocalPath $tarball -RemotePath '/tmp/axiom_core_deploy.tgz'
}
finally {
    if (Test-Path $tarball) { Remove-Item $tarball -Force }
}

# ------------------------------------------------------------------
# Step 4: bootstrap on server
# ------------------------------------------------------------------
Write-Host ""
Write-Host "[Step 4] Bootstrapping $RemoteApp ..." -ForegroundColor Yellow

$skipBuildFlag = if ($NoBuild) { '1' } else { '0' }

$bootstrap = @"
set -e
remote_app=$RemoteApp
skip_build=$skipBuildFlag

echo '  mkdir + extract tarball'
mkdir -p `$remote_app
cd `$remote_app
# Wipe everything except the data/ directory so an existing axiom_core.db is preserved on redeploy.
# On first install the data/ dir will be empty.
find . -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} +
tar -xzf /tmp/axiom_core_deploy.tgz -C `$remote_app
rm -f /tmp/axiom_core_deploy.tgz
mkdir -p `$remote_app/data `$remote_app/logs/daily

echo '  python deps'
if [ -f `$remote_app/requirements.txt ]; then
  if command -v python3 >/dev/null 2>&1; then PYBIN=python3; else PYBIN=python; fi
  `$PYBIN -m pip install --quiet --upgrade pip
  `$PYBIN -m pip install --quiet -r `$remote_app/requirements.txt
fi

if [ "`$skip_build" = "0" ]; then
  echo '  npm ci + build'
  cd `$remote_app/web
  npm ci --silent
  npm run build --silent
  cd `$remote_app
fi

echo '  install systemd unit'
install -m 0644 `$remote_app/server-setup/axiom-core.service /etc/systemd/system/axiom-core.service

mkdir -p /etc/axiom-core
if [ ! -f /etc/axiom-core/env ]; then
  install -m 0640 `$remote_app/server-setup/env.example /etc/axiom-core/env
  echo '  /etc/axiom-core/env was missing — created from template; edit it with real secrets before reload'
fi

echo '  install nginx config'
install -m 0644 `$remote_app/server-setup/axiom-nginx.conf /etc/nginx/sites-available/axiom-nginx.conf
ln -sf /etc/nginx/sites-available/axiom-nginx.conf /etc/nginx/sites-enabled/axiom-nginx.conf

echo '  systemctl daemon-reload + enable + restart'
systemctl daemon-reload
systemctl enable axiom-core.service
systemctl restart axiom-core.service

echo '  nginx -t and reload'
nginx -t
systemctl reload nginx

echo '  bootstrap OK'
"@

Invoke-Ssh -RemoteCommand $bootstrap

# ------------------------------------------------------------------
# Step 5: health check
# ------------------------------------------------------------------
Write-Host ""
Write-Host "[Step 5] Health check via https://$SshHost/api/health ..." -ForegroundColor Yellow
if (-not $DryRun) {
    try {
        $resp = Invoke-RestMethod -Uri "https://$SshHost/api/health" -TimeoutSec 10
        $resp | ConvertTo-Json -Compress | Write-Host
        if ($resp.service -ne 'Axiom Core') {
            Write-Warning "service field is '$($resp.service)', expected 'Axiom Core'"
        } else {
            Write-Host "  health check OK" -ForegroundColor Green
        }
    } catch {
        Write-Warning "Health check failed: $_"
    }
}

Write-Host ""
Write-Host "=== Deploy finished ===" -ForegroundColor Green
