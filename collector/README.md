# M1: Collector & Privacy (`collector/`)

**Owner:** _fill in_ · **Branch:** `feature/<name>` · **Tier 1** (customer side) · **Port 8001**

## Mission
Turn raw telemetry into **safe, allow-listed metadata**, and prove that raw data and secrets never leave.

## Inputs / outputs
- **In:** `RawRecord`s via `POST /local/raw` (format: `contracts/raw_input.md`). Until the organizer stream is known, use `demo/simulator.py`.
- **Out:** every 5 s, call `transport.submit(payload_dict)` with a dict matching `contracts/payload_schema.json`. Transport (M2) handles IDs, signing, sending, buffering. Until M2 is merged, just write payloads to a file or print them.

## Build checklist
- [ ] `adapters/`: convert incoming records to `RawRecord` (one adapter per input format)
- [ ] Redaction engine from `contracts/redaction_rules.json`; store `raw_json` + `redacted_json` in `raw_records`
- [ ] Pseudonymous `source_id = "src_" + HMAC_SHA256(SITE_SALT, host)[:12]`
- [ ] Allow-list filter: build payload fields **only** from the schema; count `fields_dropped`
- [ ] 5-s aggregation per source (latest + avg/max for metrics), `event_time_utc` = latest sample time
- [ ] Local detection: ≥ 5 auth failures / 60 s on a source → `failed_login_burst` event with a **templated** summary (no user/IP); full detail goes in `detections` (local)
- [ ] Local retention: purge `raw_records` older than `LOCAL_RETENTION_HOURS`
- [ ] Endpoints: `GET /local/status`, `POST /local/raw`, `GET /local/raw`, `GET /local/detections`
- [ ] Unit test: a record containing `password=`, a JWT, an email and an IP produces a payload that contains none of them

## Demo scenarios you own
#1 Secret in raw log · #3 Repeated failed logins

## Don't
- Put any field in the payload that isn't in the schema
- Copy log text into `summary`; summaries are templates only
