# Chapter 8: Dashboard Feature-by-Feature Guide

## 1. Overview of All 11 Dashboard Views

The Velocity Cicada dashboard is built on **Next.js 16 (App Router)** and styled with custom Donezo tokens (cream `#f4f5ef` canvas, forest `#104f2a` primary, bright mint `#bff09c` accent).

---

### View 1: Executive Overview (`OverviewView.tsx`)
- **What it represents**: Real-time high-level health of the entire tenant infrastructure.
- **Key KPIs**:
  - `Overall System Health`: Aggregated worst-state across all services (`EXCELLENT`, `GOOD`, `FAIR`, `POOR`).
  - `Active Collectors`: Ratio of online to offline collectors (e.g., `1 / 1 Online`).
  - `Open Incidents`: Count of unmitigated multi-signal incidents.
  - `Active Monitored Sources`: Count of connected nodes and pods.
- **Interactive Controls**: Scenario injection bar (Quick Demo triggers: Normal, CPU Spike, Outage, Secret, Latency).

---

### View 2: Monitored Sources (`SourcesView.tsx`)
- **What it represents**: Inventory of every monitored endpoint with live health status.
- **Details Displayed**:
  - Source ID (`src_7a9f2b1c4e80`), Service classification (`payment`, `auth`, `web`), Region (`ap-south-1`).
  - Health state badges with live heartbeat pulse indicator.
  - Sparkline metric trends (CPU %, Memory %, Latency ms).
- **Interactions**: Clicking any row opens the **Source Detail Drawer** with historical graphs and alert records.

---

### View 3: Collector Fleet (`FleetView.tsx`)
- **What it represents**: Operational status of deployed Tier 1 collector nodes.
- **Key Indicators**:
  - Connection status (`online` \| `offline`), Version tag, Heartbeat timestamp.
  - Outbox Buffer Depth (payloads currently queued in SQLite).
  - Config hash and memory/CPU utilization.

---

### View 4: Correlated Incidents (`IncidentsView.tsx`)
- **What it represents**: Multi-signal incident investigation view.
- **Features**:
  - Grouped alert cards preventing single-incident alert flooding.
  - Hypothesized root cause vs earliest signal indicator.
  - Interactive incident timeline detailing the cascade sequence.

---

### View 5: AI Insights & Recommendations (`AIInsightsView.tsx`)
- **What it represents**: Explainable AI remediation center.
- **Features**:
  - Detailed reasoning paths and confidence scores (e.g., `94% Confidence`).
  - Automated enterprise policy pre-check status (`allowed: true`).
  - Rollback safety plan.
  - **One-Click Human Approval**: Authorize simulated or live remediation commands.

---

### View 6: Egress Proof (`EgressProofView.tsx`)
- **What it represents**: Cryptographic proof of what leaves the customer environment.
- **Features**:
  - Payload-by-payload egress log with HMAC-SHA256 signature verification.
  - Live inspection comparing Collector Sent SHA-256 vs SaaS Received SHA-256.
  - Automated regex verification proving **0 secrets transmitted**.

---

### View 7: Privacy & Redaction Side-by-Side (`PrivacySideBySideView.tsx`)
- **What it represents**: Interactive visual comparison of Tier 1 local vs Tier 2 cloud data.
- **Features**:
  - 5-stage interactive data flow pipeline diagram.
  - Side-by-side inspection cards showing raw un-redacted logs (with leak highlights) strictly retained on local disk alongside sanitized allow-listed metadata received by SaaS.
  - 24-hour local purge verification indicator.

---

### View 8: Reliability & Outage Analytics (`ReliabilityView.tsx`)
- **What it represents**: Infrastructure transport resilience and SLA compliance.
- **Visualizations**:
  - Responsive SVG area chart tracking outbox buffer accumulation during network outages.
  - P95 Ingest Latency tracker ($< 10.0\text{s}$ SLA guarantee).
  - Deduplication counter and sequence monotonicity verification.

---

### View 9: Audit Reports (`ReportsView.tsx`)
- **What it represents**: Executive compliance summaries for security officers and auditors.
- **Features**:
  - Data sovereignty compliance certification.
  - Cumulative redaction count and secret leak prevention certificates.

---

### View 10: Event Activity Timeline (`TimelineView.tsx`)
- **What it represents**: Chronological audit trail of all anomalies, heartbeats, and egress events.
- **Features**:
  - Vertical connected dual-rail timeline layout.
  - Severity filter pills (`All`, `Critical`, `Warning`, `Info`).
  - Expandable JSON audit records for deep payload inspection.

---

### View 11: State Transition History (`HistoryView.tsx`)
- **What it represents**: Immutable log of health state changes across the infrastructure lifecycle.
- **Features**:
  - Visual multi-color health state distribution bar.
  - Directional state transition flow badges (`[Good] → [Fair] → [Poor]`).
  - Search filtering by entity name, service type, and crossed rule thresholds.

---

## 2. Key Technical Concepts Explained Simply

| Concept | Simple Explanation | Implementation in Velocity Cicada |
| :--- | :--- | :--- |
| **P95 Latency** | 95% of all requests complete faster than this duration. A better measure than average because it captures rare delays. | Tracked in `saas/ingest/routes.py` and displayed on Reliability page. |
| **HMAC** | Hash-based Message Authentication Code. Guarantees that data was not tampered with in transit and comes from a trusted sender. | `transport/signing.py` generates `X-Signature` using a pre-shared secret. |
| **Idempotency** | Performing an operation multiple times produces the exact same result as performing it once. | `received_payloads` uses `payload_id` as PRIMARY KEY to discard duplicate transmissions. |
| **Pseudonymization** | Replacing identifiable names with stable random-looking tokens that can only be reversed with a secret key. | Hostnames are hashed with `SITE_SALT` via `collector/pseudo.py`. |
| **Z-Score** | A statistical measure of how many standard deviations a value is from the historical average. | $Z = (x - \mu)/\sigma$, computed in `saas/aiops/detect.py`. |
| **RLS (Row Level Security)** | PostgreSQL database security where the database engine itself prevents one customer from querying another's data. | Defined in `contracts/supabase/001_init.sql` via `my_tenants()` helper. |
| **Outbox Pattern** | Storing outgoing network messages in a local database before sending them over the wire to prevent data loss during network crashes. | Implemented in `transport/db.py` using local SQLite outbox queue. |
| **Sequence Gap** | A missing packet number (e.g., received seq 1, 2, 4) indicating network packet loss. | Tracked in `saas/ingest/routes.py` to identify missing telemetry windows. |
| **Baseline** | The normal expected behavior of a system computed over time. | 15-minute sliding Welford baseline in `saas/aiops/baseline.py`. |
