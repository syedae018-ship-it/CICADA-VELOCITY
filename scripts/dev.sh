#!/usr/bin/env bash
# Velocity Cicada: start the whole platform with one command.
#
#   ./scripts/dev.sh            development (hot reload)
#   ./scripts/dev.sh --prod     production build of the dashboard (next build + next start)
#   ./scripts/dev.sh --no-ui    backend only (SaaS + both collectors)
#
# Starts:
#   SaaS (Tier 2)                 http://localhost:${SAAS_PORT:-8000}   (/docs for the API)
#   Collector Acme  (ap-south-1)  http://localhost:${ACME_PORT:-8001}   tenant t_acme,  site in Mumbai
#   Collector Globex (eu-west-1)  http://localhost:${GLOBEX_PORT:-8002} tenant t_globex, site in Frankfurt
#   Dashboard                     http://localhost:${DASHBOARD_PORT:-3000}
# Ports can be overridden with the variables above. Ctrl+C stops everything.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

MODE="dev"; UI=1
for arg in "$@"; do
  case "$arg" in
    --prod) MODE="prod" ;;
    --no-ui) UI=0 ;;
    *) echo "unknown option: $arg"; exit 2 ;;
  esac
done

# ── dependencies (first run only) ──
if [ ! -x .venv/bin/uvicorn ]; then
  echo "▸ creating Python venv and installing requirements…"
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
if [ "$UI" = 1 ] && [ ! -d dashboard/node_modules ]; then
  echo "▸ installing dashboard dependencies…"
  (cd dashboard && npm install --no-audit --no-fund)
fi

# ── configuration ──
[ -f .env ] || { cp .env.example .env; echo "▸ created .env from .env.example (edit it for Supabase)"; }
set -a; . ./.env; set +a

SAAS_PORT="${SAAS_PORT:-8000}"; ACME_PORT="${ACME_PORT:-8001}"
GLOBEX_PORT="${GLOBEX_PORT:-8002}"; DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"
export DASHBOARD_ORIGIN="http://localhost:${DASHBOARD_PORT}"
export DEV_INSECURE="${DEV_INSECURE:-1}" DEMO_CONTROLS="${DEMO_CONTROLS:-1}"
mkdir -p logs

pids=()
cleanup() { echo; echo "▸ stopping…"; kill "${pids[@]}" 2>/dev/null || true; wait 2>/dev/null || true; }
trap cleanup EXIT INT TERM

start() {  # name, log, command…
  local name="$1" log="$2"; shift 2
  "$@" >"logs/$log" 2>&1 &
  pids+=($!)
  echo "▸ $name  (logs/$log)"
}

start "SaaS            :$SAAS_PORT" saas.log \
  .venv/bin/uvicorn saas.app:app --host 127.0.0.1 --port "$SAAS_PORT"

start "Collector Acme  :$ACME_PORT" collector-acme.log env \
  SAAS_URL="http://localhost:$SAAS_PORT" COLLECTOR_ID=c_blr01 TENANT_ID=t_acme REGION=ap-south-1 \
  SOURCE_TZ=Asia/Kolkata COLLECTOR_SECRET=dev-secret-c_blr01 COLLECTOR_DATA_DIR="$ROOT/collector/data" \
  .venv/bin/uvicorn collector.app:app --host 127.0.0.1 --port "$ACME_PORT"

start "Collector Globex:$GLOBEX_PORT" collector-globex.log env \
  SAAS_URL="http://localhost:$SAAS_PORT" COLLECTOR_ID=c_fra01 TENANT_ID=t_globex REGION=eu-west-1 \
  SOURCE_TZ=Europe/Berlin COLLECTOR_SECRET=dev-secret-c_fra01 COLLECTOR_DATA_DIR="$ROOT/collector/data-globex" \
  .venv/bin/uvicorn collector.app:app --host 127.0.0.1 --port "$GLOBEX_PORT"

# Live test data: public Prometheus demo → signed payloads → firewall → SaaS (set PROM_BRIDGE=0 to skip)
if [ "${PROM_BRIDGE:-1}" = 1 ]; then
  start "Prometheus bridge (c_prom01)" prometheus-bridge.log env SAAS_URL="http://localhost:$SAAS_PORT" \
    .venv/bin/python -m demo.prometheus_bridge
fi

if [ "$UI" = 1 ]; then
  export NEXT_PUBLIC_SAAS_URL="http://localhost:$SAAS_PORT"
  export NEXT_PUBLIC_COLLECTOR_URLS="t_acme=http://localhost:$ACME_PORT,t_globex=http://localhost:$GLOBEX_PORT"
  export NEXT_PUBLIC_COLLECTOR_URL="http://localhost:$ACME_PORT"
  if [ "$MODE" = prod ]; then
    echo "▸ building dashboard (production)…"
    (cd dashboard && npx next build >"../logs/dashboard-build.log" 2>&1)
    start "Dashboard       :$DASHBOARD_PORT" dashboard.log bash -c "cd dashboard && npx next start -p $DASHBOARD_PORT"
  else
    start "Dashboard       :$DASHBOARD_PORT" dashboard.log bash -c "cd dashboard && npx next dev -p $DASHBOARD_PORT"
  fi
fi

sleep 4
echo
echo "  SaaS API     http://localhost:$SAAS_PORT/docs   (storage: $(curl -s localhost:$SAAS_PORT/api/v1/health | sed -n 's/.*"storage":"\([a-z]*\)".*/\1/p'))"
echo "  Collectors   http://localhost:$ACME_PORT/docs  ·  http://localhost:$GLOBEX_PORT/docs"
[ "$UI" = 1 ] && echo "  Dashboard    http://localhost:$DASHBOARD_PORT"
echo "  Baseline telemetry is flowing. Inject scenarios from the dashboard (top bar) or:"
echo "    curl -X POST localhost:$ACME_PORT/local/demo/cpu_spike"
echo
wait
