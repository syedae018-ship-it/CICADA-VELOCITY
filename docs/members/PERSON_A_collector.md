# Person A: Collector & Privacy (Tier 1)

**Name:** ______ · **Branch:** `feature/______` · **Port:** 8001 · **Your folder:** `collector/`

> **Your job in one line:** turn raw telemetry into safe, allow-listed metadata, and prove that
> secrets and raw logs never leave the customer environment.

**Judging weight on you:** the "local data protection" parts of Phases 1–3 and live scenarios
**#1 (secret in log)** and **#3 (failed logins)**. The judges' first demand is "prove raw data stays
local". That proof is yours.

---

## 1. What you own / don't touch
| ✅ You edit | ❌ You don't edit |
|---|---|
| `collector/` (all files, including `routes.py`, `config.py`, `adapters/`) | `collector/app.py` beyond adding your own logic imports (routers are already wired) |
| Your tests in `collector/tests/` | `transport/` (Person B), `saas/` (B, C), `dashboard/` (D) |
| Append-only lines in `requirements.txt` | `contracts/` (only via agreement, see MERGE_GUIDE §6) |

## 2. Your interfaces
| Direction | What | Contract |
|---|---|---|
| **IN** | `POST /local/raw` with one `RawRecord` JSON | `contracts/raw_input.md` |
| **OUT** | Every 5 s: `transport.submit(payload_dict)` | `contracts/payload_schema.json` (leave `payload_id`, `seq`, `sent_at_utc` for B to set, or set placeholders) |
| **OUT** | `GET /local/raw`, `GET /local/detections` for D's side-by-side view | `contracts/api.md` §C |

Read these first: `contracts/raw_input.md`, `contracts/allowlist.md`, `contracts/redaction_rules.json`, `contracts/payload_schema.json`.

## 3. Setup (once)
```bash
git fetch origin && git checkout feature/<you> && git merge origin/main
cp .env.example .env
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn collector.app:app --port 8001 --reload     # http://localhost:8001/docs
python demo/simulator.py --scenario secret                   # in another terminal
```

---

## 4. Your phases

### Phase A1: Ideation support (hours 0.5–2)
- [ ] Give Person D the final list for the Phase 1 slide: **what is sent / redacted / stays local** (start from `contracts/allowlist.md`)
- [ ] Give 3 concrete "before → after" redaction examples (raw line → redacted line → payload)

**Done when:** D has the allow-list slide content.

### Phase A2: Core pipeline against mocks (hours 2–8)
Suggested files:
```
collector/
  adapters/simulator.py   # dict → RawRecord (validate kind, ts)
  redact.py               # load redaction_rules.json, redact(text) -> (text, count)
  pseudo.py               # source_id(host) = "src_" + hmac(SITE_SALT, host)[:12]
  store.py                # SQLite collector/data/collector.db: raw_records, detections
  aggregate.py            # 5-s windows per source → payload dict
  detect.py               # failed-login burst detection
  routes.py               # POST/GET /local/raw, GET /local/detections
```
- [ ] `POST /local/raw`: accept a record → **redact every string field** → store `raw_json` (original) + `redacted_json` in `raw_records`
- [ ] `redact.py`: apply the rules in order; return the count for `redaction_stats.secrets_redacted`
- [ ] `pseudo.py`: stable `src_xxxxxxxxxxxx` per host. **SITE_SALT never leaves.**
- [ ] `aggregate.py`: a background task (start it from `collector/routes.py → startup()`) every 5 s builds ONE payload: `sources[]` (latest metric values per source, `event_time_utc` = newest sample), `events[]`, `collector_health`, `redaction_stats`, `window`
- [ ] **Build the payload by picking allowed fields**, never by deleting bad ones from the raw dict. Count everything you didn't copy as `fields_dropped`.
- [ ] Call `transport.submit(payload)`. The stub writes to `collector/data/pending_payloads.jsonl`.
- [ ] Validate each payload yourself in a test with `jsonschema` against `contracts/payload_schema.json`

**Done when:** running the simulator produces a valid payload every 5 s in `pending_payloads.jsonl`, and `grep -E "hunter2|eyJ|@acme|10\.0\." collector/data/pending_payloads.jsonl` returns **nothing**.

Skeleton for the core idea:
```python
# aggregate.py (sketch)
ALLOWED_METRICS = {"cpu_pct","mem_pct","disk_pct","latency_ms","packet_loss_pct","bandwidth_mbps","service_up","connectivity_ok"}

def build_payload(window_records, stats) -> dict:
    sources = {}
    for r in window_records:
        if r["kind"] != "metric": continue
        sid = source_id(r["host"])
        s = sources.setdefault(sid, {"source_id": sid, "source_type": r["source_type"],
                                     "service": r["service"], "metrics": {}, "event_time_utc": r["ts"]})
        s["metrics"].update({k: v for k, v in r["metrics"].items() if k in ALLOWED_METRICS})
        s["event_time_utc"] = max(s["event_time_utc"], r["ts"])
    return {"schema_version": "1.0", "tenant_id": TENANT_ID, "collector_id": COLLECTOR_ID,
            "region": REGION, "source_tz": SOURCE_TZ, "window": {...},
            "sources": list(sources.values()), "events": detect_events(window_records),
            "collector_health": {...}, "redaction_stats": stats}
```

### Phase A3: Integration #1 (≈ hour 8)
- [ ] Merge to `main` (see MERGE_GUIDE §3). Once B's real `submit()` is merged, your payloads flow to SaaS with **no code change** on your side.
- [ ] Sit with B for 15 min: run the simulator and see your payload accepted by SaaS.

### Phase A4: Prototype features (hours 8–16)
- [ ] **Failed-login detection** (`detect.py`): count `kind=auth, outcome=failure` per source in a sliding 60 s window. ≥ 5 → event `failed_login_burst`, severity `high` (≥ 20 → `critical`), summary **templated**: `f"{n} failed logins in 60s on {sid} from {k} distinct origins"`. Store the users/IPs **only** in the local `detections` table.
- [ ] Map `kind=log` lines with level WARN/ERROR into `warning_recurring` events (count only, templated summary)
- [ ] `service_up=false` → `service_down` event; network `connectivity_ok=false` → `link_down`
- [ ] `GET /local/raw?limit=50` returns `[{received_utc, raw, redacted}]`. This is the "secret visible locally" half of the side-by-side proof.
- [ ] `GET /local/detections`
- [ ] Local retention: delete `raw_records` older than `LOCAL_RETENTION_HOURS` (background task every minute)
- [ ] Collector self-metrics for `collector_health` (use `psutil` if allowed, else `os.getloadavg`)

**Done when:** scenarios #1 and #3 work end to end and nothing sensitive appears in SaaS.

### Phase A5: Hardening (hours 16–20)
- [ ] `collector/tests/test_privacy.py`: feed the nastiest raw record you can (all secret types) → assert none of the original strings appear in `json.dumps(payload)`
- [ ] Adapter for the **organizer stream** as soon as its format is known (`adapters/organizer.py`); only the adapter changes
- [ ] Config hash: `sha256` of the active config + rules → `collector_health.config_hash`

### Phase A6: Freeze & demo (hours 20–24)
- [ ] Rehearse scenarios #1 and #3 three times
- [ ] Prepare your answers (below)

---

## 5. Test alone
```bash
python demo/simulator.py --stdout --ticks 3 --scenario secret      # see raw input
python demo/simulator.py --scenario logins                         # POSTs to your collector
tail -f collector/data/pending_payloads.jsonl                      # your output (until B merges)
.venv/bin/pytest collector/tests -q
```

## 6. Judge questions you answer
- **"Exactly what leaves?"** The schema fields only. Show `contracts/payload_schema.json` (`additionalProperties: false`) and the egress panel.
- **"How do you decide which fields are allowed?"** We build the payload by **copying allow-listed fields**, never by removing bad ones, so a new unknown field can never leak by default.
- **"How do you stop secrets leaking accidentally?"** Three layers: (1) regex redaction on ingest, (2) allow-list construction, (3) schema validation in transport **and** in SaaS. Summaries are templates, never log text.
- **"Can SaaS reverse the source IDs?"** No. It's an HMAC with a salt that exists only on the collector.

## 7. Before every merge
MERGE_GUIDE §4 checklist + `grep` your pending payloads for secrets.
