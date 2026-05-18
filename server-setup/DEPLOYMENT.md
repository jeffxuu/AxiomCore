# LifeOS Deployment Notes

## Source Of Truth

GitHub `main` is the canonical source for application code. The server working tree should stay clean so deployments can use:

```bash
cd /opt/lifeos-app
git fetch origin
git pull --ff-only origin main
```

If `git status --short` shows local changes, stop and inspect them before deploying.

## Frontend Build

Use `npm ci`, not `npm install`.

```bash
cd /opt/lifeos-app/web
npm ci
npm run typecheck
npm run build
```

`npm install` can rewrite `web/package-lock.json` on the server when npm versions differ. That makes the server dirty and can block later `git pull --ff-only`.

## Nginx Cache Rules

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

Keep `/api/` proxied to the FastAPI service at `127.0.0.1:8765`.

## Standard Deploy

Run on the server:

```bash
bash /opt/lifeos-app/server-setup/deploy-lifeos-web.sh
```

The script checks for a clean worktree, fast-forwards `main`, builds with `npm ci`, runs TypeScript and production build checks, verifies Nginx, and reloads Nginx.
