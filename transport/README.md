# M2: Transport, Reliability & Ingest (`transport/` + `saas/ingest/` + `saas/db.py`)

> Full phased build guide: [`docs/members/PERSON_B_transport_ingest.md`](../docs/members/PERSON_B_transport_ingest.md)

**Owner:** _fill in_ · **Branch:** `feature/<name>` · Spans **both tiers** (the trust boundary itself)

## Mission
Get metadata from the collector to SaaS **securely, exactly once, in the right order, to the right region**.

## Collector side: `transport/`
- [ ] `submit(payload)`: add `payload_id` (uuid4), `seq`, `sent_at_utc`; validate against schema (fail → dead-letter); write to `outbox` and `egress_log` (exact bytes + sha256)
- [ ] Sender loop: drain `outbox` oldest-first, HMAC-sign (`signing.py`), POST to `SAAS_URL/api/v1/ingest`
- [ ] Retry with backoff 1→2→4→8→15 s on 5xx/timeout/refused; `accepted` or `duplicate` → mark sent
- [ ] Heartbeat every 10 s to `/api/v1/heartbeat`
- [ ] `GET /local/egress`, `GET /local/egress/{id}`, `GET /local/buffer`, `POST /local/saas-link` (outage switch). Mount these on the collector app as a router.

## SaaS side: `saas/ingest/` + `saas/db.py`
- [ ] SQLite per region (`saas/data/<region>.db`), tables from `contracts/db_tables.md`
- [ ] `tenant_query()` helper that **always** adds `tenant_id` (used by M3 too)
- [ ] `POST /api/v1/ingest`: verify HMAC + 300 s window → registry check → schema re-validate → `INSERT payload_id` (dupe → 200 duplicate) → store metrics/events by **event_time** → call `aiops.on_ingest(tenant_id, payload)` hook
- [ ] `POST /api/v1/heartbeat`; background task marks collectors offline after 60 s
- [ ] `GET /api/v1/collectors`, `GET /api/v1/metrics`, `GET /api/v1/reliability` (counts, dupes, seq gaps, p95 latency)
- [ ] Seed two tenants: `t_acme` (ap-south-1, `c_blr01`) and `t_globex` (eu-west-1, `c_fra01`)

## Demo scenarios you own
#2 SaaS outage → buffer → resume · #7 Duplicate / out-of-order delivery

## Test it
Kill SaaS for 60 s while the collector runs, restart it, and confirm `egress_log` IDs == `received_payloads` IDs with 0 duplicates.
