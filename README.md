# Velocity Cicada: Secure Two-Tier AIOps Observability

CICADA 2026 · 24-hour hackathon · TechForcz × Atria Institute of Technology

A **local collector** processes telemetry inside the customer environment, keeps raw data and secrets
local, and sends only **allow-listed metadata** to a **multi-tenant SaaS** that detects anomalies,
correlates incidents and gives **explainable recommendations**.

## Start here (every member)
1. Read [`docs/TEAM_RULES.md`](docs/TEAM_RULES.md): branches, ownership, merging
2. Read [`contracts/README.md`](contracts/README.md): the shared agreements you build against
3. Read your module spec:

| Module | Spec | Folders | Owner |
|---|---|---|---|
| M1 Collector & Privacy | [`collector/README.md`](collector/README.md) | `collector/` | _fill in_ |
| M2 Transport, Reliability & Ingest | [`transport/README.md`](transport/README.md) | `transport/`, `saas/ingest/`, `saas/db.py` | _fill in_ |
| M3 AIOps Engine | [`saas/aiops/README.md`](saas/aiops/README.md) | `saas/aiops/` | _fill in_ |
| M4 Dashboard, Demo & Docs | [`dashboard/README.md`](dashboard/README.md) | `dashboard/`, `demo/`, `docs/` | _fill in_ |

Also: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (diagram, trust boundary, failure handling) ·
[`docs/PLAN.md`](docs/PLAN.md) (priorities, timeline, the 8 live scenarios)

## Stack
Python 3.11+ · FastAPI (collector + SaaS) · SQLite · Next.js + Tailwind (dashboard)

## Run everything
```bash
cp .env.example .env
./scripts/dev.sh
```
| What | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| SaaS API docs | http://localhost:8000/docs |
| Collector local API docs | http://localhost:8001/docs |

Feed it telemetry: `python demo/simulator.py` (or `--stdout` to just print records).

Check contracts: `.venv/bin/python contracts/validate.py`

## Layout
```
contracts/     shared schemas & API (ALL: change by agreement only)
collector/     Tier 1 collector + local API          (M1)
transport/     signing, outbox, retry, egress log    (M2)
saas/ingest/   ingest, heartbeat, dedupe, storage    (M2)
saas/aiops/    baselines, health, incidents, recs    (M3)
saas/app.py    SaaS entrypoint                       (shared)
dashboard/     Next.js UI                            (M4)
demo/          simulator + scenario scripts          (M4)
docs/          architecture, plan, rules, slides     (M4)
scripts/       dev tooling                           (shared)
```
