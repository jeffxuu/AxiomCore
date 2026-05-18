#!/usr/bin/env bash
#
# Server-side incremental redeploy for Axiom Core.
#
# This is the GIT-PULL path. It only works after the server has been bootstrapped
# (axiom-core.service installed, /opt/axiom-core/.git exists). For first-time
# deploys, run scripts/deploy_axiom_cloud.ps1 from a workstation — that handles
# the destructive cleanup of legacy LifeOS and the initial bootstrap.
#
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/axiom-core}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups}"

cd "$APP_DIR"

if [ ! -d .git ]; then
  echo "Refusing to deploy: $APP_DIR is not a git checkout." >&2
  echo "Run scripts/deploy_axiom_cloud.ps1 from a workstation for the bootstrap path." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to deploy: server working tree has local changes." >&2
  git status --short --branch >&2
  exit 1
fi

git fetch origin
git pull --ff-only origin main

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_dir="$BACKUP_ROOT/axiom-core-ui-before-deploy-$timestamp"
sudo mkdir -p "$backup_dir"
if [ -d "$APP_DIR/web/dist" ]; then
  sudo cp -a "$APP_DIR/web/dist" "$backup_dir/dist"
fi

cd "$APP_DIR/web"
npm ci
npm run typecheck
npm run build

sudo nginx -t
sudo systemctl reload nginx

# Restart the Python backend to pick up any server-side code changes
sudo systemctl restart axiom-core
echo "Waiting for backend to come up..."
for i in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:8765/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS http://127.0.0.1:8765/api/health
echo
echo "Deploy complete: $(git -C "$APP_DIR" rev-parse HEAD)"
