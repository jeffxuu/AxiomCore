# Axiom Core Deployment Notes (server-side)

> Low-level reference for what runs on the cloud server. The local one-button
> deploy is `scripts/deploy_axiom_cloud.ps1`. See [docs/deployment.md](../docs/deployment.md)
> for the product view.

## File layout on the server

```
/opt/axiom-core/                    # entire repo (uploaded by deploy script)
  ├─ axiom_server.py
  ├─ web/                            # built into web/dist/ by npm run build
  ├─ server-setup/
  │    ├─ axiom-core.service        # systemd unit
  │    ├─ axiom-nginx.conf          # nginx site
  │    ├─ deploy-axiom-web.sh       # second-pass deploy script (incremental)
  │    └─ env.example
  ├─ data/axiom_core.db             # runtime SQLite (not in git)
  └─ logs/daily/                    # runtime daily Markdown mirror

/etc/axiom-core/env                  # production secrets (mode 0640, NOT in git)
/etc/systemd/system/axiom-core.service       # copy of server-setup/axiom-core.service
/etc/nginx/sites-available/axiom-nginx.conf  # copy of server-setup/axiom-nginx.conf
/etc/nginx/sites-enabled/axiom-nginx.conf    # symlink to sites-available/
```

## First deploy (from the legacy LifeOS server)

The local one-button script handles this automatically:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1
```

What it does on the server, in order:

1. **Destructive cleanup** of LifeOS (only on first deploy; opt out with `-SkipDestroy`):
   ```bash
   systemctl stop lifeos.service       || true
   systemctl disable lifeos.service    || true
   rm -f /etc/systemd/system/lifeos.service
   rm -f /etc/nginx/sites-enabled/lifeos-nginx.conf
   rm -f /etc/nginx/sites-available/lifeos-nginx.conf
   rm -rf /opt/lifeos-app
   systemctl daemon-reload
   ```
2. **Upload tarball** of the local working tree to `/tmp/axiom_core_deploy.tgz`
3. **Extract** into `/opt/axiom-core/` (preserves `data/` if it already exists)
4. **Python deps**: `pip install -r requirements.txt`
5. **Frontend build**: `cd web && npm ci && npm run build`
6. **Install systemd unit**: copy `axiom-core.service` to `/etc/systemd/system/`
7. **Provision env file**: copy `env.example` to `/etc/axiom-core/env` (mode 0640) only if absent
8. **Install nginx site**: copy `axiom-nginx.conf`, symlink into `sites-enabled/`
9. **Enable + start**: `systemctl daemon-reload && systemctl enable axiom-core && systemctl restart axiom-core`
10. **Reload nginx**: `nginx -t && systemctl reload nginx`
11. **Health check** from local: `curl https://<host>/api/health`

## After the first deploy: edit secrets

The deploy script only seeds `/etc/axiom-core/env` from `env.example`. You
**must** SSH in and replace the placeholders before the service will accept
logins:

```bash
ssh root@jeffxu.cc
vi /etc/axiom-core/env
# Set AXIOM_WEB_USER, AXIOM_WEB_PASSWORD, AXIOM_SESSION_SECRET (≥32 chars),
# FEISHU_* values. Save. Then:
systemctl restart axiom-core
systemctl status axiom-core
journalctl -u axiom-core -n 30
```

## Incremental redeploys

Once Axiom Core is the only thing on the server:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy_axiom_cloud.ps1 -SkipDestroy
```

`-SkipDestroy` avoids the `rm -rf /opt/lifeos-app` step; everything else is the
same. The `data/` directory is preserved across redeploys via a `find -mindepth
1 -maxdepth 1 ! -name data -exec rm -rf` pass before extracting the new
tarball, so the SQLite database survives.

## Frontend build discipline

Use `npm ci`, NOT `npm install`.

`npm install` can rewrite `web/package-lock.json` on the server when npm
versions differ between local and remote. That makes the server tree dirty and
breaks `git pull --ff-only` (if you ever switch back to a git-pull-based deploy).

## Nginx cache rules

The SPA entry HTML must not be cached:

```nginx
location = /index.html {
    add_header Cache-Control "no-store" always;
    try_files /index.html =404;
}

location / {
    add_header Cache-Control "no-store" always;
    try_files $uri $uri/ /index.html;
}
```

Hashed Vite assets can be cached for a year:

```nginx
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    try_files $uri =404;
}
```

`/api/` proxies to the FastAPI service at `127.0.0.1:8765`. The exact upstream
block lives in [axiom-nginx.conf](axiom-nginx.conf) — the rate-limit zones are
`axiom_login` (5 r/m for /api/login) and `axiom_altcha` (30 r/m for /api/altcha).

## Verifying a deploy

```bash
systemctl status axiom-core
curl -s https://jeffxu.cc/api/health
curl -s https://jeffxu.cc/api/config
journalctl -u axiom-core -p err --since '5 min ago'
```

Expected:
- `service: "Axiom Core"` in `/api/health`
- `brandName: "Axiom Core"` in `/api/config`
- Zero error lines in journal

## Rolling back

There are no automated rollback tags. The safest path:

1. Identify the last good commit in the local repo: `git log --oneline`
2. `git checkout <sha>` locally
3. `scripts\deploy_axiom_cloud.ps1 -SkipDestroy`
4. `git checkout main` locally afterwards
