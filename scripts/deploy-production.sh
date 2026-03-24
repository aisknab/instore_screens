#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${1:-$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)}"
SERVICE_NAME="${SERVICE_NAME:-criteoscreens}"
PORT_VALUE="${PORT:-3100}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT_VALUE}/api/health}"

cd "$APP_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to deploy: git working tree is not clean." >&2
  git status --short
  exit 1
fi

echo "Fetching origin/${BRANCH}..."
git fetch origin "$BRANCH"

echo "Pulling latest code..."
git pull --ff-only origin "$BRANCH"

echo "Installing dependencies..."
npm ci

echo "Restarting ${SERVICE_NAME}..."
sudo systemctl restart "$SERVICE_NAME"

echo "Checking service status..."
sudo systemctl --no-pager --full status "$SERVICE_NAME"

echo "Checking health endpoint..."
curl --fail --silent --show-error "$HEALTH_URL"
echo
echo "Deploy complete."
