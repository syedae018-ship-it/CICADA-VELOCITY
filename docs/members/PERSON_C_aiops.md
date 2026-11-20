# Person C: AIOps Engine (Tier 2)

**Name:** ______ · **Branch:** `feature/______` · **Your folder:** `saas/aiops/`

> **Your job in one line:** turn metadata into **health states, explained anomalies, correlated
> incidents and recommendations with a visible reasoning path.**

**Judging weight on you:** the AIOps approach in Phase 2, anomaly detection and health states in
Phase 3, and in Phase 4 **"Explainable AIOps recommendations (weighted higher)"** plus live scenarios
**#4 latency, #5 CPU baseline, #6 alert merging, #8 remediation**. The judges explicitly reward going
*beyond static thresholds*.

---

## ⚡ SUPABASE UPDATE (overrides storage/API steps below)
SaaS data lives in **Supabase Postgres**. Person B creates the schema (`contracts/supabase/001_init.sql`) and `saas/db.py`.

| Old | New |
|---|---|
| `store.py` writes to SQLite | Write `alerts`, `incidents`, `recommendations`, `health_history`, `audit_log` via B's `saas/db.py` client (service role). **Always set `tenant_id`.** |
| Baselines in DB | Keep baselines **in memory** (fast). On startup, optionally warm them from the last 15 min of `metrics`. |
| `/api/v1/stream` SSE | **Not needed.** Supabase Realtime pushes inserts/updates of your tables to the dashboard. |
| `/overview`, `/alerts`, `/incidents`, `/health-history`, `/audit` | **Optional.** D reads tables directly with supabase-js + RLS. Make sure your rows contain everything D needs (e.g. `explanation` jsonb, `reasoning_path` jsonb). |
| `demo-<tenant>` auth | Use B's `get_tenant()` (verifies the Supabase JWT) on your remaining endpoints |
| Still yours in FastAPI | `POST /api/v1/recommendations/{id}/approve` and `/rollback` (policy check + audit + status update) |

Write explanations exactly in the `contracts/aiops_output.md` shape into the `jsonb` columns, because the dashboard renders them as-is.

---

## 1. What you own / don't touch
| ✅ You edit | ❌ You don't edit |
|---|---|
| `saas/aiops/` (`engine.py`, `routes.py`, new files) | `saas/ingest/`, `saas/db.py` (B). Ask B for helpers you need. |
| Append-only lines in `requirements.txt` | `saas/app.py` (your router is already included) |
| | `contracts/health_thresholds.json`, `aiops_output.md` (by agreement only) |

## 2. Your interfaces
| Direction | What | Contract |
|---|---|---|
| **IN** | `on_ingest(tenant_id, payload)` called by B after each accepted payload | `payload_schema.json` |
| **IN** | B's `saas/db.py`: `db_for_tenant()`, `tenant_query()` | `contracts/db_tables.md` |
| **CONFIG** | Thresholds, anomaly z-levels, staleness | `contracts/health_thresholds.json` |
| **OUT** | Rows in `alerts`, `incidents`, `recommendations`, `health_history`, `audit_log` | `contracts/aiops_output.md` |
| **OUT** (to D) | `/api/v1/overview`, `/alerts`, `/incidents`, `/incidents/{id}`, `/health-history`, `/audit`, `/recommendations/{id}/approve|rollback`, `/stream` (SSE) | `contracts/api.md` §B |

## 3. Setup (once)
```bash
git fetch origin && git checkout feature/<you> && git merge origin/main
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn saas.app:app --port 8000 --reload
```

---

## 4. Your phases

### Phase C1: Ideation support (hours 0.5–2)
- [ ] Give D the **AIOps approach** for slides: baseline → z-score → health state → correlation window → rule-based recommendations with reasoning
- [ ] Decide the recommendation rule table (below) with the team

### Phase C2: Engine core in memory (hours 2–8). No DB needed yet.
Suggested files:
```
saas/aiops/
  thresholds.py    # load contracts/health_thresholds.json
  baseline.py      # rolling stats per (tenant, source, metric)
  health.py        # metric → state, worst-of, staleness, reasons
  detect.py        # anomalies → Alert dicts
  correlate.py     # alerts → incidents
  recommend.py     # incident → recommendation
  store.py         # in-memory first; later writes via B's db helpers
  engine.py        # on_ingest wires it all
  routes.py        # read API
  dev_replay.py    # feeds sample payloads in a loop for solo testing
```
- [ ] **Baseline:** for each `(tenant, source_id, metric)` keep a deque of `(event_time, value)` for the last 15 min; compute mean/std (or EWMA mean + EW variance with α≈0.1)
- [ ] **Anomaly:** `z = (x - mean) / max(std, floor)`, using a floor per metric (e.g. cpu 2.0, latency 5 ms) so flat baselines don't explode. Anomaly if `z ≥ z_good` **for ≥ 2 consecutive samples** (prevents single-spike false alarms; this answers "real anomaly vs normal spike").
- [ ] **Do not add an anomalous value to its own baseline** (or the baseline chases the spike)
- [ ] **Health per source:** state per metric from thresholds; bump up by anomaly z-level; `service_up/connectivity_ok == false` → poor; worst-of = source state; record `reason` e.g. `"cpu_pct 91.4 > fair_max 90 and +4.8σ vs baseline"`
- [ ] **Staleness:** a timer every 5 s (start it from `engine.py → startup()`): source with no data for 30 s → downgrade one level, reason `"stale: no data for 34s"`. Never show the last good value as current.
- [ ] Every state **change** → `health_history` row (UTC, prev, new, reason)
- [ ] Alerts exactly in the `aiops_output.md` shape, **with `explanation`**
- [ ] `dev_replay.py`: load `contracts/sample_payloads/0*.json`, rewrite timestamps to "now", call `on_ingest` in a loop with noise, then inject a spike

**Done when:** `python -m saas.aiops.dev_replay` prints a health change and an explained CPU anomaly alert.

Core sketch:
```python
def on_ingest(tenant_id, payload):
    for src in payload["sources"]:
        for metric, value in src["metrics"].items():
            if isinstance(value, bool): continue
            b = baselines[(tenant_id, src["source_id"], metric)]
            z = b.zscore(value)
            if not b.is_anomalous(z): b.add(src["event_time_utc"], value)
            maybe_alert(tenant_id, src, metric, value, z, b)
        update_health(tenant_id, src)
    for ev in payload["events"]:
        security_or_event_alert(tenant_id, ev)
    correlate(tenant_id)
```

### Phase C3: Integration #1 (≈ hour 8)
- [ ] Switch `store.py` to B's `db_for_tenant()` / `tenant_query()` once B merges. **Every** query is tenant-scoped.
- [ ] Merge to `main`; watch real payloads from the simulator trigger your engine

### Phase C4: Read API + health (hours 8–16)
- [ ] `/api/v1/overview`: `overall_state` = worst source state; collectors online/offline (read B's `collectors` table); `sources[]` with state + reason + last_seen
- [ ] `/api/v1/alerts`, `/api/v1/health-history`
- [ ] Tenant from `Authorization: Bearer demo-<tenant_id>`. Write a `get_tenant()` dependency, reject anything else with 401.
- [ ] `/api/v1/stream` SSE: push `{type, data}` on new metric batch / alert / incident / state change (`asyncio.Queue` per tenant). D needs this for the < 10 s target.
- [ ] Offline collectors (B marks them) → alert `kind: offline`, severity critical

### Phase C5: Intelligence (hours 16–20). This is where Phase 4 marks are.
- [ ] **Correlation (`correlate.py`):** open alerts for the same `service` (or same source) within **120 s** → one incident. New matching alert → attach, `alert_count += 1`. Same `(source, metric, kind)` repeating → don't create a new alert, increment `suppressed_duplicates`. `likely_cause` = the earliest alert's signal. Title = `"<service> degradation: cpu + latency"`.
- [ ] **Recommendations (`recommend.py`)**, a rule table with confidence:

| Pattern in incident | Action | Confidence |
|---|---|---|
| cpu/mem anomaly first, then latency on same service | Investigate top CPU consumers; scale service +1 replica | 0.75 |
| latency + packet loss on network source | Check link/interface on affected switch; reroute | 0.7 |
| `failed_login_burst` ≥ 20 | Temporarily rate-limit / lock source; review auth logs **locally** | 0.8 |
| collector offline | Check collector host/network; buffered data will replay | 0.9 |
| disk_pct trending up | Clean up / extend volume before 95% | 0.6 |

  Each recommendation includes `reasoning_path` (ordered facts with timestamps and σ), `contributing_signals`, `risk`, `policy_check`, `rollback_plan`.
- [ ] **Remediation sim:** `POST /recommendations/{id}/approve` → policy check (allowed actions list) → `audit_log` (actor, action, target) → status `executed_simulated`; `/rollback` → `rolled_back` + audit. **No real actions.**
- [ ] `/api/v1/incidents`, `/incidents/{id}` (with alerts + recommendations), `/api/v1/audit`

### Phase C6: Freeze & demo (hours 20–24)
- [ ] Tune thresholds against the organizer stream so normal traffic stays Excellent/Good (**few false alarms** is scored)
- [ ] Rehearse #4, #5, #6, #8

---

## 5. Test alone
```bash
.venv/bin/python -m saas.aiops.dev_replay                 # engine without ingest
python demo/simulator.py --scenario incident               # after integration
curl -H "Authorization: Bearer demo-t_acme" localhost:8000/api/v1/incidents
curl -H "Authorization: Bearer demo-t_globex" localhost:8000/api/v1/incidents   # must NOT show Acme's
```

## 6. Judge questions you answer
- **"Real anomaly vs normal spike?"** Per-source 15-min baseline, z-score with noise floors, must persist ≥ 2 samples, and confidence rises when correlated signals agree.
- **"How do you correlate alerts?"** Same service/source within 120 s → one incident; repeats suppressed and counted; the earliest signal is the likely cause.
- **"Why this recommendation?"** Open the incident: the reasoning path lists each signal, its deviation, its timing, and the rule that fired.
- **"Safeguards before automation?"** Policy allow-list, human approval, audit log, rollback plan, simulation only. That is stage 5 of the roadmap and future work.

## 7. Before every merge
MERGE_GUIDE §4 checklist + run `dev_replay` and the cross-tenant `curl` check.
