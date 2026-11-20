# Chapter 12: Hackathon Judge Q&A Preparation (40+ Questions)

Prepare for judge questions across 10 distinct categories. Each question includes a short spoken answer, deep technical explanation, implementation file, and project example.

---

## Category 1: Basic Project Understanding

### Q1: What is Velocity Cicada in one sentence?
- **Spoken Answer**: *"Velocity Cicada is a privacy-first, two-tier AIOps observability platform that guarantees zero customer secrets leave their environment while still delivering automated incident detection and remediation in the cloud."*
- **Technical Explanation**: Solves the enterprise compliance problem where cloud monitoring platforms inadvertently ingest sensitive customer credentials and PII.
- **File Reference**: `collector/redact.py` & `contracts/payload_schema.json`.
- **Project Example**: When a server logs an API key or password, it is redacted locally on Tier 1 before 5-second metadata egress.

### Q2: Why is traditional monitoring broken?
- **Spoken Answer**: *"Traditional tools ship raw logs directly to third-party clouds, exposing passwords, tokens, and PII to massive compliance risks, while flooding engineers with alert storms during outages."*
- **Technical Explanation**: Direct log shipping violates GDPR/HIPAA; lack of multi-signal correlation produces alert fatigue.
- **File Reference**: `saas/aiops/correlate.py`.

### Q3: Who are the target users?
- **Spoken Answer**: *"Enterprise DevOps, SecOps, and site reliability engineers in regulated sectors like banking, healthcare, and government who are forbidden from sending raw logs to traditional SaaS monitoring."*

### Q4: How is this different from Datadog or Splunk?
- **Spoken Answer**: *"Datadog requires shipping your logs to their cloud to get AIOps insights. Velocity Cicada performs local redaction and aggregation first, shipping only cryptographic metadata proofs, so zero secrets ever reach the cloud."*
- **File Reference**: `collector/aggregate.py`.

---

## Category 2: Architecture & Topology

### Q5: Why do we need a local collector? Why not run everything in the cloud?
- **Spoken Answer**: *"Because once a secret crosses the network boundary to the cloud, the compliance breach has already occurred. The collector acts as a trusted local airlock that sanitizes data before transmission."*
- **File Reference**: `collector/app.py`.

### Q6: How do Tier 1 and Tier 2 communicate?
- **Spoken Answer**: *"Exclusively over HTTPS using pre-shared HMAC-SHA256 signatures, sending strictly typed JSON metadata payloads validated against schema Draft 2020-12."*
- **File Reference**: `transport/signing.py` & `contracts/payload_schema.json`.

### Q7: What runs on the collector versus SaaS?
- **Spoken Answer**: *"The collector runs raw ingestion, 11-rule regex redaction, salted pseudonymization, 5-second statistical aggregation, and disk outbox buffering. SaaS runs deduplication, 15-minute sliding Welford baselines, Z-score anomaly detection, incident correlation, and the executive dashboard."*

### Q8: Can a customer run multiple collectors?
- **Spoken Answer**: *"Yes. Collectors are completely stateless except for their local outbox. An enterprise can run dozens of regional collectors all reporting to the same SaaS tenant."*
- **File Reference**: `saas/ingest/routes.py` (keyed on `collector_id`).

---

## Category 3: Privacy & Security

### Q9: How do you guarantee secrets never reach the SaaS cloud?
- **Spoken Answer**: *"We have a three-layer defense: first, local regex redaction masks 11 sensitive patterns; second, raw logs are stored exclusively in local SQLite that purges in 24 hours; third, the wire protocol enforces an allow-list schema where free-form text fields cannot physically exist."*
- **File Reference**: `collector/redact.py`, `collector/aggregate.py`, `contracts/payload_schema.json`.

### Q10: What regex patterns do you catch?
- **Spoken Answer**: *"Passwords, API keys, JWTs, Bearer tokens, AWS access keys, SSH private keys, credit cards, SSNs, emails, IPv4 addresses, and database connection strings."*
- **File Reference**: `contracts/redaction_rules.json`.

### Q11: How does pseudonymization work?
- **Spoken Answer**: *"We replace hostnames with `src_` plus the first 12 hex characters of an HMAC-SHA256 hash using a customer-secret salt. The salt never leaves the customer VPC, making it mathematically irreversible by SaaS."*
- **File Reference**: `collector/pseudo.py`.

### Q12: What prevents replay attacks over the wire?
- **Spoken Answer**: *"Every request includes an `X-Timestamp` header. The SaaS backend drops any request whose timestamp differs by more than 300 seconds, and drops duplicate `payload_id` values using database primary keys."*
- **File Reference**: `saas/ingest/auth.py`.

---

## Category 4: Collector & Transport

### Q13: What happens when the internet connection drops?
- **Spoken Answer**: *"The collector automatically buffers metadata payloads in a persistent local SQLite outbox with exponential backoff. Once the link restores, payloads flush in sequence with zero data loss."*
- **File Reference**: `transport/db.py` & `transport/sender.py`.
- **Demo Reference**: Scenario #7 (Outage).

### Q14: Why use an SQLite outbox instead of in-memory queues?
- **Spoken Answer**: *"If the collector machine crashes or reboots during a network outage, an in-memory queue loses all data. SQLite with Write-Ahead Logging guarantees persistence across crashes."*

### Q15: How do you prevent outbox disk exhaustion during prolonged outages?
- **Spoken Answer**: *"The outbox enforces a configurable maximum buffer depth. If limits are reached, oldest non-critical metrics are pruned while critical security events are prioritized."*

### Q16: How is payload integrity verified?
- **Spoken Answer**: *"The collector computes a SHA-256 digest of the JSON body and signs the payload with HMAC-SHA256. SaaS recomputes both to guarantee zero in-transit tampering."*
- **File Reference**: `transport/signing.py`.

---

## Category 5: AIOps & Anomaly Detection

### Q17: How does your anomaly detection work?
- **Spoken Answer**: *"We calculate a rolling 15-minute mean and standard deviation for each metric using Welford's algorithm, and compute the Z-score for incoming values. If a value exceeds 4.5 standard deviations beyond its learned baseline, it flags an anomaly."*
- **File Reference**: `saas/aiops/baseline.py` & `saas/aiops/detect.py`.

### Q18: What prevents false alarms during low-activity periods?
- **Spoken Answer**: *"We enforce configured noise floors. For example, CPU fluctuations under 2% or latency swings under 5ms are mathematically ignored even if their Z-score is high."*
- **File Reference**: `saas/aiops/detect.py` (`NOISE_FLOORS`).

### Q19: How do you correlate multiple alerts into one incident?
- **Spoken Answer**: *"When multiple alerts fire within a 5-minute sliding window on the same or related services, our correlator clusters them into a single incident, identifying the root cause and earliest signal."*
- **File Reference**: `saas/aiops/correlate.py`.
- **Demo Reference**: Scenario #5 (Correlation).

### Q20: Can the AI execute remediation actions automatically?
- **Spoken Answer**: *"Our recommendation engine generates remediations with safety policy checks and explicit rollback plans. High-risk actions require human approval via a single click in the dashboard."*
- **File Reference**: `saas/aiops/recommend.py`.

---

## Category 6: Database & Multi-Tenancy

### Q21: How do you separate customer data?
- **Spoken Answer**: *"Every table includes a `tenant_id` column protected by PostgreSQL Row Level Security (RLS). Users can only query rows matching their authenticated organization."*
- **File Reference**: `contracts/supabase/001_init.sql`.

### Q22: What happens if Supabase is offline?
- **Spoken Answer**: *"The SaaS backend includes a zero-downtime offline fallback that switches automatically to localized regional SQLite databases."*
- **File Reference**: `saas/db.py` (`SqliteStore`).

### Q23: How do you handle out-of-order data?
- **Spoken Answer**: *"All metrics are stored and queried using `event_time_utc` rather than arrival time, so delayed packets are inserted into their correct historical position without distorting graphs."*
- **File Reference**: `contracts/supabase/001_init.sql` (`metrics` table).

---

## Category 7: Reliability & Failure Recovery

### Q24: What is your SLA target for ingestion latency?
- **Spoken Answer**: *"Our platform guarantees a P95 ingestion latency of under 10.0 seconds from local collection to dashboard availability."*
- **File Reference**: `saas/ingest/routes.py` & `dashboard/src/components/dashboard/views/ReliabilityView.tsx`.

### Q25: How do you handle duplicate payloads?
- **Spoken Answer**: *"Every payload contains a UUIDv4 `payload_id`. The database rejects duplicate insertions via primary key constraint and returns HTTP 200 with status duplicate, preserving idempotency."*
- **File Reference**: `saas/db.py` (`DuplicatePayload`).

### Q26: How do you detect sequence gaps?
- **Spoken Answer**: *"Payloads carry a strictly monotonic `seq` number. If SaaS receives sequence 15 followed by 17, it records a sequence gap of 1, alerting operators to packet loss."*

---

## Category 8: Performance & Benchmarking

### Q27: What is the CPU/memory footprint of the collector?
- **Spoken Answer**: *"The collector operates under 25MB of RAM and under 1.5% CPU by using Welford single-pass algorithms and lightweight SQLite WAL mode."*

### Q28: How fast is the regex redaction engine?
- **Spoken Answer**: *"All 11 regex patterns are pre-compiled at startup. Benchmarks demonstrate over 15,000 log records redacted per second on a single CPU core."*
- **File Reference**: `collector/redact.py`.

---

## Category 9: Scalability

### Q29: How does the system scale to thousands of servers?
- **Spoken Answer**: *"Because aggregation happens locally at the edge every 5 seconds, 1,000 raw server metrics collapse into a single lightweight metadata payload, reducing cloud network bandwidth by over 95%."*

### Q30: How does the SaaS tier scale horizontally?
- **Spoken Answer**: *"FastAPI ingestion workers are completely stateless. They can scale horizontally behind an AWS ALB or Cloudflare load balancer reading and writing to Supabase."*

---

## Category 10: Limitations & Honest Future Scope

### Q31: What are the current limitations of the system?
- **Spoken Answer**: *"First, regex redaction only catches known credential patterns; novel secret formats require rule updates. Second, baseline accuracy requires at least 15 minutes of historical traffic to achieve optimal statistical confidence."*

### Q32: Can an attacker invert the pseudonymized source ID?
- **Spoken Answer**: *"Not without knowing the customer's secret `SITE_SALT`. HMAC-SHA256 is cryptographically resistant to preimage attacks and rainbow tables."*

### Q33: What is on the roadmap after the hackathon?
- **Spoken Answer**: *"Adding eBPF kernel-level telemetry collection to eliminate the need for application adapters, and WebAssembly-based local redaction plugins."*
