# Person B: Transport, Reliability & Ingest (the trust boundary)

**Name:** ______ · **Branch:** `feature/______` · **Your folders:** `transport/`, `saas/ingest/`, `saas/db.py`, `saas/config.py`

> **Your job in one line:** move metadata from collector to SaaS **securely, exactly once, in
> event-time order, into the right tenant and region**, and keep a perfect record of what left.

**Judging weight on you:** the reliability part of Phase 3 (**10 marks are just real-time and
delivery reliability**), the security controls and global-ready design in Phase 2 (25), and scenarios
**#2 (outage → buffer → resume)** and **#7 (duplicates / out-of-order)**. You also produce the data
for the mandatory **egress proof panel**.

---

## ⚡ SUPABASE UPDATE (overrides the SQLite storage steps in Phase B2/B4)
The SaaS database is **Supabase Postgres** (one project). The **collector side (`transport/`) is unchanged**: outbox and egress log stay in local SQLite.

**Do first (hour 0–2):**
1. Create the Supabase project (region: Mumbai `ap-south-1`). Share the **URL + anon key** with Person D. Keep the **service-role key + JWT secret** in `.env` only, and share them privately with Person C.
2. SQL Editor → run `contracts/supabase/001_init.sql` (tables, indexes, RLS, Realtime, seed tenants/collectors).
3. Authentication → Users → create `acme@demo.test` and `globex@demo.test`, then insert their UUIDs into `tenant_members` (last lines of the SQL file).
4. Smoke test: insert one row with the service key from Python, and confirm it shows in Table Editor.
5. **If Supabase isn't working by hour 3, tell the team and fall back to SQLite.**

**Replace in your plan:**
| Old (SQLite) | New (Supabase) |
|---|---|
| `connect(region)`, `init_schema()` | `saas/db.py → client()` = `create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`; schema already created by SQL |
| `tenant_query()` | `tenant_table(tenant_id, table)` = `client().table(table)` with `.eq("tenant_id", tenant_id)` on every read. The service key bypasses RLS, so you must filter. |
| Dedupe via `IntegrityError` | Insert into `received_payloads`; a unique-violation error (code `23505`) → return `200 duplicate` |
| One insert per metric | **Batch insert** all metric rows of a payload in one call (keeps latency low) |
| Residency = file per region | One project; `tenants.home_region` recorded; per-region projects = production slide |
| `GET /api/v1/collectors`, `/metrics` | Optional: D reads these directly via supabase-js + RLS. Still build `/api/v1/reliability`. |
| Tenant from `demo-<tenant>` token | Verify the **Supabase JWT** (`pyjwt` + `SUPABASE_JWT_SECRET`) → `sub` = user id → `tenant_members` → tenant. Write `get_tenant()` in `saas/ingest/auth.py` and share it with C. |

**New judge answer:** "Tenant isolation is enforced twice: our API filters by tenant, and Postgres Row Level Security blocks any cross-tenant read, including Realtime."

---

## 1. What you own / don't touch
| ✅ You edit | ❌ You don't edit |
|---|---|
| `transport/` (`__init__.py` submit, `router.py`, `signing.py`, new files) | `collector/` (A). Your router is already mounted in `collector/app.py` |
| `saas/ingest/`, `saas/db.py`, `saas/config.py` | `saas/aiops/` (C). Just call `on_ingest()` |
| Append-only lines in `requirements.txt` | `dashboard/`, `demo/` (D) |

## 2. Your interfaces
| Direction | What | Contract |
|---|---|---|
| **IN** (from A) | `transport.submit(payload: dict) -> payload_id` | `payload_schema.json` |
| **OUT** (wire) | `POST /api/v1/ingest`, `POST /api/v1/heartbeat` with HMAC headers | `contracts/api.md` §A |
| **OUT** (to C) | `on_ingest(tenant_id, payload)` after each **accepted** payload | `saas/aiops/engine.py` |
| **OUT** (to C) | `saas/db.py` → `connect(region)`, `tenant_query(...)`, table creation | `contracts/db_tables.md` |
| **OUT** (to D) | `/local/egress`, `/local/buffer`, `/local/saas-link`, `/api/v1/collectors`, `/api/v1/metrics`, `/api/v1/reliability` | `contracts/api.md` §B, §C |

## 3. Setup (once)
```bash
git fetch origin && git checkout feature/<you> && git merge origin/main
cp .env.example .env
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn saas.app:app --port 8000 --reload          # http://localhost:8000/docs
.venv/bin/uvicorn collector.app:app --port 8001 --reload     # http://localhost:8001/docs
```

---

## 4. Your phases

### Phase B1: Ideation support (hours 0.5–2)
- [ ] Give D the **security controls** list for slides: HMAC auth, 300 s replay window, TLS, schema re-validation, tenant from registry, audit
- [ ] Give D the **failure plan** table (from `docs/ARCHITECTURE.md`)

### Phase B2: SaaS storage + ingest first (hours 2–5), because C and D depend on it
- [ ] `saas/db.py`
  - `connect(region)` → `sqlite3` connection to `saas/data/<region>.db` (`check_same_thread=False`, WAL mode)
  - `init_schema()` creates every table from `contracts/db_tables.md` in all 3 region DBs on startup
  - `db_for_tenant(tenant_id)` → connection of the tenant's `home_region` (**residency**)
  - `tenant_query(tenant_id, sql, params)` → refuses SQL without `tenant_id = ?` and always binds it. **C and D's APIs must use this.**
- [ ] `POST /api/v1/ingest` in `saas/ingest/routes.py`:
  1. read **raw body bytes** (needed for HMAC)
  2. look up `X-Collector-Id` in `config.COLLECTORS` → 401 if unknown
  3. `signing.verify(...)` → 401
  4. parse JSON, validate against `payload_schema.json` → 422
  5. body `tenant_id`/`collector_id` must match the registry → 403
  6. `INSERT INTO received_payloads` (payload_id PK) → on `IntegrityError` return `200 {"status":"duplicate"}`
  7. insert `metrics` rows (one per metric value) and `events` with **`event_time_utc` from the payload**, plus `received_at_utc = now`
  8. update `collectors.last_seen_utc`, `status='online'`, `buffer_depth`, version, cpu/mem
  9. `on_ingest(tenant_id, payload)` (wrap in try/except so an AIOps bug never drops data)
  10. return `202 {"status":"accepted"}`
- [ ] `POST /api/v1/heartbeat` (same auth) → update `last_seen_utc` → 204
- [ ] Start these from `saas/ingest/routes.py → startup()` (already called by `saas/app.py`): `db.init_schema()`, then a background task every 5 s: collectors with `now - last_seen > 60 s` → `status='offline'`, insert `health_history` (state `poor`, reason "no heartbeat for 60s"), `audit_log`

**Done when:** `curl` (or a tiny script) can sign and POST `01_normal.json`, sending it twice gives `accepted` then `duplicate`, and `05_other_tenant.json` lands only in `eu-west-1.db`.

Helper script you should write first, `transport/send_sample.py`:
```python
import httpx, json, sys, time
from transport.signing import sign
body = open(sys.argv[1], "rb").read()
h = {"X-Collector-Id": json.loads(body)["collector_id"], "Content-Type": "application/json",
     **sign("dev-secret-" + json.loads(body)["collector_id"], body)}
print(httpx.post("http://localhost:8000/api/v1/ingest", content=body, headers=h).json())
```

### Phase B3: Collector-side transport (hours 5–8)
- [ ] Collector SQLite (`collector/data/collector.db` is OK to share. You own tables `outbox`, `egress_log`.)
- [ ] `submit(payload)`: set `payload_id = uuid4()`, `seq = next_seq()` (persisted), `sent_at_utc = now UTC` **once** → `json.dumps(payload, sort_keys=True, separators=(",",":"))` → validate → insert into `outbox` and `egress_log` with `sha256(body)` → return id. Invalid → `dead_letter` + log, never raise.
- [ ] Sender loop (start it from `transport.startup()`, which the collector already calls on boot): take the oldest pending row → sign → POST **the stored bytes exactly** → on `accepted`/`duplicate` mark sent; on error, backoff `1,2,4,8,15 s`, increment `attempts`
- [ ] Heartbeat task every 10 s
- [ ] `/local/saas-link {"enabled": false}` makes the sender behave as if SaaS is down (demo control)
- [ ] `/local/egress`, `/local/egress/{id}`, `/local/buffer`

**Done when:** simulator → A's collector → your outbox → SaaS works; stopping SaaS grows the buffer; restarting drains it.

### Phase B4: Integration #1 + reliability (hours 8–16)
- [ ] Merge to `main` early (the whole team's integration depends on you)
- [ ] `GET /api/v1/collectors`, `GET /api/v1/metrics?source_id&metric&from&to` (**ORDER BY event_time_utc**)
- [ ] `GET /api/v1/reliability`:
  - `received_count`, `duplicates_rejected` (count them in memory or a table)
  - `seq_gaps`: missing seq numbers per collector
  - `latency_p95_s`: p95 of `received_at_utc - event_time_utc` over the last 5 min
  - `alert_latency_s_last` (ask C to store `created_at_utc`; you compute it)
- [ ] Outage test script `demo/scenarios/outage.sh` (give it to D): stop link → wait 60 s → start link → compare IDs
- [ ] Out-of-order test: send `04_out_of_order_late.json` after newer payloads, then show the metrics query is still in event order

### Phase B5: Global-ready + security polish (hours 16–20)
- [ ] Second collector process for `t_globex`/`eu-west-1` (env vars only) → residency demo
- [ ] TLS: run SaaS with `--ssl-keyfile/--ssl-certfile` (self-signed, generated locally, **not committed**), or explain honestly that dev uses `DEV_INSECURE=1`
- [ ] `audit_log` entry for each accepted batch (counts, not contents)

### Phase B6: Freeze & demo (hours 20–24)
- [ ] Rehearse scenario #2 and #7 three times; have the ID comparison ready to show

---

## 5. Test alone
```bash
.venv/bin/python transport/send_sample.py contracts/sample_payloads/01_normal.json   # accepted
.venv/bin/python transport/send_sample.py contracts/sample_payloads/01_normal.json   # duplicate
.venv/bin/python transport/send_sample.py contracts/sample_payloads/INVALID_leaks_raw_data.json  # 422
sqlite3 saas/data/ap-south-1.db "select count(*) from received_payloads"
```

## 6. Judge questions you answer
- **"What happens when SaaS is unreachable?"** Payloads stay in the SQLite outbox; heartbeats fail; retry with exponential backoff; drain oldest-first on reconnect.
- **"How do you avoid loss or duplicates?"** The `payload_id` is generated once and stored with the exact bytes. Retries resend the same bytes. SaaS has `payload_id` as primary key, and a duplicate returns 200 so the collector clears it. `seq` gaps prove no loss.
- **"How are collectors authenticated?"** HMAC-SHA256 over timestamp + body with a per-collector secret, a 300 s replay window, the tenant taken from the registry not the body, and TLS in transit.
- **"Regions / residency / UTC / out-of-order?"** One DB per region with the tenant pinned to its home region; UTC + `source_tz`; everything indexed and queried by event time.
- **"How would this scale?"** Stateless ingest behind a load balancer → Kafka partitioned by tenant → workers → TimescaleDB/ClickHouse per region.

## 7. Before every merge
MERGE_GUIDE §4 checklist + run `send_sample.py` twice to confirm idempotency still works.
