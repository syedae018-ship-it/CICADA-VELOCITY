# Raw Input Format (Tier 1 only, never leaves the collector)

The organizer will provide a simulated telemetry stream. Its exact format is **not known yet**.
So the collector has ONE adapter (`collector/adapters/`) that converts whatever arrives into this
internal `RawRecord`. When the organizer format is published, only the adapter changes.

Until then, `demo/simulator.py` produces records in this format.

```json
{
  "kind": "metric | log | auth | flow | heartbeat",
  "ts": "2026-11-20T09:15:02.123Z",
  "host": "db-prod-01.acme.local",
  "ip": "10.0.4.17",
  "service": "payments-api",
  "source_type": "server | network | app | security",
  "metrics": { "cpu_pct": 41.2, "mem_pct": 58.0, "disk_pct": 62.1, "latency_ms": 23.5,
               "packet_loss_pct": 0.0, "bandwidth_mbps": 120.4, "service_up": true, "connectivity_ok": true },
  "message": "raw log line, may contain password=hunter2 or Bearer eyJ...",
  "user": "alice@acme.com",
  "src_ip": "203.0.113.9",
  "outcome": "success | failure"
}
```

| `kind` | Meaningful fields |
|---|---|
| `metric` | `metrics` |
| `log` | `message`, `level` |
| `auth` | `user`, `src_ip`, `outcome`, used for failed-login burst detection **locally** |
| `flow` | `src_ip`, `dst_ip`, `bytes`, `latency_ms` |

Every field here except metric numbers and `service` is **local-only** (see `allowlist.md`).
