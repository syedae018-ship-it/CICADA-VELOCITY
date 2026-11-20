# PROJECT.md: Velocity Cicada

> One document every team member reads first. It explains **what we are building, why, how it fits
> together, who builds what, and how we win the judging**.

---

## 1. The problem in one paragraph
Companies want to monitor servers, networks, apps and security events, but shipping **raw logs**
(which contain passwords, tokens, usernames and IPs) to a cloud monitoring service is a security and
compliance risk. We build a **two-tier** system: a **local collector** inside the customer's network
does all the sensitive processing and sends only **safe metadata** (numbers, timestamps, hashed IDs,
severities) to our **multi-tenant SaaS**, which runs AIOps (anomaly detection, correlation,
explainable recommendations) and shows it on a dashboard.

**The judges' key question:**
> "Can you show exactly what your local collector sends to SaaS, prove that sensitive and raw data
> stays within the customer environment, and demonstrate how AIOps turns metadata into an actionable
> recommendation?"

Everything we build exists to answer that question **live**.

---

## 2. Our solution at a glance

```
 TIER 1 · CUSTOMER SITE                                   TIER 2 · OUR SaaS
 ┌──────────────────────────────────────┐                 ┌──────────────────────────────────────┐
 │ telemetry → [A] Collector             │                 │ [B] Ingest: verify, dedupe, store    │
 │   collect · REDACT · allow-list       │   HTTPS + HMAC  │      by event time, per tenant/region │
 │   aggregate · local security detect   │ ──────────────▶ │ [C] AIOps: baselines, anomalies,     │
 │ [B] Transport                         │  metadata ONLY  │      health states, incidents, recs  │
 │   payload_id · outbox · retry ·       │                 │ [D] Dashboard: fleet, health,        │
 │   egress proof log · heartbeat        │                 │      incidents, egress proof, demo   │
 └──────────────────────────────────────┘                 └──────────────────────────────────────┘
          raw data NEVER crosses this line ──────┘
```

Full diagram: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Priorities & scenarios: [`PLAN.md`](PLAN.md)

---

## 3. Team & ownership

| Person | Module | Owns (only they edit) | Build guide |
|---|---|---|---|
| **Person A** | Collector & Privacy | `collector/` | [`members/PERSON_A_collector.md`](members/PERSON_A_collector.md) |
| **Person B** | Transport, Reliability & Ingest | `transport/`, `saas/ingest/`, `saas/db.py` | [`members/PERSON_B_transport_ingest.md`](members/PERSON_B_transport_ingest.md) |
| **Person C** | AIOps Engine | `saas/aiops/` | [`members/PERSON_C_aiops.md`](members/PERSON_C_aiops.md) |
| **Person D** | Dashboard, Demo & Docs (+ integrator) | `dashboard/`, `demo/`, `docs/` | [`members/PERSON_D_dashboard_demo.md`](members/PERSON_D_dashboard_demo.md) |
| **All** | Shared agreements | `contracts/`, `saas/app.py`, `scripts/`, root files | [`MERGE_GUIDE.md`](MERGE_GUIDE.md) |

Write real names here once decided: A = ______ · B = ______ · C = ______ · D = ______

---

## 4. How the pieces connect (the 5 seams)

These seams are the **only** places modules touch. They are already wired in code, so nobody needs to
edit another person's file.

| # | Seam | From → To | Contract | Already wired in |
|---|---|---|---|---|
| S1 | Raw telemetry in | simulator (D) → collector (A) | `contracts/raw_input.md` | `POST /local/raw` |
| S2 | Payload handoff | collector (A) → transport (B) | `transport.submit(payload_dict)` + `payload_schema.json` | `transport/__init__.py` (stub writes to file) |
| S3 | Over the wire | transport (B) → ingest (B) | `contracts/api.md` §A + HMAC | `transport/signing.py` |
| S4 | Analysis hook | ingest (B) → aiops (C) | `on_ingest(tenant_id, payload)` | `saas/aiops/engine.py` |
| S5 | Read API | SaaS (B + C) → dashboard (D) | `contracts/api.md` §B + `aiops_output.md` | routers in `saas/app.py` |

---

## 5. Build phases (whole team)

| Phase | Hours | Team goal | Judging |
|---|---|---|---|
| **P0 Setup** | 0 – 0.5 | Branch reset to `main`, env runs, everyone read their guide | |
| **P1 Ideation** | 0.5 – 2 | Use cases, allow-list, trust-boundary sketch, feature priority, roles (D presents) | Phase 1: **10** |
| **P2 Solo build** | 2 – 8 | Each module's core working **against mocks**. Architecture diagram ready. | Phase 2: **25** |
| **P3 Integration #1** | ≈ 8 | Simulator → collector → payload → SaaS → dashboard, end to end | |
| **P4 Prototype** | 8 – 16 | All P0 features: redaction proof, buffering, egress panel, 4 health states, anomalies | Phase 3: **35** |
| **P5 Intelligence** | 16 – 20 | Correlation, explainable recommendations, reliability numbers, remediation sim | |
| **P6 Freeze & demo** | 20 – 24 | Bug fixes only, rehearse 8 scenarios, slides, limitations | Phase 4: **30** |

Each person's guide breaks these phases into their own tasks with a **Definition of Done**.

---

## 6. The demo story (≈ 7 minutes, owned by D)
1. **Problem** (30 s): raw logs leak secrets; we keep them local.
2. **Normal state:** dashboard all Excellent; fleet shows 1 collector online per tenant.
3. **Secret in a log:** collector raw view shows `password=hunter2`; egress panel shows the payload without it; SaaS has only metadata. *(Scenario 1)*
4. **CPU spike:** source goes Fair/Poor with a reason; alert explains the z-score and baseline. *(5)*
5. **Latency + CPU together:** merged into one incident with a likely cause and a recommendation with its reasoning path → Approve → audit → Rollback. *(4, 6, 8)*
6. **Failed logins:** security summary only, with no usernames or IPs in SaaS. *(3)*
7. **Pull the plug:** SaaS outage → buffer grows → reconnect → sent IDs = received IDs, 0 duplicates. *(2, 7)*
8. **Tenant switch:** Globex cannot see Acme. **Limitations** slide, then Q&A.

---

## 7. What wins marks (and what loses them)
| ✅ Do | ❌ Avoid |
|---|---|
| Show everything **live** from the stream | Hard-coded dashboard data |
| Explain *why* for every alert and recommendation | Unexplained "AI says restart" text |
| Measure latency from timestamps | Claiming numbers |
| State limitations honestly | Over-scoping and finishing nothing |
| Keep `main` always demo-able | Merging everything at hour 22 |
