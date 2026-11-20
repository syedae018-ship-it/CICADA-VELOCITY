# Feature Matrix: Problem Statement → Implementation → How to Show It

Every requirement in the CICADA 2026 problem statement, where it lives in the code, and how to prove it
live. "Inject" = the dashboard's **Inject scenario** menu (or `curl -X POST localhost:8001/local/demo/<id>`).

## 1. Two-tier architecture & data protection

| Requirement | Implementation | Show it |
|---|---|---|
| Local collector collects telemetry (agents, SNMP, syslog, flow, APIs) | `collector/` · adapter `collector/adapters/` normalises any source into `RawRecord` (metric, log, auth, flow) | Overview → sources update every 5 s |
| Raw logs, payloads and secrets stay local | Raw store `collector/data/collector.db`, never transmitted | **Privacy Side-by-Side**: left = raw (Tier 1), right = what SaaS stored |
| Filter, normalise, redact, aggregate, summarise before sending | `collector/redact.py` (10 rules from `contracts/redaction_rules.json`) → `collector/aggregate.py` (5-s windows) | Inject **secret**: `[REDACTED:password_kv]` etc. |
| Only allow-listed metadata leaves | Payload *built* from the allow-list, `additionalProperties:false` schema checked by transport **and** SaaS | `contracts/payload_schema.json`; the SaaS rejects a leaking payload with 422 |
| Pseudonymous source IDs | `collector/pseudo.py`: HMAC-SHA256(site salt, host), salt never leaves | `src_9f2c…` everywhere in SaaS |
| Secure collector authentication | `transport/signing.py`: HMAC-SHA256 over timestamp + body, 300 s replay window, tenant taken from the registry | Wrong secret → 401 (tests) |
| Encrypted transport | HTTPS to Supabase; collector→SaaS runs over TLS in production (dev uses HTTP on localhost, `DEV_INSECURE=1`) | Limitation slide |
| Local retention controls | `LOCAL_RETENTION_HOURS` purge loop in `collector/routes.py` | `.env` |
| Auditable data-transfer records | `egress_log` (exact bytes + sha256) and SaaS `received_payloads.body_sha256` | **Egress Proof** panel |
| **Egress proof panel** (mandatory) | `GET /local/egress` + dashboard **Egress Proof** view | Click any payload → exact JSON + sha256 + delivery result |

## 2. Observability & AIOps

| Requirement | Implementation | Show it |
|---|---|---|
| CPU, memory, disk, availability, bandwidth, latency, packet loss, connectivity | Metrics in payload schema; stored per event time | **Monitored Sources** + source drawer |
| Repeated failed logins from local signals | `collector/detect.py`: ≥5 failures/60 s → `failed_login_burst`; users/IPs stay in local `detections` | Inject **logins** |
| Anomalies beyond static thresholds | `saas/aiops/baseline.py` + `detect.py`: 15-min rolling baseline, z-score, persistence | Inject **cpu_spike** → alert with σ, baseline mean/std |
| Correlate related events, reduce noise | `saas/aiops/correlate.py`: service/time-window grouping, duplicate suppression | Inject **correlation** → 1 incident, "N suppressed" |
| Prioritise incidents | Severity from worst signal; critical first | **Incidents & AIOps** |
| Explainable recommendations | `saas/aiops/recommend.py`: action, reasoning path, contributing signals, confidence, risk, rollback | **AI Insights** |
| Collector online/offline, last seen, version, resource use, config | Heartbeats every 10 s; `collectors` table; offline after 60 s | **Fleet Nodes**; inject **outage** |
| Multi-tenant separation | Tenant from collector registry; every query tenant-filtered; Supabase RLS; JWT → tenant | Switch tenant (demo) or sign in as `acme@`/`globex@` |

## 3. Four health states

| Requirement | Implementation | Show it |
|---|---|---|
| Excellent / Good / Fair / Poor with configurable thresholds | `contracts/health_thresholds.json` → `saas/aiops/health.py`; `GET /api/v1/config/thresholds` | Source cards show state + reason |
| Reason shown for each state change | `reason` on every source and `health_history` row | **State History** |
| Stale/missing data downgrades the state | Staleness sweep every 5 s (30 s → downgrade, 60 s collector → Poor) | Inject **outage** |
| Transitions timestamped in UTC with history | `health_history` (UTC) | **State History** / **Activity Timeline** |

## 4. Global-ready design

| Requirement | Implementation | Show it |
|---|---|---|
| Regional ingest | Each collector has `REGION` + `SAAS_URL`; region checked on ingest (wrong region → 403) | Two collectors: Acme `ap-south-1`, Globex `eu-west-1` |
| Tenant data residency | `tenants.home_region`; SQLite backend writes one DB per region; production = one Supabase project per region | Architecture slide |
| UTC + source timezone | `sent_at_utc`, `event_time_utc`, `source_tz` in every payload | Egress payload JSON |
| Out-of-order handling | Stored and queried by `event_time_utc` | Inject **out_of_order** → chart stays correct |
| Idempotent delivery | `payload_id` primary key; duplicate → 200 "duplicate" | Inject **duplicate** → Reliability "duplicates rejected" +1 |

## 5. Real-time targets (measured from timestamps)

| Target | Measured by | Typical result (live, Supabase) |
|---|---|---|
| Collection → dashboard ≤ 10 s p95 | `received_at_utc − event_time_utc` (`/api/v1/reliability`) + 3 s dashboard poll | p95 ≈ 1.3 s ingest |
| Breach → alert ≤ 15 s | `alerts.created_at_utc − event_time_utc` | ≈ 2–5 s |
| Offline detection ≤ 60 s | last heartbeat vs offline transition | 60–65 s |
| No loss / no duplicates after outage | `egress_log` IDs vs `received_payloads` IDs, `seq_gaps` | 0 gaps, 0 duplicates |

## 6. Live scenarios (Section 8) → one click each

| # | Scenario | Inject id | Expected |
|---|---|---|---|
| 1 | Raw log contains a secret | `secret` | Redacted locally; SaaS gets metadata only |
| 2 | Collector loses SaaS connectivity | `outage` | Buffer grows, collector goes Poor after 60 s, replay with 0 loss |
| 3 | Repeated failed logins | `logins` | Security incident; no usernames/IPs in SaaS |
| 4 | Network latency rises | `latency` | Affected sources, severity, trend, related service |
| 5 | CPU/memory deviates from baseline | `cpu_spike` | Explained anomaly + recommendation |
| 6 | Several alerts → one incident | `correlation` | One incident, duplicates suppressed |
| 7 | Duplicate / out-of-order delivery | `duplicate`, `out_of_order` | Rejected as duplicate; placed by event time |
| 8 | Remediation proposed | (any incident) → **Approve** / **Rollback** | Policy check, audit entry, rollback |

## 7. Roadmap stage coverage

Observe ✅ · Detect ✅ · Correlate ✅ · Recommend ✅ · Act: **simulated**, human-approved, policy-checked, audited, reversible.

## Honest limitations (say these out loud)

- Collector → SaaS uses HTTP on localhost in the demo; production terminates TLS (and can add mTLS).
- One Supabase project for the demo; production runs one project per region for strict residency.
- The AIOps engine keeps its working state in memory (results are persisted); a restart re-learns baselines in ~2 minutes.
- Regex redaction can miss novel secret formats; production adds entropy-based detection and per-tenant rules.
- Remediation is simulated by design; real actions need a policy engine and change management.
- The organizer stream format is unknown until the event; only `collector/adapters/` changes.
