# Chapter 10: The 9 Live Demo Scenarios Handbook

Velocity Cicada includes **9 pre-built live scenarios** (`collector/demo_driver.py`) that test the complete system end to end. You can trigger them from the dashboard header or directly via curl.

---

## Scenario 1: Normal Baseline Traffic

- **What it simulates**: Continuous, healthy server telemetry (CPU 15–30%, memory 40–55%, latency 8–20ms).
- **Trigger**:
  ```bash
  curl -s -X POST "http://localhost:8001/local/demo/normal"
  ```
- **Collector Behavior**: Aggregates normal metrics every 5 seconds.
- **SaaS Behavior**: Updates 15-minute rolling baselines using Welford's algorithm.
- **Dashboard Changes**: Overall health shows `EXCELLENT` with clean green sparklines.
- **What to tell judges**: *"The collector establishes a mathematical baseline of what normal behavior looks like without human configuration."*

---

## Scenario 2: Secret Credential Leak Injection

- **What it simulates**: A buggy application logs passwords, bearer tokens, AWS credentials, and user emails.
- **Trigger**:
  ```bash
  curl -s -X POST "http://localhost:8001/local/demo/secret?duration=30"
  ```
- **Collector Behavior**: Detects credential patterns and applies regex masking. Raw logs are saved to local SQLite (24h purge).
- **SaaS Behavior**: Receives aggregated metadata with allow-listed statistics only.
- **Dashboard Changes**:
  - Open **Privacy Side-by-Side View**: Shows raw log on Tier 1 with leak highlight, and sanitized metadata on Tier 2.
  - Open **Egress Proof View**: Cryptographic proof shows **0 secrets reached SaaS**.
- **What to tell judges**: *"Notice that while secrets were printed locally, the allow-list filter and local regex engine ensured zero sensitive bytes ever crossed the network."*

---

## Scenario 3: Single-Source CPU Spike

- **What it simulates**: Runaway process on `payments-api` causing CPU to jump to 95%.
- **Trigger**:
  ```bash
  curl -s -X POST "http://localhost:8001/local/demo/cpu_spike?duration=40"
  ```
- **AIOps Behavior**: Compares 95% against the 15-minute mean ($24\% \pm 5\%$). Flags $Z = +14.2\sigma$, exceeding the critical threshold.
- **Dashboard Changes**:
  - Overview health drops to `POOR`.
  - Anomaly card appears with Z-score explanation.
- **What to tell judges**: *"The system detected this anomaly not because of a rigid arbitrary threshold, but because it statistically deviated 14 standard deviations from its learned baseline."*

---

## Scenario 4: Network Latency & Packet Loss

- **What it simulates**: Network switch congestion causing cross-cluster latency to climb to 450ms.
- **Trigger**:
  ```bash
  curl -s -X POST "http://localhost:8001/local/demo/latency?duration=40"
  ```
- **Dashboard Changes**: Reliability view flags high P95 latency and packet loss degradation.

---

## Scenario 5: Multi-Signal Cascading Incident (Correlation)

- **What it simulates**: A severe database slowdown causes high CPU, elevated API latency, and database connection warning logs simultaneously.
- **Trigger**:
  ```bash
  curl -s -X POST "http://localhost:8001/local/demo/correlation?duration=45"
  ```
- **AIOps Behavior**: Instead of creating 3 separate alerts, `saas/aiops/correlate.py` groups all 3 signals into **INC-001**.
- **Dashboard Changes**:
  - Open **Incidents View**: Shows 1 incident with 3 contributing signals.
  - Open **AI Insights View**: Proposes an automated remediation plan with rollback options.
- **What to tell judges**: *"Traditional tools would wake up on-call with 3 separate alerts. Velocity Cicada correlates related signals into one actionable incident with an automated fix."*

---

## Scenario 6: VPN Gateway Brute Force Logins

- **What it simulates**: A rapid burst of failed authentication attempts on the security gateway.
- **Trigger**:
  ```bash
  curl -s -X POST "http://localhost:8001/local/demo/logins?duration=30"
  ```
- **AIOps Behavior**: Detects an auth event anomaly and flags security degradation.

---

## Scenario 7: Network Outage, Local Buffering & Replay

- **What it simulates**: Total loss of connectivity between the collector and SaaS cloud.
- **Trigger**:
  ```bash
  curl -s -X POST "http://localhost:8001/local/demo/outage?duration=20"
  ```
- **Collector Behavior**: Marks link disconnected. Telemetry spools to SQLite outbox (`buffer_depth` rises).
- **Recovery Behavior**: Link restores automatically. Buffered payloads flush in monotonic sequence order.
- **Dashboard Changes**:
  - Open **Reliability View**: Watch the SVG buffer area chart climb during the outage, then drain back to zero upon recovery.
- **What to tell judges**: *"Zero data loss. Even during complete cloud disconnection, the local outbox guarantees reliable delivery without memory overflow."*

---

## Scenario 8: Duplicate Payload Replay (Idempotency)

- **What it simulates**: An unreliable network causes a payload to be transmitted twice.
- **Trigger**:
  ```bash
  curl -s -X POST "http://localhost:8001/local/demo/duplicate"
  ```
- **SaaS Behavior**: Database unique constraint rejects the duplicate `payload_id`, returning `HTTP 200 {"status": "duplicate"}`.
- **Dashboard Changes**: Reliability page increments the **Duplicate Payloads Rejected** counter.
- **What to tell judges**: *"Our ingestion is completely idempotent. Network retries can never corrupt historical metrics or inflate alert counts."*

---

## Scenario 9: Out-of-Order Delayed Telemetry

- **What it simulates**: Telemetry from a remote edge node arrives 2 minutes late due to network routing delays.
- **Trigger**:
  ```bash
  curl -s -X POST "http://localhost:8001/local/demo/out_of_order"
  ```
- **SaaS Behavior**: Stores metrics indexed by **event timestamp**, not arrival timestamp.
- **Dashboard Changes**: Time-series charts place the delayed data point in its correct historical chronological position.
- **What to tell judges**: *"We separate event time from arrival time, ensuring historical analytics remain accurate even with erratic mobile or edge networks."*
