# Chapter 9: Complete Manual Testing Handbook

A beginner-friendly testing guide. You can independently execute every test using a standard terminal without touching source code.

---

## Pre-Flight Setup: Starting the Stack

Open **3 terminal windows**:

### Terminal 1: Cloud SaaS Backend (Port 8000)
```bash
cd "/Users/syedmustafaahmed/Documents/CODE/velocity cicada"
.venv/bin/python -m uvicorn saas.app:app --port 8000
```
*Expected Output:* `Application startup complete. Uvicorn running on http://127.0.0.1:8000`

### Terminal 2: Customer Collector (Port 8001)
```bash
cd "/Users/syedmustafaahmed/Documents/CODE/velocity cicada"
.venv/bin/python -m uvicorn collector.app:app --port 8001
```
*Expected Output:* `Application startup complete. Uvicorn running on http://127.0.0.1:8001`

### Terminal 3: Executive Dashboard (Port 3000)
```bash
cd "/Users/syedmustafaahmed/Documents/CODE/velocity cicada/dashboard"
npm run dev
```
*Expected Output:* `Ready in ...ms. Local: http://localhost:3000`

---

## Test Suite 1: Local Ingestion & Redaction Verification

### Test 1.1: Verify Clean Telemetry Ingestion
- **Objective**: Verify that normal metric records are ingested and buffered.
- **Terminal Command**:
  ```bash
  curl -s -X POST http://localhost:8001/local/raw \
    -H "Content-Type: application/json" \
    -d '{"host": "payments-api-01", "kind": "metric", "metrics": {"cpu_pct": 24.5, "mem_pct": 52.0}}'
  ```
- **Expected Result**:
  ```json
  {"status": "accepted", "source_id": "src_...", "secrets_redacted": 0}
  ```
- **Pass Verification**: `secrets_redacted` is `0`, and a valid `source_id` is generated.

---

### Test 1.2: Verify Local Secret Redaction (Password & Bearer Token)
- **Objective**: Prove that raw secrets injected into logs are immediately masked locally and never saved in raw form in egress buffers.
- **Terminal Command**:
  ```bash
  curl -s -X POST http://localhost:8001/local/raw \
    -H "Content-Type: application/json" \
    -d '{"host": "auth-gateway", "kind": "log", "message": "Failed login with password=SuperSecretPassword99! and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae7"}'
  ```
- **Expected Result**:
  ```json
  {"status": "accepted", "source_id": "src_...", "secrets_redacted": 2}
  ```
- **Verify in Local Store**:
  ```bash
  curl -s http://localhost:8001/local/raw?limit=1 | grep REDACTED
  ```
- **Pass Verification**: The stored `redacted_obj` shows `[REDACTED:password_assignment]` and `[REDACTED:jwt]`.

---

## Test Suite 2: Egress Security & Outbox Resilience

### Test 2.1: Verify Outbox Buffer Depth
- **Objective**: Confirm that the persistent outbox records outgoing payloads.
- **Terminal Command**:
  ```bash
  curl -s http://localhost:8001/local/buffer
  ```
- **Expected Result**:
  ```json
  {"buffer_depth": 0, "oldest_seq": 1, "pending": 0}
  ```
- **Pass Verification**: `buffer_depth` is `0` when SaaS is online (indicating successful delivery).

---

### Test 2.2: Verify Simulated Outage & Local Spooling
- **Objective**: Simulate link loss to SaaS and prove payloads queue up safely without dropping data.
- **Step 1**: Disconnect the SaaS link:
  ```bash
  curl -s -X POST http://localhost:8001/local/saas-link \
    -H "Content-Type: application/json" \
    -d '{"connected": false}'
  ```
- **Step 2**: Trigger 3 new telemetry records:
  ```bash
  for i in {1..3}; do
    curl -s -X POST http://localhost:8001/local/raw \
      -H "Content-Type: application/json" \
      -d "{\"host\": \"node-$i\", \"kind\": \"metric\", \"metrics\": {\"cpu_pct\": 40.0}}"
  done
  ```
- **Step 3**: Wait 6 seconds (to trigger the 5s aggregation window), then check buffer:
  ```bash
  curl -s http://localhost:8001/local/buffer
  ```
- **Expected Result**: `buffer_depth` increases to $\ge 1$, and `pending` is $> 0$.
- **Step 4**: Reconnect the link:
  ```bash
  curl -s -X POST http://localhost:8001/local/saas-link \
    -H "Content-Type: application/json" \
    -d '{"connected": true}'
  ```
- **Step 5**: Wait 3 seconds, then check buffer again:
  ```bash
  curl -s http://localhost:8001/local/buffer
  ```
- **Expected Result**: `buffer_depth` returns to `0`. All queued records have replayed successfully!

---

## Test Suite 3: SaaS Ingestion & Idempotency

### Test 3.1: Verify Duplicate Payload Rejection
- **Objective**: Prove that re-sending an already delivered payload returns `duplicate` without re-inserting.
- **Command**: Run the pre-built test script:
  ```bash
  .venv/bin/python -m pytest tests/test_transport_and_ingest.py -k "test_duplicate_rejected"
  ```
- **Expected Output**: `1 passed in ...s`
- **Pass Verification**: SaaS returns HTTP 200 with `status="duplicate"` and increments duplicate reject counter.

---

## Test Suite 4: AIOps Anomaly Detection & Recommendations

### Test 4.1: Trigger CPU Spike Anomaly
- **Objective**: Trigger the AIOps engine to detect abnormal CPU and generate an incident.
- **Command**:
  ```bash
  curl -s -X POST "http://localhost:8001/local/demo/cpu_spike?duration=30"
  ```
- **Check Alerts on SaaS**:
  ```bash
  curl -s -H "X-Tenant-Id: t_acme" http://localhost:8000/api/v1/alerts
  ```
- **Check Incidents on SaaS**:
  ```bash
  curl -s -H "X-Tenant-Id: t_acme" http://localhost:8000/api/v1/incidents
  ```
- **Pass Verification**: An alert with `metric: cpu_pct` and an open incident are visible.

### Test 4.2: Authorize Automated Recommendation
- **Objective**: Approve an AI-suggested remediation.
- **Fetch Pending Recommendation ID**:
  ```bash
  REC_ID=$(curl -s -H "X-Tenant-Id: t_acme" http://localhost:8000/api/v1/overview | grep -o 'rec_[a-z0-9]*' | head -1)
  echo "Approving recommendation: $REC_ID"
  ```
- **Approve via API**:
  ```bash
  curl -s -X POST -H "X-Tenant-Id: t_acme" "http://localhost:8000/api/v1/recommendations/$REC_ID/approve"
  ```
- **Expected Output**: `{"status": "executed_simulated", ...}`
