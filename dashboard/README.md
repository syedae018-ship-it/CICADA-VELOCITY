# M4: Dashboard, Demo & Docs (`dashboard/` + `demo/` + `docs/`)

> Full phased build guide: [`docs/members/PERSON_D_dashboard_demo.md`](../docs/members/PERSON_D_dashboard_demo.md)

**Owner:** _fill in_ · **Branch:** `feature/<name>` · Next.js · **Port 3000**

## Mission
Make the system **visible and provable** to the judges, own the demo, and own the Phase 1/2 deliverables.

## Run
```bash
cd dashboard && npm install && npm run dev     # http://localhost:3000
```
`NEXT_PUBLIC_SAAS_URL` (default `http://localhost:8000`) and `NEXT_PUBLIC_COLLECTOR_URL` (default `http://localhost:8001`).
Until the APIs exist, render from `contracts/sample_payloads/` and the shapes in `contracts/aiops_output.md`.

## Dashboard checklist (`dashboard/`)
- [ ] Tenant switcher (`demo-t_acme` / `demo-t_globex` token) to show tenant isolation live
- [ ] **Fleet view:** collectors with online/offline, last seen, version, buffer depth, CPU/mem, config hash
- [ ] **Sources grid:** Excellent/Good/Fair/Poor badge + **reason** + stale indicator
- [ ] Metric charts by event time (CPU, mem, latency, packet loss)
- [ ] **Alerts & incidents:** explanation, contributing signals, confidence, merged alert count
- [ ] **Recommendation card:** reasoning path → Approve → audit → Rollback
- [ ] **Egress proof panel** (from collector `/local/egress`): exact JSON + sha256 + result
- [ ] **Side-by-side page:** raw record with secret (collector `/local/raw`) next to what SaaS stored
- [ ] **Reliability panel:** p95 latency, alert latency, sent vs received IDs, duplicates rejected
- [ ] Live updates via SSE `/api/v1/stream` (fallback: poll every 2 s)
- [ ] Health history timeline (UTC, rendered in local time)
- [ ] `/login` page already exists (`src/components/LoginForm.tsx`); hook it to the demo token later

## Demo checklist (`demo/`)
- [ ] `simulator.py` scenarios work for all 8 cases in `docs/PLAN.md`
- [ ] `demo/scenarios/*.sh`: one command per scenario
- [ ] Demo script: who clicks what, in which order (≈ 7 min)

## Docs checklist (`docs/`)
- [ ] Phase 1: one-page data-flow sketch with trust boundary (start from `ARCHITECTURE.md`)
- [ ] Phase 2: diagram with labelled hops, payload schema, failure plan, tenant isolation
- [ ] Slides + **Limitations** slide (SQLite, single process, simulated remediation, etc.)
