# Database Tables

| Tier | Database | Why |
|---|---|---|
| **Tier 2 SaaS** | **Supabase (Postgres)**, one project. Schema: [`supabase/001_init.sql`](supabase/001_init.sql) | Hosted, RLS tenant isolation, Realtime, Auth |
| **Tier 1 Collector** | **Local SQLite**, never Supabase | Raw data must stay in the customer environment |

## Tier 2: SaaS on Supabase (exact SQL in `supabase/001_init.sql`)

**Who writes:** only FastAPI (ingest = Person B, AIOps = Person C) using the **service-role key**
(server-side `.env` only). Collectors never get Supabase keys.

**Who reads:** the dashboard with the **anon key + Supabase Auth**. **Row Level Security** lets a
user see only rows whose `tenant_id` is in `tenant_members` for that user, and the same applies to Realtime.

**Data residency:** each tenant has a `home_region`. Hackathon: one Supabase project (state this as a
limitation). Production: one Supabase project per region, and ingest routes each tenant to its region's project.

Columns below are a summary; the SQL file is the source of truth.

```sql
tenants(tenant_id PK, name, home_region, created_utc)

collectors(collector_id PK, tenant_id, region, secret_hash, version, status,   -- status: online|offline
           state, last_seen_utc, buffer_depth, cpu_pct, mem_pct, config_hash)

received_payloads(payload_id PK, tenant_id, collector_id, seq, sent_at_utc,    -- idempotency + gap detection
                  received_at_utc, body_sha256)

metrics(id PK, tenant_id, collector_id, source_id, service, source_type,
        metric, value, event_time_utc, received_at_utc, payload_id)
  INDEX (tenant_id, source_id, metric, event_time_utc)

events(event_id PK, tenant_id, collector_id, source_id, category, severity,
       type, count, summary, event_time_utc, received_at_utc, payload_id)

alerts(alert_id PK, tenant_id, source_id, service, kind, metric, severity, state,
       event_time_utc, created_at_utc, incident_id, explanation_json, status)

incidents(incident_id PK, tenant_id, title, status, severity, started_utc, updated_utc,
          alert_count, suppressed_duplicates, affected_sources_json, likely_cause, correlation_rule)

recommendations(rec_id PK, tenant_id, incident_id, action, reasoning_json, contributing_json,
                confidence, risk, policy_json, rollback_plan, status, approved_by, updated_utc)

health_history(id PK, tenant_id, entity_type, entity_id, prev_state, state, reason, at_utc)

audit_log(id PK, tenant_id, actor, action, target, details_json, at_utc)
```

## Tier 1: Collector (`collector/data/collector.db`)

```sql
raw_records(id PK, received_utc, kind, raw_json, redacted_json, purge_after_utc)   -- LOCAL ONLY
detections(id PK, at_utc, type, detail_json)                                       -- LOCAL ONLY (e.g. which user/IP)
outbox(payload_id PK, seq, body, created_utc, attempts, next_retry_utc, status)    -- pending|sent|dead_letter
egress_log(payload_id PK, seq, body, sha256, first_attempt_utc, sent_utc, attempts, result)
```

`egress_log.body` is stored **byte-for-byte** as sent; `sha256` is shown in the egress panel so
judges can compare it with `received_payloads.body_sha256` in SaaS.
