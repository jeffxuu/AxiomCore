<#
.SYNOPSIS
DPAPI-encrypted secret storage for Axiom Core.

.DESCRIPTION
Stores SSH host, user, key path, web login credentials, and other secrets in
%USERPROFILE%\.axiom-core\secrets.dat encrypted with Windows DPAPI (current
user only). All other Axiom Core scripts read from this store via Get-AxiomSecret.

.PARAMETER Action
  set         Interactively prompt for and save all known secrets.
  show        Print non-sensitive fields (SSH host/user/key path, app dir).
              Sensitive fields (passwords) are shown as <set>/<unset>.
  get         Print a single field value to stdout. Requires -Key.
  new-ssh-key Generate a fresh ed25519 key pair at $env:USERPROFILE\.ssh\axiom_core_ed25519
              and update AXIOM_SSH_KEY_PATH in the store.

.PARAMETER Key
For `get` action: the secret key to retrieve (e.g. AXIOM_SSH_HOST).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\axiom_secrets.ps1 -Action set
  powershell -ExecutionPolicy Bypass -File scripts\axiom_secrets.ps1 -Action show
  powershell -ExecutionPolicy Bypass -File scripts\axiom_secrets.ps1 -Action new-ssh-key
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('set','show','get','new-ssh-key')]
    [string]$Action,

    [string]$Key
)

$ErrorActionPreference = 'Stop'

$SecretDir  = Join-Path $env:USERPROFILE '.axiom-core'
$SecretFile = Join-Path $SecretDir 'secrets.dat'

# Known keys. Anything else in -Action set will be ignored.
$KnownKeys = @(
    'AXIOM_SSH_HOST'        # e.g. jeffxu.cc
    'AXIOM_SSH_USER'        # e.g. root
    'AXIOM_SSH_KEY_PATH'    # absolute path to private key, e.g. C:\Users\ouc\.ssh\axiom_core_ed25519
    'AXIOM_REMOTE_APP_DIR'  # e.g. /opt/axiom-core
    'AXIOM_WEB_USER'        # cloud login username
    'AXIOM_WEB_PASSWORD'    # cloud login password
)

$SensitiveKeys = @('AXIOM_WEB_PASSWORD')

function Ensure-SecretDir {
    if (-not (Test-Path $SecretDir)) {
        New-Item -ItemType Directory -Path $SecretDir -Force | Out-Null
    }
}

function Read-SecretStore {
    if (-not (Test-Path $SecretFile)) { return @{} }
    try {
        $protected = [System.Convert]::FromBase64String((Get-Content $SecretFile -Raw))
        $clearBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
            $protected, $null, 'CurrentUser')
        $json = [System.Text.Encoding]::UTF8.GetString($clearBytes)
        $obj  = $json | ConvertFrom-Json
        $hash = @{}
        foreach ($prop in $obj.PSObject.Properties) { $hash[$prop.Name] = $prop.Value }
        return $hash
    } catch {
        throw "Could not decrypt $SecretFile. The file may belong to a different Windows user account or have been corrupted. Original error: $_"
    }
}

function Write-SecretStore {
    param([hashtable]$Store)
    Ensure-SecretDir
    $json = ($Store | ConvertTo-Json -Compress)
    $clearBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $protected = [System.Security.Cryptography.ProtectedData]::Protect(
        $clearBytes, $null, 'CurrentUser')
    [System.Convert]::ToBase64String($protected) | Set-Content $SecretFile -Encoding ASCII -NoNewline
}

switch ($Action) {

    'set' {
        Add-Type -AssemblyName System.Security
        $store = Read-SecretStore
        Write-Host "Configuring Axiom Core secrets. Leave a value blank to keep the existing one." -ForegroundColor Cyan
        foreach ($k in $KnownKeys) {
            $existing = $store[$k]
            $isSensitive = $SensitiveKeys -contains $k
            $hint = if ($existing) { if ($isSensitive) { ' [<set>]' } else { " [$existing]" } } else { '' }
            $prompt = "  $k$hint"
            if ($isSensitive) {
                $secure = Read-Host $prompt -AsSecureString
                $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
                try { $value = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
                finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
            } else {
                $value = Read-Host $prompt
            }
            if ($value) { $store[$k] = $value }
        }
        Write-SecretStore -Store $store
        Write-Host "Saved to $SecretFile" -ForegroundColor Green
    }

    'show' {
        if (-not (Test-Path $SecretFile)) {
            Write-Host "No secrets configured yet. Run with -Action set." -ForegroundColor Yellow
            return
        }
        Add-Type -AssemblyName System.Security
        $store = Read-SecretStore
        Write-Host "Axiom Core secrets ($SecretFile):" -ForegroundColor Cyan
        foreach ($k in $KnownKeys) {
            $val = $store[$k]
            if (-not $val) {
                Write-Host ("  {0,-22} = <unset>" -f $k) -ForegroundColor DarkGray
            } elseif ($SensitiveKeys -contains $k) {
                Write-Host ("  {0,-22} = <set>" -f $k) -ForegroundColor Green
            } else {
                Write-Host ("  {0,-22} = {1}" -f $k, $val)
            }
        }
    }

    'get' {
        if (-not $Key) { throw "-Action get requires -Key" }
        Add-Type -AssemblyName System.Security
        $store = Read-SecretStore
        if (-not $store.ContainsKey($Key)) {
            Write-Error "Key $Key is not set."
            exit 2
        }
        # Plain stdout for shell pipelines.
        Write-Output $store[$Key]
    }

    'new-ssh-key' {
        Add-Type -AssemblyName System.Security
        $sshDir = Join-Path $env:USERPROFILE '.ssh'
        if (-not (Test-Path $sshDir)) {
            New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
        }
        $keyPath = Join-Path $sshDir 'axiom_core_ed25519'
        if (Test-Path $keyPath) {
            $resp = Read-Host "Key already exists at $keyPath. Overwrite? (yes/NO)"
            if ($resp -ne 'yes') { Write-Host "Aborted." -ForegroundColor Yellow; return }
            Remove-Item "$keyPath","$keyPath.pub" -ErrorAction SilentlyContinue
        }
        & ssh-keygen -t ed25519 -f $keyPath -N '""' -C "axiom-core@$env:COMPUTERNAME"
        if ($LASTEXITCODE -ne 0) { throw "ssh-keygen failed with exit $LASTEXITCODE" }
        Write-Host "Generated key pair at $keyPath" -ForegroundColor Green
        Write-Host "Public key:" -ForegroundColor Cyan
        Get-Content "$keyPath.pub"
        Write-Host ""
        Write-Host "Append the public key to the server's ~/.ssh/authorized_keys, then deactivate the legacy 私钥文件." -ForegroundColor Yellow

        $store = Read-SecretStore
        $store['AXIOM_SSH_KEY_PATH'] = $keyPath
        Write-SecretStore -Store $store
        Write-Host "Updated AXIOM_SSH_KEY_PATH in $SecretFile" -ForegroundColor Green
    }
}
