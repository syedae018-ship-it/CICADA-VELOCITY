# /contracts: Shared Agreements (owned by ALL FOUR)

This folder is what lets four people build in parallel. Everyone codes **against these files**,
not against each other's code.

| File | What it defines | Main producers → consumers |
|---|---|---|
| `payload_schema.json` | The ONLY data that leaves the collector | Collector → Transport → SaaS ingest |
| `heartbeat_schema.json` | Collector liveness ping (every 10 s) | Transport → SaaS ingest |
| `allowlist.md` | Sent vs redacted vs local-only, plus who sees what | Everyone (and Phase 1 slides) |
| `redaction_rules.json` | Secret-scrubbing regexes | Collector |
| `raw_input.md` | Internal raw record format (Tier 1 only) | Simulator/adapter → Collector |
| `api.md` | All HTTP endpoints, auth, status codes | Everyone |
| `db_tables.md` | SaaS (Supabase) + collector (SQLite) tables | Transport/Ingest, AIOps, Dashboard |
| `supabase/001_init.sql` | Supabase schema, RLS, Realtime, seed | Person B runs it; C and D build on it |
| `health_thresholds.json` | Excellent / Good / Fair / Poor rules | AIOps → Dashboard |
| `aiops_output.md` | Alert / Incident / Recommendation JSON | AIOps → Dashboard |
| `sample_payloads/` | Ready-made mock data | Everyone, for building before integration |
| `validate.py` | Checks the samples match the schema | Run before every contracts change |

## Rules for changing contracts
1. **Never change a contract only on your feature branch.** Tell the team first.
2. Agree in the group chat, then one person makes the change on a small branch `contracts/<what>` → PR → `main`.
3. Run `python contracts/validate.py` and confirm it passes.
4. Everyone runs `git pull origin main` and merges `main` into their branch.
5. **Adding** an optional field is cheap. **Renaming or removing** a field breaks someone, so avoid it.
