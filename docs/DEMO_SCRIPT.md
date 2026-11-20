# Demo Script (≈ 7 minutes)

**Before judges arrive:** `./scripts/dev.sh --prod`, wait 2 minutes (baselines learn), open
http://localhost:3000. The status pill in the top bar must say **Live · Supabase**.

| # | Say | Do | Judges see |
|---|---|---|---|
| 0 | "Raw logs carry passwords, tokens, users and IPs. We keep them in the customer's network and send only metadata." | Overview | Live sources, collectors online, health states with reasons |
| 1 | "Here's a raw log with secrets…" | Inject **Secret in a raw log** → auto-opens Privacy | Left: raw line with password/JWT highlighted (Tier 1). Right: what SaaS stored: metrics + event summary only |
| 2 | "…and this is exactly what left the site." | **Egress Proof** → click newest payload | Exact JSON, sha256, seq, delivered (202). No secrets, hashed source IDs |
| 3 | "CPU deviates from its own baseline, not a fixed limit." | Inject **CPU deviates from baseline** | Incident with σ above the 15-min baseline, contributing signals |
| 4 | "Several signals, one incident." | Inject **Several alerts, one incident** | One incident, "N suppressed", likely cause = earliest signal |
| 5 | "Why this action?" | **AI Insights** → open the recommendation | Reasoning path, confidence, risk, rollback plan |
| 6 | "Remediation is human-approved and reversible." | **Approve** then **Rollback** | Policy check, audit entries, status changes |
| 7 | "Failed logins are detected locally; usernames never leave." | Inject **Repeated failed logins** | Security incident; Privacy shows usernames redacted locally |
| 8 | "Now we cut the network." | Inject **Collector loses SaaS** → Fleet | Buffer grows; after 60 s collector → Poor; then replay → Reliability: 0 gaps, 0 duplicates |
| 9 | "Retries can't double-count, late data lands in order." | Inject **Duplicate delivery**, then **Out-of-order events** | Reliability: duplicates rejected +1; charts ordered by event time |
| 10 | "And tenants never see each other." | Switch tenant to **Globex** (or sign in as `globex@demo.test`) | Different collector (Frankfurt, `eu-west-1`), different data |
| 11 | "What's not production yet" | Limitations slide (`docs/FEATURE_MATRIX.md`) | Honest gaps |

## Answers judges will ask for
- **What leaves?** Only fields in `contracts/payload_schema.json` (`additionalProperties: false`), checked by the collector and again by the SaaS.
- **SaaS down?** Outbox in local SQLite, exponential backoff, replay oldest-first with the same `payload_id`.
- **Duplicates?** `payload_id` is a primary key; a re-send returns `duplicate` and is not stored or analysed twice.
- **Real anomaly vs spike?** Per-source 15-min baseline, z-score with noise floor, must persist, confidence rises when signals agree.
- **Scale?** Stateless ingest behind a load balancer → queue partitioned by tenant → AIOps workers → Postgres per region.
