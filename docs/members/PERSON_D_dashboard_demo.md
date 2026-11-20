# Person D: Dashboard, Demo & Docs (+ Integrator)

**Name:** ______ · **Branch:** `feature/______` · **Port:** 3000 · **Your folders:** `dashboard/`, `demo/`, `docs/`

> **Your job in one line:** make everything **visible and provable** to the judges, own the
> Phase 1 & 2 presentations, run the final demo, and keep `main` healthy.

**Judging weight on you:** most of Phase 1 (10) and the presentation of Phase 2 (25), the dashboard,
**4 health states** and **egress proof panel** in Phase 3, and the whole Phase 4 story (30).
Remember the judges' rule: *"Do not score a team highly only because its dashboard looks polished."*
Every screen must be backed by **live** data.

---

## 1. What you own / don't touch
| ✅ You edit | ❌ You don't edit |
|---|---|
| `dashboard/` (Next.js), `demo/` (simulator + scenarios), `docs/` | `collector/`, `transport/`, `saas/` |
| Final-stage merges after the hour-20 freeze | `contracts/` (by agreement only) |

## 2. Your interfaces
| Direction | What | Source |
|---|---|---|
| **IN** | SaaS read API + SSE (port 8000) | `contracts/api.md` §B (C: overview/alerts/incidents; B: collectors/metrics/reliability) |
| **IN** | Collector local API (port 8001): raw view, egress panel, buffer | `contracts/api.md` §C (A: raw/detections; B: egress/buffer) |
| **OUT** | Raw telemetry from `demo/simulator.py` → `POST /local/raw` | `contracts/raw_input.md` |

## 3. Setup (once)
```bash
git fetch origin && git checkout feature/<you> && git merge origin/main
cd dashboard && npm install && npm run dev         # http://localhost:3000
```

---

## 4. Your phases

### Phase D1: Ideation pitch (hours 0.5–2). Phase 1 = 10 marks.
Build `docs/phase1.md` (or slides) with:
- [ ] Problem: why raw telemetry must stay local and SaaS gets metadata only
- [ ] 4 use cases: infra health, network latency/loss, failed logins, collector fleet health
- [ ] **One-page data-flow sketch with the trust boundary** (from `ARCHITECTURE.md`)
- [ ] Allow-list: sent / redacted / local (from A, `contracts/allowlist.md`)
- [ ] Prioritised features + minimum viable demo (`PLAN.md`)
- [ ] Team roles (A–D) and the simulated-telemetry plan (`demo/simulator.py` → organizer stream adapter)
- [ ] Global awareness: regions, UTC, residency

### Phase D2: Dashboard against mocks + Phase 2 deck (hours 2–8)
- [ ] `dashboard/src/lib/api.ts`: `USE_MOCKS` flag; mock data copied from `contracts/sample_payloads` and `contracts/aiops_output.md` into `src/lib/mock.ts`
- [ ] Layout: sidebar with **Overview · Fleet · Incidents · Egress Proof · Privacy (side-by-side) · Reliability · History**, and a tenant switcher (Acme / Globex)
- [ ] **Overview:** overall state, sources grid with **Excellent/Good/Fair/Poor badges + reason + "stale" tag**
- [ ] **Fleet:** collectors table: online/offline, last seen (relative + UTC), version, buffer depth, CPU/mem, config hash
- [ ] Health colours: Excellent = green, Good = teal, Fair = amber, Poor = red (+ text label for accessibility)
- [ ] Phase 2 deck: architecture diagram with **every hop labelled** (H1–H4), payload schema, allow-list mechanism, failure handling, tenant isolation, scalability path, global-ready design (from B and C)

**Done when:** all pages render from mocks, and the Phase 2 deck is ready.

### Phase D3: Integration #1, which you lead (≈ hour 8)
- [ ] Flip `USE_MOCKS=false` page by page as B and C merge their APIs
- [ ] Run the full pipe: `./scripts/dev.sh` + `python demo/simulator.py`; post in chat what's broken and whose it is
- [ ] Keep a short `docs/INTEGRATION_LOG.md`: time, what was tested, result

### Phase D4: Proof screens (hours 8–16). Phase 3 = 35 marks.
- [ ] **Egress Proof Panel** (mandatory): list from collector `/local/egress`: payload_id, seq, sent time, attempts, result, sha256; click → **exact JSON** pretty-printed. Add a "matches SaaS ✓" badge by comparing with what SaaS received if B exposes it.
- [ ] **Privacy side-by-side:** left = collector `/local/raw` (raw line with `password=hunter2` highlighted red, plus the redacted version); right = what SaaS stored for the same window (metrics/events only). Label the columns "Customer environment (Tier 1)" and "SaaS (Tier 2)".
- [ ] Metric charts by **event time** (CPU, mem, latency, packet loss). Use `recharts`, added to `package.json` (see MERGE_GUIDE §5 for lockfile conflicts).
- [ ] Live updates via SSE `/api/v1/stream`, with fallback polling every 2 s
- [ ] **Latency measurement:** for each metric update, compute `render_time - event_time_utc`; show p95 on the Reliability page (this is how the 10 s target is proven)

### Phase D5: Intelligence screens + scenarios (hours 16–20)
- [ ] **Incident page:** title, severity, affected sources, merged alert count + "N duplicates suppressed", timeline of alerts
- [ ] **Recommendation card:** action, confidence bar, **reasoning path** as numbered steps, contributing signals as chips, risk, policy check → **Approve** → audit entry appears → **Rollback**
- [ ] **Reliability page:** received count, duplicates rejected, seq gaps, p95 latency, last alert latency, outage buffer depth graph
- [ ] **History page:** health transitions with UTC timestamps shown in local time + reason
- [ ] `demo/scenarios/` one command each:
  - `01_secret.sh` → `simulator.py --scenario secret --ticks 10`
  - `02_outage.sh` → (from B) link off 60 s, then on
  - `03_logins.sh`, `04_latency.sh`, `05_cpu.sh`, `06_incident.sh`
  - `07_replay.sh` → (from B) duplicate + late payload
  - `08_remediation.md` → click path

### Phase D6: Freeze, rehearse, present (hours 20–24)
- [ ] At hour 20 announce **freeze**; you merge only fixes
- [ ] `docs/DEMO_SCRIPT.md`: the 7-minute story from `PROJECT.md` §6, who clicks what
- [ ] Rehearse the full demo **twice** with a timer, plus one run where judges "inject" a random scenario
- [ ] Final slides: problem → architecture → live demo → **Limitations** (SQLite, single node, simulated remediation, self-signed TLS, regex redaction can miss novel secrets) → future (Kafka, ML models, Autonomous Ops with policy engine)
- [ ] Q&A prep: everyone answers the questions in their own guide; you know which person answers which

---

## 5. Test alone
```bash
cd dashboard && npm run dev                         # mocks on
python demo/simulator.py --stdout --ticks 5         # see what the collector receives
npx next build                                      # must pass before every merge
```

## 6. Judge questions you route
| Question | Who answers |
|---|---|
| What leaves / how do you stop secrets? | A |
| SaaS down? duplicates? auth? regions? scale? | B |
| Anomaly vs spike? correlation? why this action? safeguards? | C |
| Show the egress panel / side-by-side / last payload | D drives the screen |

## 7. Before every merge
MERGE_GUIDE §4 checklist + `npx next build` passes + no hard-coded data left on pages that have a live API.
