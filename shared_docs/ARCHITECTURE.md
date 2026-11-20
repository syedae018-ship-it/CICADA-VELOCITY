# Architecture: Velocity Cicada

Secure, two-tier AIOps observability. **Raw data stays local; only allow-listed metadata reaches SaaS.**

## Diagram and trust boundary

```
┌──────────────────────── TIER 1 · CUSTOMER ENVIRONMENT (trusted, raw data lives here) ────────────────────────┐
│                                                                                                               │
│  Organizer telemetry stream / demo/simulator.py                                                               │
│        │ (H1) HTTP POST /local/raw  ·  localhost                                                              │
│        ▼                                                                                                      │
│  ┌─────────────── collector/ (port 8001) ───────────────┐      ┌────────────── transport/ ───────────────┐   │
│  │ 1 Collect   adapter → RawRecord                      │      │ 6 Build payload (payload_id, seq, UTC)  │   │
│  │ 2 Redact    redaction_rules.json → raw_records       │      │ 7 Validate against payload_schema.json  │   │
│  │ 3 Filter    allow-list fields, drop the rest         │ ───▶ │ 8 Egress log (exact bytes + sha256)     │   │
│  │ 4 Aggregate 5-s windows per source                   │ (H2) │ 9 Outbox (SQLite) → send / retry        │   │
│  │ 5 Detect    failed-login bursts (local only)         │ in-  │10 Heartbeat every 10 s                  │   │
│  │   Local UI: raw view · egress panel · buffer         │ proc │   HMAC-signed, TLS                      │   │
│  └──────────────────────────────────────────────────────┘      └───────────────────┬─────────────────────┘   │
│                                                                                     │                         │
└═════════════════════════════════════ TRUST BOUNDARY ════════════════════════════════╪═════════════════════════┘
                                                                                      │ (H3) HTTPS POST /api/v1/ingest
                                                                                      │      + /api/v1/heartbeat
                                                                                      │      to REGIONAL endpoint
┌──────────────────────── TIER 2 · SaaS (multi-tenant, metadata only) ────────────────▼─────────────────────────┐
│  saas/ (port 8000)                                                                                            │
│  ┌──────────── saas/ingest ─────────────┐   ┌──────────── saas/aiops ────────────┐                             │
│  │ verify HMAC + timestamp              │   │ baselines (EWMA / z-score)         │                             │
│  │ re-validate schema (allow-list)      │──▶│ anomaly detection + health states  │                             │
│  │ dedupe by payload_id                 │   │ correlation → incidents            │                             │
│  │ store by event_time (out-of-order)   │   │ explainable recommendations        │                             │
│  │ write to Supabase Postgres (svc key) │   │ simulated remediation + audit      │                             │
│  │ offline detection (60 s)             │   └────────────────┬───────────────────┘                             │
│  └──────────────────────────────────────┘                    │ (H5) svc key → Supabase Postgres (RLS, Realtime) │
│                                                              ▼                                                 │
│                                         dashboard/ (Next.js, port 3000)                                        │
│                         fleet · health states · incidents · recommendations · reliability                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Hop | From → To | Protocol | Security |
|---|---|---|---|
| H1 | Stream → Collector | HTTP (localhost) | Inside the customer network |
| H2 | Collector → Transport | In-process function call | Same process |
| H3 | Transport → SaaS | HTTPS | HMAC-SHA256 collector auth, 300 s replay window, TLS |
| H4 | Supabase → Dashboard | HTTPS (supabase-js) + Realtime websockets | Supabase Auth JWT; **Row Level Security** limits rows to the user's tenant |
| H5 | FastAPI → Supabase | HTTPS (supabase-py) | Service-role key, server-side only |

## Data flow (the judges' required order)
**Collect → Filter/Redact → Aggregate → Analyze locally → Apply data policy → Transmit**

## Failure handling
| Failure | Behaviour |
|---|---|
| SaaS unreachable | Payloads stay in the SQLite outbox; retry with backoff 1→2→4→8→15 s; heartbeat fails too |
| Reconnect | Outbox drains oldest first; every payload keeps its original `payload_id` |
| Duplicate delivery | SaaS sees the known `payload_id` and returns `200 duplicate`; nothing is stored twice |
| Late / out-of-order | Stored and charted by `event_time_utc`; `seq` gaps reported in `/reliability` |
| Collector dies | No heartbeat for 60 s → collector state **Poor**, alert raised, event in health history |
| Source goes quiet | No data for 30 s → its state is downgraded (never shows the stale last value) |
| Schema violation | Collector refuses to send (dead-letter); SaaS rejects with 422. Two independent checks. |

## Global-ready design
- **Regional ingest:** each collector is configured with `REGION` + `SAAS_URL` for its region.
- **Data residency:** each tenant has a `home_region`. Hackathon: one Supabase project. Production: one Supabase project per region; ingest routes the tenant to its region.
- **UTC everywhere** + `source_tz` per payload; the dashboard renders in the viewer's local time.
- **Out-of-order:** ordered by event time. **Idempotency:** `payload_id` primary key.

## Scalability (production path, stated honestly)
Hackathon: FastAPI + Supabase Postgres (RLS + Realtime); collector on local SQLite. Production: ingest behind a load balancer → Kafka/NATS queue
partitioned by tenant → stateless AIOps workers → Supabase/Postgres (+ TimescaleDB) per region; collectors
scale horizontally because they share nothing.
