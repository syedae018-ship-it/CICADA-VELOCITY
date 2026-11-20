# Velocity Cicada — Windows Collector Architecture

## 1. Architectural Overview

Velocity Cicada Collector is an enterprise-grade observability agent for Windows that implements a **two-tier zero-trust architecture**:
- **Tier 1 (Customer Workstation):** Local continuous collection, regex credential redaction, cryptographic salt pseudonymization, and 60-second window aggregation. Raw customer data, usernames, and unredacted logs NEVER cross the trust boundary.
- **Tier 2 (SaaS Cloud Backend):** Ingestion gate enforcing HMAC-SHA256 authentication, replay verification, allow-list schema validation, multi-tenant isolation, and automated AIOps correlation.

---

## 2. High-Level Component Diagram

```mermaid
flowchart TD
    subgraph "WINDOWS HOST (Tier 1 - Customer Boundary)"
        subgraph "Host Metric Probes"
            A1["psutil (CPU, RAM, Disk, Net)"]
            A2["Safe Ping Probe (Latency, Loss)"]
            A3["Safe Security Probe (Failed Logins)"]
        end

        subgraph "Background Service (VelocityCicadaCollector)"
            B1["Host Telemetry Sampler (Every 10s)"]
            B2["Normalization & Canonical Adapter"]
            B3["AI Redaction Engine (Regex + Shannon Entropy)"]
            B4["Salt Pseudonymizer (HMAC-SHA256 source_id)"]
            B5["Aggregation Window Buffer (60s Flush)"]
            B6["Allowlist Filter (payload_schema.json)"]
            B7["SQLite Persistent Outbox & Egress Log"]
            B8["Sender & Heartbeat Workers"]
            B9["Local Status REST API (:8001)"]
            B10["Single-Instance Mutex & DPAPI Vault"]
        end

        subgraph "Desktop User Interface"
            C1["Status Tray Companion (Velocity-Cicada-Tray.exe)"]
        end
    end

    subgraph "TRUST BOUNDARY (HTTPS / HMAC-SHA256 Wire Signing)"
        D1["POST /api/v1/heartbeat (Every 10s)"]
        D2["POST /api/v1/ingest (Every 60s)"]
        D3["POST /api/v1/enroll (Initial Setup)"]
    end

    subgraph "VELOCITY CICADA SAAS BACKEND (Tier 2)"
        E1["HMAC Signature & Replay Gate (< 300s)"]
        E2["Tenant Registry & Schema Validator"]
        E3["Idempotent Deduplication Engine"]
        E4["AIOps Engine (Baselines, Anomaly Detection, Triage)"]
        E5["Multi-Tenant Store (Supabase / SQLite)"]
    end

    subgraph "OPERATOR DASHBOARD (:3000)"
        F1["Fleet Observability View"]
        F2["Egress Proof Verification Panel"]
        F3["AIOps Incident & Alert Stream"]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1

    B1 --> B2 --> B3 --> B4 --> B5 --> B6 --> B7 --> B8
    B8 --> D1
    B8 --> D2
    B10 --> B8

    C1 <-->|"IPC / Local REST (:8001)"| B9

    D1 --> E1
    D2 --> E1
    D3 --> E2

    E1 --> E2 --> E3 --> E4 --> E5
    E5 <--> F1
    E5 <--> F2
    E5 <--> F3
```

---

## 3. The 8-Stage Telemetry Pipeline

```text
[ COLLECT ]      psutil samples CPU, RAM, Disk, Network speeds; safe probes sample latency & security.
     ↓
[ NORMALIZE ]    Raw OS metrics converted into canonical structured event records.
     ↓
[ REDACT ]       Sensitive tokens, emails, IPs, JWTs, and high-entropy strings masked.
     ↓
[ PSEUDONYMIZE ] Local hostname hashed into 'src_xxxxxxxxxxxx' via HMAC-SHA256 with local salt.
     ↓
[ AGGREGATE ]    10-second metric slices held in memory and summarized into a 60-second window.
     ↓
[ ALLOW-LIST ]   Draft 2020-12 schema validation drops any unapproved fields (default-deny).
     ↓
[ SIGN ]         Serialized payload signed with HMAC-SHA256 (X-Timestamp, X-Signature headers).
     ↓
[ SEND ]         Queued in SQLite outbox, sent via HTTPS to SaaS with exponential backoff & retry.
```

---

## 4. Key Security & Resiliency Guarantees

1. **Zero Console Windows:**
   All subprocess calls (`ping.exe`, `wevtutil.exe`, `powershell.exe`) specify `CREATE_NO_WINDOW` (`0x08000000`) and `STARTF_USESHOWWINDOW` with `SW_HIDE`. The agent runs completely invisible to desktop users.
2. **Single-Instance Enforcement:**
   Windows Named Mutex `Global\VelocityCicadaCollector_Service_Mutex` guarantees only one service process runs at any time, preventing outbox file corruption and duplicate network requests.
3. **Decoupled Architecture:**
   The core service runs independently as a system service. Launching, closing, or crashing the System Tray application has zero impact on continuous background collection or SaaS transmission.
4. **Credential Protection (DPAPI):**
   Secrets stored in `config.json` are encrypted using Windows Data Protection API (`CryptProtectData`), restricting decryption to the local Windows machine context.
5. **Zero Data Loss Outage Resilience:**
   During network drops or SaaS maintenance, payloads accumulate in the SQLite `outbox` table. When connectivity returns, the collector drains buffered records sequentially, while the SaaS idempotency engine safely handles duplicate payload IDs.
