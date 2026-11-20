# Velocity Cicada — Hackathon Master Handbook
## Welcome to the CICADA 2026 Complete System & Testing Guide

> **"Secure, Privacy-Preserving Two-Tier AIOps Observability with Verifiable Cloud Egress"**

---

### What is this Handbook?

This handbook is your **single source of truth** for understanding, demonstrating, defending, and testing the entire Velocity Cicada project. Whether you are stepping up to present to hackathon judges, writing tests, or debugging services, this guide walks you through every layer of the codebase from the absolute basics to advanced architectural guarantees.

### How to Navigate this Handbook

| Chapter | Document | What You Will Learn |
| :--- | :--- | :--- |
| **00** | [00_START_HERE.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/00_START_HERE.md) | Overview, navigation, and quickstart cheat sheet |
| **01** | [01_SYSTEM_OVERVIEW.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/01_SYSTEM_OVERVIEW.md) | High-level problem statement, two-tier model, and core value proposition |
| **02** | [02_ARCHITECTURE.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/02_ARCHITECTURE.md) | Deep architectural dissection, component boundaries, and contracts |
| **03** | [03_DATA_FLOW.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/03_DATA_FLOW.md) | End-to-end 21-step journey of a single metric from server to dashboard |
| **04** | [04_PRIVACY_SECURITY.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/04_PRIVACY_SECURITY.md) | Local regex redaction, allowlist enforcement, salt pseudonymization & HMAC wire signing |
| **05** | [05_AIOPS_ENGINE.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/05_AIOPS_ENGINE.md) | 15-minute rolling baselines, Z-score math, multi-signal correlation & automated triage |
| **06** | [06_API_REFERENCE.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/06_API_REFERENCE.md) | Complete table of all endpoints across Collector (8001) and SaaS (8000) |
| **07** | [07_DATABASE_GUIDE.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/07_DATABASE_GUIDE.md) | Supabase schema, table definitions, foreign keys, RLS policies & ER diagram |
| **08** | [08_DASHBOARD_GUIDE.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/08_DASHBOARD_GUIDE.md) | Walkthrough of all 11 dashboard views, KPI calculations & data bindings |
| **09** | [09_MANUAL_TESTING.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/09_MANUAL_TESTING.md) | Beginner-friendly manual testing handbook with exact CLI commands and curl queries |
| **10** | [10_SCENARIO_TESTING.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/10_SCENARIO_TESTING.md) | Deep dive into all 9 live demo scenarios (Secret, Outage, Duplicate, CPU, etc.) |
| **11** | [11_FAILURE_RECOVERY.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/11_FAILURE_RECOVERY.md) | Reliability deep-dive: network partitions, outage buffering, replay, and idempotency |
| **12** | [12_HACKATHON_QA.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/12_HACKATHON_QA.md) | 40+ anticipated judge questions with spoken pitches and technical proofs |
| **13** | [13_DEMO_SCRIPT.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/13_DEMO_SCRIPT.md) | 5-minute timed live presentation script with exact click paths |
| **14** | [14_FEATURE_VERIFICATION.md](file:///Users/syedmustafaahmed/Documents/CODE/velocity%20cicada/docs/HACKATHON_HANDBOOK/14_FEATURE_VERIFICATION.md) | Verified feature inventory mapping every module to actual lines of code |

---

### Quickstart: Running the Entire Stack

To run the whole Velocity Cicada stack on your local machine, open **3 separate terminal windows**:

#### Terminal 1: Tier 2 Cloud SaaS (Port 8000)
```bash
cd "/Users/syedmustafaahmed/Documents/CODE/velocity cicada"
.venv/bin/python -m uvicorn saas.app:app --port 8000 --reload
```
*Health Check:* Open `http://localhost:8000/docs` in your browser.

#### Terminal 2: Tier 1 Customer Collector (Port 8001)
```bash
cd "/Users/syedmustafaahmed/Documents/CODE/velocity cicada"
.venv/bin/python -m uvicorn collector.app:app --port 8001 --reload
```
*Health Check:* Open `http://localhost:8001/docs` in your browser.

#### Terminal 3: Next.js Frontend Dashboard (Port 3000)
```bash
cd "/Users/syedmustafaahmed/Documents/CODE/velocity cicada/dashboard"
npm run dev
```
*Access UI:* Open `http://localhost:3000` in your browser.
