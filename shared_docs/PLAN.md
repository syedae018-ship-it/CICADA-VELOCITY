# 24-Hour Plan, MVP & Demo Scenarios

## Use cases (Phase 1)
1. **Infrastructure health:** CPU / memory / disk / service availability per source
2. **Network:** latency, packet loss, bandwidth, connectivity
3. **Security:** repeated failed logins detected locally → summary only
4. **Collector fleet health:** online/offline, last seen, version, buffer, resource use

## Feature priority
| P | Feature | Module |
|---|---|---|
| **P0 (MVP)** | Collector ingests stream, redacts secrets, builds allow-listed payload | M1 |
| **P0** | Signed send, outbox buffering, retry, dedupe by payload_id | M2 |
| **P0** | Egress proof panel (exact payload + sha256) | M2 data, M4 UI |
| **P0** | 4 health states with reasons + stale handling | M3 logic, M4 UI |
| **P0** | Baseline anomaly detection with explanation | M3 |
| **P0** | Dashboard: fleet, sources, alerts, raw-vs-SaaS side-by-side | M4 |
| P1 | Correlation into incidents (noise reduction) | M3 |
| P1 | Explainable recommendations with reasoning path | M3 |
| P1 | Reliability panel: p95 latency, sent vs received IDs | M2 data, M4 UI |
| P1 | Failed-login burst detection | M1 |
| P2 | Simulated remediation (approve → audit → rollback) | M3 |
| P2 | Second tenant + second region (residency demo) | M2 |

**Minimum viable demo:** simulator → collector (redacts a secret) → signed payload → SaaS →
dashboard shows health state + one explained anomaly, and the egress panel shows the exact payload.

## Timeline
| Hours | Goal |
|---|---|
| 0–1.5 | Skeleton + contracts on `main` (done). Fill in owners in `TEAM_RULES.md`. |
| 1.5–8 | Each module solo, built against `contracts/sample_payloads/` mocks |
| **8** | **Integration #1:** end-to-end pipe working, even if basic |
| 8–16 | P0 complete, Phase 3 checkpoint |
| 16–20 | P1: correlation, recommendations, reliability numbers |
| 20 | **Feature freeze** |
| 20–24 | Rehearse the 8 scenarios, slides, limitations |

## Live scenarios (judges inject these; each needs a script in `demo/scenarios/`)
| # | Scenario | Pass criteria | Owner |
|---|---|---|---|
| 1 | Raw log contains a secret | Visible raw locally; `[REDACTED]` locally; absent from egress panel & SaaS | M1 |
| 2 | Collector loses SaaS | Buffer grows, retries, drains on reconnect; sent IDs == received IDs, 0 dupes | M2 |
| 3 | Repeated failed logins | `failed_login_burst` event; no usernames/IPs in SaaS | M1 |
| 4 | Network latency rises | Affected source, severity, trend, related service shown | M3/M4 |
| 5 | CPU/memory deviates from baseline | Anomaly with z-score, contributing signals, recommendation | M3 |
| 6 | Several related alerts | Merged into one incident, duplicates suppressed | M3 |
| 7 | Duplicate / out-of-order delivery | Ordered by event time; duplicates rejected; chart correct | M2 |
| 8 | Remediation proposed | Policy check → approval → audit → rollback | M3/M4 |

## Real-time targets (measured, not claimed)
| Measure | Target | Measured by |
|---|---|---|
| Collection → dashboard | ≤ 10 s p95 | `event_time_utc` vs dashboard render time |
| Breach → alert | ≤ 15 s | Injected spike time vs `alerts.created_at_utc` |
| Offline detection | ≤ 60 s | Last heartbeat vs state change to Poor |
| Backlog | 0 lost, 0 dupes | `egress_log` IDs vs `received_payloads` IDs |
