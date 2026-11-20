#!/usr/bin/env bash
# Start SaaS (8000), collector (8001) and dashboard (3000). Ctrl+C stops all.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
[ -d dashboard/node_modules ] || (cd dashboard && npm install)
[ -f .env ] && set -a && . ./.env && set +a

trap 'kill 0' EXIT
.venv/bin/uvicorn saas.app:app --port 8000 --reload &
.venv/bin/uvicorn collector.app:app --port 8001 --reload &
(cd dashboard && npm run dev) &
wait
