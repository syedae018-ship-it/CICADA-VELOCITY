# M3: AIOps Engine (`saas/aiops/`)

**Owner:** _fill in_ · **Branch:** `feature/<name>` · **Tier 2**

## Mission
Turn metadata into **health states, explained anomalies, correlated incidents and recommendations**.
Explainability is weighted higher in the final demo, so every output says *why*.

## Input
`on_ingest(tenant_id, payload)` is called by M2's ingest for every accepted payload.
Until M2 is merged, feed it `contracts/sample_payloads/*.json` in a loop.

## Build checklist
- [ ] **Baselines:** rolling mean/std (or EWMA) per `(tenant, source_id, metric)` over 15 min
- [ ] **Anomaly detection:** z-score vs baseline (`health_thresholds.json → anomaly`), not just static thresholds; ignore until `min_samples`
- [ ] **Health classifier:** per metric → worst-of → apply staleness (30 s downgrade, 60 s collector Poor) → security events. Write a `health_history` row with `reason` on every change.
- [ ] **Alerts** in the exact shape of `contracts/aiops_output.md`, with `explanation`
- [ ] **Correlation:** same service/source within a 120 s window → one incident; count `suppressed_duplicates`; earliest anomaly = `likely_cause`
- [ ] **Recommendations:** rule table (cpu → investigate/scale, latency+loss → check link, failed logins → lock/rate-limit, offline → check collector host) with `reasoning_path`, `confidence`, `rollback_plan`
- [ ] **Simulated remediation:** approve → policy check → audit_log → `executed_simulated`; rollback endpoint
- [ ] Read API: `GET /api/v1/overview`, `/alerts`, `/incidents`, `/incidents/{id}`, `/health-history`, `/audit`, `POST /recommendations/{id}/approve|rollback`, `GET /api/v1/stream` (SSE)
- [ ] Use M2's `tenant_query()` for **every** query

## Demo scenarios you own
#4 Latency rises · #5 CPU deviates from baseline · #6 Several alerts → one incident · #8 Remediation

## Judges will ask
"How do you tell a real anomaly from a normal spike?" → baseline + z-score + a sustained-for-N-samples rule + correlation with other signals.
