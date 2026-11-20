# Comprehensive Verification & Test Report: Person C AIOps Observability Engine

**Project:** Velocity Cicada (`CICADA-VELOCITY`)  
**Branch:** `feature/faheem`  
**Module:** Person C — Tier 2 AIOps Engine (`saas/aiops/`)  
**Timestamp:** 2026-11-20T16:10:00Z  
**Verification Result:** **100% PASS (13/13 Automated Tests + Contract Validation + Live Server Integration)**  

---

## 1. System Overview: Why This Is True Observability (Not Just Metrics Monitoring)

Traditional monitoring simply checks if numbers cross static thresholds (e.g. `CPU > 90%`) and displays disconnected charts. In contrast, Velocity Cicada's AIOps engine operates as a **full observability and incident-investigation platform**:

1. **Service-Centric Aggregation:** Telemetry originates from individual nodes (`source_id`), but operators reason about services. The engine automatically associates nodes to logical services (`service`), rolls up their health into service health states, and exposes holistic service degradation.
2. **Event-Time Ordering:** Distributed collectors may buffer, retry, or deliver telemetry out of order (`04_out_of_order_late.json`). Baselines and incident timelines order all events by `event_time_utc` rather than arrival time, preserving historical accuracy.
3. **Statistical Baselines & Anti-Pollution:** Instead of static thresholds, the engine computes 15-minute rolling $\mu$ and $\sigma$ distributions per `(tenant, source, metric)` with metric-specific noise floors. When an anomaly occurs, it is excluded from baseline recalculation so the baseline does not chase the spike.
4. **Persistent Anomaly Detection:** Transient, single-sample spikes (network jitter, momentary CPU pulse) do not fire alerts. Only sustained deviations ($\ge 2$ consecutive anomalous samples) trigger explainable alerts.
5. **Cross-Layer Signal Correlation:** Merges multi-dimensional signals—compute resources, network links (latency + packet loss), and structured security events—occurring within a 120-second temporal window into a single unified `Incident`.
6. **Investigation Timelines with Causal Rigor:** Rather than treating alerts as independent notifications, each incident constructs a chronological timeline distinguishing the `earliest_signal` from the hypothesized root cause, explicitly noting that correlation suggests temporal alignment without claiming to prove absolute causation.
7. **Simulated Remediation with Human Guardrails:** Actionable recommendations provide structured evidence, confidence scores, policy checks, and mandatory rollback plans. Remediation actions remain simulated (`executed_simulated`) and write directly to an immutable audit log.

---

## 2. Module-by-Module Technical Working Guide

| Module | File | Core Responsibilities & Internal Mechanisms |
|---|---|---|
| **Thresholds** | `saas/aiops/thresholds.py` | Dynamically parses `contracts/health_thresholds.json`. Defines metric bounds, boolean failure states (`service_up`, `connectivity_ok`), anomaly z-score levels (`z_good=2.0`, `z_fair=3.0`, `z_poor=4.5`), and staleness constants. |
| **Baseline** | `saas/aiops/baseline.py` | Maintains time-series sample queues per `(tenant, source, metric)`. Uses chronological binary insertion (`bisect.insort`) to position out-of-order events. Calculates mean, variance, standard deviation, and z-score with noise floors (CPU floor 2.0, latency floor 5.0ms). Implements anti-pollution spike exclusion. |
| **Health** | `saas/aiops/health.py` | Maps metric values and boolean flags into 4 discrete health states (`excellent`, `good`, `fair`, `poor`). Implements `get_worst_state()` and `aggregate_service_health()` to compute aggregated service health from underlying nodes. Applies one-level staleness downgrades for sources silent $>30$s. |
| **Detection** | `saas/aiops/detect.py` | Tracks consecutive anomaly counts per metric. Fires alerts conforming to `contracts/aiops_output.md` only when persistent for $\ge 2$ samples. Ingests structured events across categories (`auth`, `network`, `resource`, `availability`, `collector`), safely utilizing templated summaries without leaking raw data. |
| **Correlation** | `saas/aiops/correlate.py` | Evaluates incoming alerts against open incidents within a 120-second sliding window. Merges signals sharing the same service or source. Suppresses duplicate alerts within 30s. Constructs sorted chronological incident timelines and identifies `earliest_signal`. |
| **Recommendation** | `saas/aiops/recommend.py` | Evaluates correlated incident patterns against a rule table (CPU $\rightarrow$ scale replicas, latency+loss $\rightarrow$ reroute link, failed logins $\rightarrow$ rate-limit, collector offline $\rightarrow$ host check). Attaches structured evidence, confidence, risk assessment, automated policy checks, and rollback plans. |
| **Storage & Adapters** | `saas/aiops/store.py` | Implements multi-tenant in-memory storage for sources, services, collectors, alerts, incidents, recommendations, health history, and audit log. Exposes 5 clean persistence adapter methods (`save_alert`, `save_incident`, `save_recommendation`, `save_health_history`, `save_audit_log`) with `# TODO(Person-B-merge)` hooks for fast Supabase Postgres migration. |
| **Engine Hook** | `saas/aiops/engine.py` | Entry point `on_ingest(tenant_id, payload)`. Features an `IdempotencyCache` (bounded to 10k payload IDs) to prevent double-counting on replay. Contains `check_staleness_and_timeouts()` watchdog to mark silent collectors ($>60$s) as `offline`/`poor` and raise critical alerts. |
| **Routes & API** | `saas/aiops/routes.py` | Implements FastAPI endpoints conforming to `contracts/api.md` §B: `/overview`, `/alerts`, `/incidents`, `/incidents/{id}`, `/health-history`, `/audit`, `/recommendations/{id}/approve`, and `/recommendations/{id}/rollback`. Enforces strict tenant isolation via `get_tenant()`. |

---

## 3. Complete Test Execution Matrix (`tests/test_aiops.py`)

All 13 automated tests executed and passed cleanly:

| # | Test Function | Scenario / Edge Case Tested | Input Conditions | Expected Outcome | Status |
|:---:|---|---|---|---|:---:|
| **1** | `test_service_centric_aggregation` | Service-Centric Health Rollup | Two sources mapped to `checkout-service` (one normal, one CPU 92%) | Service state rolls up to `poor`; overview lists both sources under the service | **PASS** |
| **2** | `test_cpu_spike_followed_by_latency` | Multi-Signal Incident Correlation | 25-sample warmup $\rightarrow$ 2-sample CPU anomaly $\rightarrow$ subsequent latency spike 30s later | Single incident created, chronological timeline created, `earliest_signal` = CPU, recommendation proposes scaling | **PASS** |
| **3** | `test_unrelated_signals_not_correlated` | Service Isolation Barrier | Breach on `payment-gw` and simultaneous breach on `analytics-worker` | Two completely separate incidents created; zero cross-contamination of affected sources | **PASS** |
| **4** | `test_repeated_alerts_and_duplicate_suppression` | Duplicate Alert Suppression | Exact duplicate payload sent within 5 seconds | Single incident maintained; `suppressed_duplicates` incremented to $\ge 1$ | **PASS** |
| **5** | `test_stale_sources_and_collector_outages` | Staleness Downgrade & Recovery | Telemetry timestamped 70s in the past $\rightarrow$ watchdog runs $\rightarrow$ fresh data arrives | Source downgraded to `good` (`stale: no data for Xs`); collector marked `offline`/`poor`; fresh data restores both to `excellent` | **PASS** |
| **6** | `test_tenant_isolation_complete` | Cross-Tenant Data Isolation | Tenant A (`t_tenant_a`) and Tenant B (`t_tenant_b`) ingest private telemetry | Tenant B querying `/overview`, `/alerts`, or `/incidents` receives zero data from Tenant A | **PASS** |
| **7** | `test_simulated_remediation_and_audit` | Remediation & State Transitions | Approve proposed recommendation $\rightarrow$ attempt duplicate approve $\rightarrow$ rollback | Approve transitions to `executed_simulated`; duplicate approve rejected (400); rollback transitions to `rolled_back`; actions logged in audit log | **PASS** |
| **8** | `test_out_of_order_late_event_time_ordering` | Event-Time Chronological Placement | Out-of-order samples inserted (T+10, T+0, T+5) | Internal baseline samples remain sorted chronologically; mean calculated correctly without corruption | **PASS** |
| **9** | `test_idempotency_guard_on_replayed_payload` | Idempotency on Collector Replay | Exact same `payload_id` sent twice | First call processes normally; second call is detected as duplicate and skipped; alert/incident counts remain identical | **PASS** |
| **10** | `test_jsonb_contract_compliance_aiops_output` | Schema Compliance with `aiops_output.md` | Ingest payload with latency and packet loss | Alerts contain valid `explanation` block; incidents contain `timeline` and `likely_cause`; recommendations contain `reasoning_path` and `rollback_plan` | **PASS** |
| **11** | `test_baseline_warmup_and_anti_pollution` | Minimum Samples & Anti-Pollution | Ingest 15 samples ($< 20$) then 5 samples ($= 20$) | Z-score remains 0.0 until $N \ge 20$; anomalous samples are excluded from baseline queue ($N$ does not inflate) | **PASS** |
| **12** | `test_transient_spike_vs_consecutive_anomaly` | 2-Consecutive-Sample Anomaly Rule | 1 single transient spike followed by normal $\rightarrow$ 2 consecutive spikes | Single spike generates 0 anomaly alerts; 2 consecutive spikes generate verified anomaly alert | **PASS** |
| **13** | `test_malformed_and_empty_payload_resilience` | Empty & Malformed Payload Resilience | Ingest empty dict, empty source list, and source with missing metrics | System processes gracefully with zero unhandled exceptions; `/overview` remains responsive | **PASS** |

---

## 4. Captured Verification Logs

### A. Contract Schema Validator (`python contracts/validate.py`)
```text
OK   01_normal.json 
OK   02_cpu_anomaly.json 
OK   03_failed_logins.json 
OK   04_out_of_order_late.json 
OK   05_other_tenant.json 
OK   heartbeat.json 
OK   INVALID_leaks_raw_data.json rejected as expected (2 violations)
```
*Exit Code: 0*

### B. Pytest Automated Test Suite (`python -m pytest -v tests/test_aiops.py`)
```text
============================= test session starts =============================
platform win32 -- Python 3.13.7, pytest-9.1.1, pluggy-1.6.0 -- C:\Program Files\Python313\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\F MOHAMMED FAHEEM\OneDrive\Documents\velociy\CICADA-VELOCITY
plugins: anyio-4.13.0
collecting ... collected 13 items

tests/test_aiops.py::test_service_centric_aggregation PASSED             [  7%]
tests/test_aiops.py::test_cpu_spike_followed_by_latency PASSED           [ 15%]
tests/test_aiops.py::test_unrelated_signals_not_correlated PASSED        [ 23%]
tests/test_aiops.py::test_repeated_alerts_and_duplicate_suppression PASSED [ 30%]
tests/test_aiops.py::test_stale_sources_and_collector_outages PASSED     [ 38%]
tests/test_aiops.py::test_tenant_isolation_complete PASSED               [ 46%]
tests/test_aiops.py::test_simulated_remediation_and_audit PASSED         [ 53%]
tests/test_aiops.py::test_out_of_order_late_event_time_ordering PASSED   [ 61%]
tests/test_aiops.py::test_idempotency_guard_on_replayed_payload PASSED   [ 69%]
tests/test_aiops.py::test_jsonb_contract_compliance_aiops_output PASSED  [ 76%]
tests/test_aiops.py::test_baseline_warmup_and_anti_pollution PASSED      [ 84%]
tests/test_aiops.py::test_transient_spike_vs_consecutive_anomaly PASSED  [ 92%]
tests/test_aiops.py::test_malformed_and_empty_payload_resilience PASSED  [100%]

============================= 13 passed in 0.96s ==============================
```
*Exit Code: 0*

### C. Replay Simulation (`python -m saas.aiops.dev_replay`)
```text
============================================================
  CICADA AIOps Engine: dev_replay demonstration
============================================================

[1/4] Warming baseline for tenant 't_acme' (25 samples)...
   - Source src_9f2c4a1b7e30 (payments-api): state=excellent, reason=nominal operations
   - Source src_1a2b3c4d5e6f (core-switch): state=good, reason=packet_loss_pct 0.754 > excellent_max 0.1

[2/4] Injecting CPU anomaly payload (02_cpu_anomaly.json)...
   => Generated 3 alerts. Latest alert explanation:
      Metric: resource_pressure (kind: event, severity: high)
      Why: Structured resource event: resource_pressure (CPU above 90% on src_9f2c4a1b7e30 (payments-api))
      Z-score: None

[3/4] Injecting Security Failed Logins (03_failed_logins.json)...

[4/4] Evaluating Correlated Incidents and Explainable Recommendations:
   => Total Incidents: 3
   * Incident [in_c8cc3d1893ba]: payments-api degradation: cpu + latency
     Likely Cause: Hypothesized Root Cause: Initial anomaly observed on cpu_pct at src_9f2c4a1b7e30 preceded subsequent disruptions. (Note: Temporal precedence suggests correlation, which warrants investigation but does not prove causation.)
     Alerts Merged: 2 (Duplicates Suppressed: 0)
   * Incident [in_3a38f9ec2b32]: infra-service degradation: resource_pressure
     Likely Cause: Initial event on resource_pressure at src_9f2c4a1b7e30 triggered the incident investigation.
     Alerts Merged: 1 (Duplicates Suppressed: 0)
   * Incident [in_cac78eabb56a]: auth-service degradation: failed_login_count
     Likely Cause: Initial security on failed_login_count at src_77aa88bb99cc triggered the incident investigation.
     Alerts Merged: 1 (Duplicates Suppressed: 0)

   => Generated Recommendations: 3
   * Recommendation [rc_3d1893ba_05]: Investigate high resource consumption; clean temporary files or extend volume before saturation
     Confidence: 0.65, Risk: low
     Reasoning Path:
       -> Sustained statistical deviation observed against 15-minute historical baseline
       -> Hypothesis: Memory leak, unindexed batch job, or unbounded disk log accumulation
       -> Action: Preemptive resource audit prevents cascading service failures
   * Recommendation [rc_3d1893ba_01]: Investigate top resource consumers; scale payments-api +1 replica
     Confidence: 0.75, Risk: low
     Reasoning Path:
       -> Observed resource saturation (earliest: cpu_pct at 2026-11-20T10:39:17.555852+00:00)
       -> Subsequent latency elevation observed within correlation window
       -> Hypothesis: Local compute/memory constraint degraded response processing time (Note: correlation suggests temporal alignment, not absolute causation)
       -> Action: Scaling provides immediate capacity relief while investigating underlying process bottlenecks
   * Recommendation [rc_8eabb56a_03]: Temporarily rate-limit / lock source; review auth logs locally
     Confidence: 0.8, Risk: low
     Reasoning Path:
       -> Failed login count breached security threshold in 60s observation window
       -> Hypothesis: Possible credential stuffing, automated scanning, or dictionary probe
       -> Action: Local-only log inspection keeps sensitive credentials and usernames strictly within customer boundary

============================================================
  dev_replay completed successfully!
============================================================
```
*Exit Code: 0*

### D. Live FastAPI HTTP Server & Tenant Isolation Verification
```text
[1/8] Probing GET /api/v1/health -> 200 OK
[2/8] Testing 401 Unauthorized -> 401 OK
[3/8] Ingesting telemetry for tenant t_acme
[4/8] Probing GET /api/v1/overview -> 200 OK (tenant_id='t_acme')
[5/8] Probing GET /api/v1/alerts and /api/v1/incidents -> 200 OK
[6/8] Probing GET /api/v1/incidents/{id} -> 200 OK (Timeline & Earliest Signal verified)
[7/8] Testing approve, duplicate rejection, and rollback -> 200 OK, 400 Rejected, 200 Rolled Back
[8/8] Testing Health History, Audit Log & Cross-Tenant Barrier -> 200 OK (Zero records leaked to t_globex)
ALL LIVE INTEGRATION CHECKS PASSED WITH 100% SUCCESS!
```
*Exit Code: 0*

---

## 5. Hackathon Live Demo Walkthrough (Person C Owned Scenarios)

The live judging criteria explicitly evaluates scenarios #4, #5, #6, and #8:

### Scenario #4: Network Latency Rises
1. **Collector Injection:** Collector transmits packet loss + latency elevation on network source (`contracts/sample_payloads/02_cpu_anomaly.json`).
2. **Health Downgrade:** `evaluate_metric_state("latency_ms", 280.0)` triggers transition to `poor`.
3. **Correlation:** Correlator identifies both signals occur on the same link segment within 120s.
4. **Recommendation:** Recommendation `rc_*_02` proposes rerouting traffic via secondary gateway with a rollback plan to restore primary routing.

### Scenario #5: CPU / Memory Deviates from Baseline
1. **Baseline Warmup:** 20+ normal samples establish mean (e.g. 35.0%) and std deviation (e.g. 2.0).
2. **Sustained Anomaly Injection:** CPU jumps to 95.0% for $\ge 2$ consecutive intervals.
3. **Z-Score Detection:** Z-score computes as $+30.0\sigma$, exceeding `z_poor=4.5`.
4. **Explainable Alert:** Creates alert with full mathematical breakdown: observed value, baseline $\mu$ and $\sigma$, sample count, and crossed threshold.

### Scenario #6: Several Related Alerts Merged into One Incident
1. **Multi-Signal Arrival:** CPU anomaly alert triggers at T+0s; latency degradation alert triggers at T+35s for the same service.
2. **Correlation:** Correlator matches service name within 120s window.
3. **Incident Created:** Single incident `payments-api degradation: cpu + latency`.
4. **Timeline Formed:** Chronological timeline displays CPU spike first followed by latency.
5. **Root Cause Analysis:** Isolates `earliest_signal = cpu_pct` and provides hypothesized root cause with explicit correlation disclaimer.
6. **Suppression:** Subsequent duplicate alerts increment `suppressed_duplicates`.

### Scenario #8: Remediation Proposed, Approved, Audited, and Rolled Back
1. **Proposed Recommendation:** Engine proposes scaling the service by +1 replica with confidence 0.75 and `requires_approval: true`.
2. **Approve (`POST /recommendations/{id}/approve`):** Policy check verifies action matches `scale_out_max_1_replica`. Status transitions to `executed_simulated`. Audit log records actor, action, timestamp, and target.
3. **Idempotency Guard:** Repeated approve calls reject with HTTP 400.
4. **Rollback (`POST /recommendations/{id}/rollback`):** Operator initiates rollback. Status transitions to `rolled_back`. Audit log records the rollback execution.
