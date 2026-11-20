# AIOps Output Shapes (Alert, Incident, Recommendation)

Produced by `saas/aiops`, stored by SaaS, rendered by the dashboard. **Explainability is weighted
higher by the judges**, so every alert and recommendation carries its reasoning.

## Alert
```json
{
  "alert_id": "al_01J...",
  "tenant_id": "t_acme",
  "source_id": "src_9f2c4a1b7e30",
  "service": "payments-api",
  "kind": "anomaly | threshold | security | offline | stale",
  "metric": "cpu_pct",
  "severity": "low | medium | high | critical",
  "state": "fair",
  "event_time_utc": "2026-11-20T09:15:02Z",
  "created_at_utc": "2026-11-20T09:15:05Z",
  "incident_id": "in_01J...",
  "explanation": {
    "why": "CPU 91.4% is 4.8σ above its 15-min baseline (mean 38.2%, σ 11.1)",
    "observed": 91.4,
    "baseline": { "mean": 38.2, "std": 11.1, "window_minutes": 15, "samples": 180 },
    "z_score": 4.8,
    "threshold_crossed": "fair_max=90",
    "contributing_signals": [
      { "source_id": "src_9f2c4a1b7e30", "metric": "cpu_pct", "deviation": "+4.8σ", "weight": 0.6 },
      { "source_id": "src_9f2c4a1b7e30", "metric": "latency_ms", "deviation": "+3.1σ", "weight": 0.4 }
    ],
    "confidence": 0.86
  }
}
```

## Incident (several alerts merged)
```json
{
  "incident_id": "in_01J...",
  "tenant_id": "t_acme",
  "title": "payments-api degradation: CPU + latency + packet loss",
  "status": "open | acknowledged | resolved",
  "severity": "high",
  "started_utc": "...", "updated_utc": "...",
  "alert_ids": ["al_1", "al_2", "al_3"],
  "alert_count": 3,
  "suppressed_duplicates": 7,
  "affected_sources": ["src_9f2c4a1b7e30", "src_1a2b3c4d5e6f"],
  "likely_cause": "Resource saturation on src_9f2c… preceded latency rise on dependent network link",
  "correlation_rule": "same service within 120 s window; earliest anomaly = likely cause"
}
```

## Recommendation
```json
{
  "rec_id": "rc_01J...",
  "incident_id": "in_01J...",
  "action": "Investigate top CPU consumers on src_9f2c…; consider scaling payments-api by +1 replica",
  "reasoning_path": [
    "CPU anomaly first at 09:15:02Z (+4.8σ)",
    "Latency on same service rose 20 s later (+3.1σ)",
    "No collector or network-link events, so the cause is likely local resource pressure"
  ],
  "contributing_signals": ["cpu_pct@src_9f2c…", "latency_ms@src_9f2c…"],
  "confidence": 0.78,
  "risk": "low",
  "requires_approval": true,
  "policy_check": { "allowed": true, "policy": "scale_out_max_1_replica" },
  "rollback_plan": "Scale payments-api back to previous replica count",
  "status": "proposed | approved | executed_simulated | rolled_back | rejected"
}
```
