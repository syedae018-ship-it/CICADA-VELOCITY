# Velocity Cicada: Secure Two-Tier AIOps Observability

**CICADA 2026 · 24-hour hackathon · TechForcz × Atria Institute of Technology**

A **local collector** inside each customer environment collects telemetry, **redacts secrets and keeps raw
data local**, and sends only **allow-listed metadata** to a **multi-tenant SaaS**. The SaaS learns
per-source baselines, detects anomalies, **correlates alerts into incidents**, and proposes
**explainable, human-approved remediation**, while proving byte-for-byte what left each site.

> **Judges' key question:** *Can you show exactly what the collector sends, prove raw data stays local, and
> turn metadata into an actionable recommendation?* Open the **Egress Proof** and **Privacy Side-by-Side**
> views, then inject any scenario from the top bar.

---

## Run it (one command)

```bash
cp .env.example .env        # optional: add Supabase keys (empty = local SQLite)
./scripts/dev.sh            # or: ./scripts/dev.sh --prod   (production dashboard build)
```

| Service | URL |
|---|---|
| **Dashboard** | http://localhost:3000 (`?view=incidents&tenant=t_acme` deep links) |
| SaaS API (Tier 2) | http://localhost:8000/docs |
| Collector · Acme · `ap-south-1` (Tier 1) | http://localhost:8001/docs |
| Collector · Globex · `eu-west-1` (Tier 1) | http://localhost:8002/docs |

Baseline telemetry starts automatically. Inject live scenarios from the dashboard's **Inject scenario** menu,
or from a terminal:
```bash
curl -X POST localhost:8001/local/demo/cpu_spike     # secret · cpu_spike · latency · correlation · logins · outage · duplicate · out_of_order · normal
```

Requirements: Python 3.11+, Node 20+. First run installs everything into `.venv/` and `dashboard/node_modules/`.

---

## Windows desktop collector (installable)

A standalone **Tkinter desktop app** that runs on any Windows 10/11 machine, collects local telemetry, redacts
secrets locally and uploads only allow-listed metadata directly to Supabase — zero third-party HTTP dependencies
(only `psutil`).

```
cicada-local-collector/
├── collector/                    all source modules (metrics, redaction, allow-list, Supabase upload)
├── cicada-collector.spec         PyInstaller spec  → CICADA-Collector.exe
├── build_windows.ps1             one-shot build script (runs tests → PyInstaller → Inno Setup)
├── installer/CICADA-Collector.iss Inno Setup installer script
├── supabase/migrations/          Postgres schema (run once in Supabase SQL Editor)
└── README_WINDOWS.md             end-user install + enrollment guide
```

Build the installer on Windows:
```powershell
cd cicada-local-collector
.\build_windows.ps1
# produces dist\installer\CICADA-Local-Collector-Setup-v<version>.exe
```

See [`cicada-local-collector/README_WINDOWS.md`](cicada-local-collector/README_WINDOWS.md) for user-facing
enrollment steps. The two-tier SaaS above and the desktop collector share Supabase but write to independent
tables, so the main stack keeps working unchanged.

---

## Architecture

```
 TIER 1 · CUSTOMER ENVIRONMENT (per tenant)                          TIER 2 · SaaS (multi-tenant, metadata only)
 ┌───────────────────────────────────────────┐                      ┌────────────────────────────────────────────┐
 │ telemetry ─▶ collector/                   │                      │ saas/ingest   verify HMAC · schema ·       │
 │   adapt · REDACT · allow-list · aggregate │   HTTPS + HMAC        │               dedupe · store by event time │
 │   local failed-login detection            │ ───────────────────▶ │ saas/aiops    baselines · anomalies ·      │
 │ transport/                                │  allow-listed         │               health · incidents · recs    │
 │   payload_id · seq · outbox · retry ·     │  metadata ONLY        │ Supabase      Postgres + RLS + Auth        │
 │   egress proof log · heartbeat            │                      │ dashboard/    Next.js console              │
 └───────────────────────────────────────────┘                      └────────────────────────────────────────────┘
        raw logs, secrets, users, IPs never cross this line ───┘
```
Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Requirement coverage: [`docs/FEATURE_MATRIX.md`](docs/FEATURE_MATRIX.md) · Demo: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)

## Repository layout

```
contracts/           the shared agreements: payload schema, allow-list, redaction rules, API, thresholds, Supabase SQL
collector/           Tier 1 collector: adapters, redaction, pseudonymisation, aggregation, local detection, demo driver
transport/           Tier 1 → Tier 2: signing, outbox, retry/backoff, egress proof log, heartbeat
saas/
  ingest/            Tier 2 ingest: auth, validation, idempotency, storage, reliability metrics, offline detection
  aiops/             baselines, anomaly detection, health states, correlation, recommendations, remediation
  db.py              storage: Supabase (RLS) or SQLite fallback
dashboard/           Next.js operator console (live data, falls back to sample data when offline)
demo/                telemetry simulator (stand-in for the organizer stream)
docs/                architecture, feature matrix, demo script, plan, team rules, member guides
scripts/dev.sh       starts everything
tests/               backend + integration tests  ·  collector/tests: privacy tests
```

## Stack
Python · FastAPI · **Supabase** (Postgres, Row Level Security, Auth) · SQLite (collector-local, fallback) ·
Next.js 16 · React 19 · Tailwind 4 · Poppins / Helvetica / JetBrains Mono

## Supabase setup (optional)
1. SQL Editor → run [`contracts/supabase/001_init.sql`](contracts/supabase/001_init.sql) (safe to re-run).
2. Put `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env`.
3. Demo users `acme@demo.test` / `globex@demo.test` are linked in `tenant_members`; set their passwords in SQL to use **Sign in**.

## Tests
```bash
.venv/bin/python -m pytest          # privacy, transport, ingest, AIOps, end-to-end integration
.venv/bin/python contracts/validate.py
```

## Team
| | Module | Folders |
|---|---|---|
| Tauheed | Collector & privacy | `collector/` |
| Mustafa | Transport, reliability & ingest | `transport/`, `saas/ingest/`, `saas/db.py` |
| Faheem | AIOps engine | `saas/aiops/` |
| Mujeeb | Dashboard, demo & docs | `dashboard/`, `demo/`, `docs/` |
