# scripts/

Local automation scripts for Axiom Core. All credentials read from a DPAPI
store (`%USERPROFILE%\.axiom-core\secrets.dat`) — nothing sensitive lives in
this directory or any committed file.

| Script | Trigger | Purpose |
|--------|---------|---------|
| [axiom_secrets.ps1](axiom_secrets.ps1) | Manual | DPAPI store: `set` / `show` / `get` / `new-ssh-key` |
| [deploy_axiom_cloud.ps1](deploy_axiom_cloud.ps1) | Manual | Destructive cleanup of `/opt/lifeos-app/`, then rsync + systemd + nginx setup for `/opt/axiom-core/` |
| [auto_git_sync.ps1](auto_git_sync.ps1) | Scheduled (5 min) | If working tree changed → `git add -A && commit && push origin main` |
| [cloud_to_local_sync.ps1](cloud_to_local_sync.ps1) | Scheduled (5 min) | scp cloud `logs/daily/` + `axiom_core.db` to local working copy |

## Bootstrap order

1. **Configure secrets**
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\axiom_secrets.ps1 -Action new-ssh-key
   powershell -ExecutionPolicy Bypass -File scripts\axiom_secrets.ps1 -Action set
   ```
2. **Add public key to server's `~/.ssh/authorized_keys`**
3. **Deploy** (first deploy = destructive cleanup of legacy LifeOS install)
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1 -DryRun  # preview
   powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1          # real
   ```
4. **Edit `/etc/axiom-core/env` on the server** with real `AXIOM_WEB_PASSWORD`, `AXIOM_SESSION_SECRET`, etc., then `systemctl restart axiom-core`
5. **Register scheduled tasks** (one-time, run as Administrator):
   ```powershell
   $repo = "C:\Users\ouc\Desktop\AxiomCore"
   schtasks /Create /TN AxiomCoreGitSync /SC MINUTE /MO 5 /F `
     /TR "powershell -NoProfile -ExecutionPolicy Bypass -File $repo\scripts\auto_git_sync.ps1"
   schtasks /Create /TN AxiomCorePullSync /SC MINUTE /MO 5 /F `
     /TR "powershell -NoProfile -ExecutionPolicy Bypass -File $repo\scripts\cloud_to_local_sync.ps1"
   ```

## Subsequent deploys

Once the legacy LifeOS install is gone, every redeploy is:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1 -SkipDestroy
```

`-SkipDestroy` short-circuits the `rm -rf /opt/lifeos-app` step.

## Disable the auto-sync tasks (e.g. during a major refactor)

```powershell
Disable-ScheduledTask -TaskName AxiomCoreGitSync
Disable-ScheduledTask -TaskName AxiomCorePullSync
```

Re-enable with `Enable-ScheduledTask`.
