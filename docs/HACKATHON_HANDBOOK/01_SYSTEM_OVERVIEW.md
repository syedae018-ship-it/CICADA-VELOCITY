# Chapter 1: System Overview & Core Philosophy

## 1. The Core Problem in Modern Cloud Observability

Enterprise monitoring today suffers from a fundamental privacy and compliance dilemma:
1. **Raw Log Ingestion Leaks Secrets**: Engineering teams ship application logs, system dumps, and connection traces straight to SaaS cloud providers (Datadog, Splunk, Dynatrace). Inevitably, API keys, passwords, JWT bearer tokens, and personally identifiable information (PII) leak into the cloud.
2. **Data Sovereignty Violations**: GDPR, HIPAA, and regional data governance laws prohibit customer data from crossing geographic borders without explicit residency isolation.
3. **Alert Fatigue & Hallucinatory AI**: Generic cloud AIOps platforms trigger dozens of uncoordinated alerts for a single cascaded failure, overwhelming on-call engineers.

---

## 2. The Velocity Cicada Solution: Two-Tier Architecture

Velocity Cicada solves this by enforcing an architectural **iron curtain** between the Customer Environment (Tier 1) and the Cloud SaaS (Tier 2):

```
┌────────────────────────────────────────────────────────┐
│              TIER 1: CUSTOMER ON-PREM / VPC            │
│  (Raw Logs, Sensitive Credentials, Internal Hostnames)  │
│                                                        │
│   Servers/Apps ──> Local Collector ──> SQLite Outbox   │
│                          │                             │
│       [LOCAL REGEX REDACTION & HMAC SALT]              │
└──────────────────────────┬─────────────────────────────┘
                           │
                 HMAC-SHA256 Wire Signed
               (Sanitized Aggregated Metadata)
                           │
┌──────────────────────────▼─────────────────────────────┐
│                 TIER 2: CLOUD SAAS                     │
│        (0 Secrets, 0 PII, Pseudonymous IDs)            │
│                                                        │
│  FastAPI Ingest ──> Deduplication ──> Supabase         │
│         │                                              │
│   AIOps Engine (Z-Score Baselines, Incident Correlator)│
│         │                                              │
│  Next.js 16 Executive Observability Dashboard          │
└────────────────────────────────────────────────────────┘
```

---

## 3. The 4 Fundamental Guarantees of Velocity Cicada

### Guarantee 1: Zero Secrets Leave Customer Premise
- Raw logs and metrics are collected exclusively inside the customer's private network.
- A local **Redaction Engine** matches 11 distinct credential regex patterns (passwords, JWTs, AWS keys, bearer tokens, API secrets, IPv4 addresses, emails).
- Raw data is stored in a private local SQLite database that **automatically purges records after 24 hours**. Raw records **never** cross the network.

### Guarantee 2: Strict Allow-List Enforcement
- No free-form log text is ever transmitted over the wire.
- The collector aggregates telemetry into strict 5-second metadata windows adhering to `contracts/payload_schema.json`.
- Only numeric statistical distributions (min, max, mean, p95), health state enumerations, and pre-approved event summaries are allowed to egress.

### Guarantee 3: Mathematical Pseudonymization
- Sensitive hostnames and infrastructure names (e.g., `prod-db-master.internal.acme.corp`) are replaced with pseudonymous identifiers:
  $$\text{source\_id} = \text{src\_} + \text{HMAC-SHA256}(\text{SITE\_SALT}, \text{host})[0:12]$$
- The `SITE_SALT` is an encrypted key stored only inside the customer's collector config. The cloud SaaS has **no mathematical way** to reverse-engineer internal server names.

### Guarantee 4: Resilient Outbox & Idempotent Ingestion
- If the SaaS cloud or internet link goes offline, the collector queues payloads in a persistent local disk outbox (`transport/db.py`).
- Upon reconnection, payloads replay in monotonic order.
- The SaaS ingestion layer enforces **strict idempotency** via primary key constraint on `payload_id` (UUIDv4) and SHA-256 payload checksums. Replayed or duplicate network packets are rejected gracefully without skewing metrics.
