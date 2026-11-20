# Chapter 6: Complete API Reference

All endpoints across **Customer Collector (Port 8001)** and **Cloud SaaS Backend (Port 8000)**.

---

## 1. Collector Endpoints (Port 8001)

| Endpoint | Method | Purpose | Input / Query Params | Expected Output | Verification Command |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/local/raw` | `POST` | Ingest raw telemetry into local pipeline | JSON object: `{"host": "...", "kind": "...", "message": "..."}` | `{"status": "accepted", "source_id": "...", "secrets_redacted": 0}` | `curl -X POST http://localhost:8001/local/raw -H "Content-Type: application/json" -d '{"host":"web-01","kind":"metric","metrics":{"cpu_pct":45.2}}'` |
| `/local/raw` | `GET` | List recent raw stored records (24h retention) | `limit` (default: 50, max: 500) | Array of raw record objects with `raw_obj` and `redacted_obj` | `curl -s http://localhost:8001/local/raw?limit=5` |
| `/local/detections` | `GET` | List local detections & redacted secrets | `limit` (default: 50) | Array of detection logs with matched rule names | `curl -s http://localhost:8001/local/detections` |
| `/local/status` | `GET` | Collector operational health status | None | `{"collector_id": "...", "status": "online", "buffer_depth": 0, "secrets_redacted_total": 0}` | `curl -s http://localhost:8001/local/status` |
| `/local/buffer` | `GET` | Inspect persistent outbox buffer queue | None | `{"buffer_depth": 0, "oldest_seq": 1, "newest_seq": 14, "pending": 0}` | `curl -s http://localhost:8001/local/buffer` |
| `/local/egress` | `GET` | Audit recent transmitted payloads | `limit` (default: 20) | Array of payloads with SHA-256 hash, attempts, delivery result | `curl -s http://localhost:8001/local/egress` |
| `/local/saas-link` | `POST` | Simulate network outage / link state | `{"connected": false}` | `{"saas_link_connected": false}` | `curl -X POST http://localhost:8001/local/saas-link -H "Content-Type: application/json" -d '{"connected": false}'` |
| `/local/demo` | `GET` | Query active demo scenario & traffic state | None | `{"traffic": true, "scenario": "cpu_spike", "seconds_left": 28}` | `curl -s http://localhost:8001/local/demo` |
| `/local/demo/traffic` | `POST` | Toggle baseline background traffic generator | `{"enabled": true}` | `{"traffic": true}` | `curl -X POST http://localhost:8001/local/demo/traffic -H "Content-Type: application/json" -d '{"enabled": true}'` |
| `/local/demo/{scen}` | `POST` | Inject 1 of 9 live demo scenarios | `scen`: `normal\|secret\|cpu_spike\|latency\|correlation\|logins\|outage\|duplicate\|out_of_order` | `{"scenario": "cpu_spike", "duration": 40, "status": "started"}` | `curl -X POST "http://localhost:8001/local/demo/cpu_spike?duration=40"` |

---

## 2. Cloud SaaS Endpoints (Port 8000)

| Endpoint | Method | Purpose | Input / Headers | Expected Output | Verification Command |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/ingest` | `POST` | Ingest signed aggregated metadata | Headers: `X-Collector-Id`, `X-Timestamp`, `X-Signature`. Body: Metadata payload JSON | `{"status": "accepted", "payload_id": "...", "seq": 10}` | Verified via `transport/sender.py` or `transport/send_sample.py` |
| `/api/v1/heartbeat` | `POST` | Collector liveness ping | Headers: `X-Collector-Id`, `X-Timestamp`, `X-Signature`. Body: Heartbeat JSON | `{"status": "ok", "server_time_utc": "..."}` | Automatic background ping every 30s |
| `/api/v1/overview` | `GET` | High-level executive overview | Header: `X-Tenant-Id: t_acme` (or JWT) | `{"tenant_id": "t_acme", "overall_state": "excellent", "open_incidents": 0, "sources": [...]}` | `curl -s -H "X-Tenant-Id: t_acme" http://localhost:8000/api/v1/overview` |
| `/api/v1/incidents` | `GET` | List active & historical incidents | Header: `X-Tenant-Id: t_acme` | Array of incident objects with timeline, root cause & status | `curl -s -H "X-Tenant-Id: t_acme" http://localhost:8000/api/v1/incidents` |
| `/api/v1/incidents/{id}` | `GET` | Detailed incident investigation view | Path: `incident_id`. Header: `X-Tenant-Id` | Incident detail with timeline, signals, and associated alerts | `curl -s -H "X-Tenant-Id: t_acme" http://localhost:8000/api/v1/incidents/inc_123` |
| `/api/v1/alerts` | `GET` | List anomalies and metric alerts | Query: `status=open`. Header: `X-Tenant-Id` | Array of alert objects with Z-score explanation and observed values | `curl -s -H "X-Tenant-Id: t_acme" http://localhost:8000/api/v1/alerts` |
| `/api/v1/recommendations/{id}/approve` | `POST` | Authorize remediation execution | Path: `rec_id`. Header: `X-Tenant-Id` | `{"status": "executed_simulated", "applied_at": "..."}` | `curl -X POST -H "X-Tenant-Id: t_acme" http://localhost:8000/api/v1/recommendations/rec_123/approve` |
| `/api/v1/metrics` | `GET` | Fetch time-series metric points | Query: `source_id`, `metric`, `since`. Header: `X-Tenant-Id` | Array of `{event_time_utc, value}` ordered by event time | `curl -s -H "X-Tenant-Id: t_acme" "http://localhost:8000/api/v1/metrics?metric=cpu_pct"` |
| `/api/v1/reliability` | `GET` | SLA, latency, duplicate & seq metrics | Header: `X-Tenant-Id: t_acme` | `{"received": 142, "duplicates": 0, "seq_gaps": 0, "p95_latency_ms": 42.1}` | `curl -s -H "X-Tenant-Id: t_acme" http://localhost:8000/api/v1/reliability` |
| `/api/v1/collectors` | `GET` | List registered tenant collectors | Header: `X-Tenant-Id: t_acme` | Array of collector fleet nodes with online status & buffer depth | `curl -s -H "X-Tenant-Id: t_acme" http://localhost:8000/api/v1/collectors` |
