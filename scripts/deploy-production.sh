#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${1:-$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)}"
SERVICE_NAME="${SERVICE_NAME:-criteoscreens}"
PORT_VALUE="${PORT:-3100}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT_VALUE}/api/health}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-30}"
HEALTH_RETRY_INTERVAL_SECONDS="${HEALTH_RETRY_INTERVAL_SECONDS:-1}"

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

echo "Waiting for health endpoint (${HEALTH_TIMEOUT_SECONDS}s timeout)..."
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))

while true; do
  if health_response="$(curl --fail --silent "$HEALTH_URL" 2>/dev/null)"; then
    echo "$health_response"
    echo "Deploy complete."
    exit 0
  fi

  if (( SECONDS >= deadline )); then
    echo "Health check did not pass within ${HEALTH_TIMEOUT_SECONDS}s: ${HEALTH_URL}" >&2
    curl --fail --silent --show-error "$HEALTH_URL" || true
    echo "Recent ${SERVICE_NAME} logs:" >&2
    sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager >&2 || true
    exit 1
  fi

  sleep "$HEALTH_RETRY_INTERVAL_SECONDS"
done
