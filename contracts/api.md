# API Contract v1.0

All times are ISO-8601 UTC with `Z`. All JSON. Base path `/api/v1`.

| Service | Port | Tier |
|---|---|---|
| SaaS (ingest + AIOps + query API) | `8000` | Tier 2 |
| Collector local API / UI | `8001` | Tier 1 (customer side, never exposed to SaaS) |
| Dashboard (Next.js) | `3000` | Tier 2 UI |

---

## A. Collector → SaaS (crosses the trust boundary)

### Authentication (every request)
Transport is HTTPS (TLS). For local dev, plain HTTP is allowed when `DEV_INSECURE=1`.

| Header | Value |
|---|---|
| `X-Collector-Id` | `c_blr01` |
| `X-Timestamp` | Unix seconds as a string |
| `X-Signature` | `hex(HMAC_SHA256(collector_secret, X-Timestamp + "." + raw_body))` |

SaaS looks up the collector's secret and **its tenant_id** from `collectors` (the tenant is taken from the registry, not trusted from the body). It rejects the request when:
- the signature is wrong → `401`
- `|now - X-Timestamp| > 300` → `401` (replay protection)
- body `tenant_id`/`collector_id` don't match the registry → `403`

### `POST /api/v1/ingest`
Body: a `MetadataPayload` (see `payload_schema.json`).

| Response | Meaning | What the collector does |
|---|---|---|
| `202 {"status":"accepted","payload_id":"..."}` | Stored | Mark sent, remove from outbox |
| `200 {"status":"duplicate","payload_id":"..."}` | Already had this `payload_id` | Mark sent, remove from outbox (**idempotent**) |
| `401` / `403` | Auth problem | Keep in outbox, log an error, do not hot-loop |
| `422 {"status":"rejected","errors":[...]}` | Schema / allow-list violation | Move to `dead_letter` locally, alert the operator. Must never happen in a demo. |
| `5xx` / timeout / connection refused | SaaS down | Keep in outbox, retry with backoff: 1, 2, 4, 8, max 15 s |

Rule: SaaS stores events by **`event_time_utc`**, not arrival time, so late or out-of-order payloads land in the right place.

### `POST /api/v1/heartbeat`
Body: `Heartbeat` (see `heartbeat_schema.json`). Sent every **10 s**. → `204`.
SaaS marks a collector `poor/offline` when `now - last_seen > 60 s`.

---

## B. Dashboard → SaaS

**With Supabase, the dashboard reads most data directly from Supabase** using `supabase-js`
(anon key + logged-in user). RLS enforces the tenant, and **Supabase Realtime** replaces the SSE stream.

| Dashboard needs | Get it from |
|---|---|
| overview, collectors, metrics, alerts, incidents, recommendations, health history, audit | `supabase.from('<table>').select(...)`, auto-filtered by RLS |
| live updates | `supabase.channel(...).on('postgres_changes', ...)` on `alerts`, `incidents`, `recommendations`, `health_history`, `collectors`, `metrics` |
| approve / rollback a recommendation | **FastAPI** (writes need the service role + audit + policy check) |
| reliability numbers (p95 latency, dupes, seq gaps) | **FastAPI** `GET /api/v1/reliability` (computed) |

FastAPI endpoints that remain for the dashboard verify the **Supabase JWT** (`Authorization: Bearer <access_token>`),
look up the user's tenant in `tenant_members`, and scope every query to it.

The table below lists the FastAPI routes (the ones marked *optional* are covered by direct Supabase reads):

| Method & path | Returns |
|---|---|
| `GET /api/v1/health` | `{"status":"ok","service":"saas","time_utc":...}` (no auth) |
| `GET /api/v1/overview` *(optional)* | `{tenant_id, overall_state, collectors:{online,offline}, open_incidents, sources:[{source_id, service, source_type, state, reason, last_seen_utc}]}` |
| `GET /api/v1/collectors` *(optional)* | `[{collector_id, region, version, status, state, last_seen_utc, buffer_depth, cpu_pct, mem_pct, config_hash}]` |
| `GET /api/v1/metrics?source_id=&metric=&from=&to=` *(optional)* | `[{event_time_utc, value}]` ordered by **event time** |
| `GET /api/v1/alerts?status=open` *(optional)* | `[Alert]` (see `aiops_output.md`) |
| `GET /api/v1/incidents` *(optional)* | `[Incident]` |
| `GET /api/v1/incidents/{id}` *(optional)* | `Incident` + its `alerts` + `recommendations` |
| `POST /api/v1/recommendations/{id}/approve` | Simulated remediation: policy check → approve → audit → `{status:"executed_simulated", rollback_plan}` |
| `POST /api/v1/recommendations/{id}/rollback` | `{status:"rolled_back"}` + audit entry |
| `GET /api/v1/health-history?entity_id=` *(optional)* | `[{at_utc, entity_type, entity_id, prev_state, state, reason}]` |
| `GET /api/v1/reliability` | `{received_count, duplicates_rejected, seq_gaps, latency_p95_s, alert_latency_s_last}` |
| `GET /api/v1/stream` *(not needed: use Supabase Realtime)* | **SSE** stream of `{"type":"metric"|"alert"|"incident"|"state","data":{...}}` for live dashboard updates (< 10 s target) |
| `GET /api/v1/audit` *(optional)* | `[{at_utc, actor, action, target, details}]` |

---

## C. Collector local API (Tier 1 only, port 8001)

| Method & path | Returns |
|---|---|
| `GET /local/status` | `{collector_id, tenant_id, region, version, saas_reachable, buffer_depth, last_sent_utc, uptime_s}` |
| `POST /local/raw` | Ingest one raw record (see `raw_input.md`). Used by the simulator / organizer-stream adapter. |
| `GET /local/raw?limit=50` | Latest raw records **as received** (shows the secret, to prove it stays local) and their redacted version |
| `GET /local/egress?limit=20` | **Egress proof panel**: `[{payload_id, seq, sent_at_utc, sha256, attempts, result, body}]`, where `body` is byte-for-byte what was sent |
| `GET /local/egress/{payload_id}` | One payload exactly as sent |
| `GET /local/buffer` | `{depth, oldest_utc, items:[{payload_id, attempts, next_retry_utc}]}` |
| `GET /local/detections` | Local security detections (failed-login bursts) with **local-only** detail |
| `POST /local/saas-link` | Demo control: `{"enabled": false}` simulates a SaaS outage from the collector side |
