# demo/: Simulator & Live Scenarios (owned by M4)

`simulator.py` produces `RawRecord`s (see `contracts/raw_input.md`) until the organizer stream is available.

```bash
python demo/simulator.py --stdout                       # print records, no collector needed
python demo/simulator.py                                 # POST to http://localhost:8001/local/raw
python demo/simulator.py --scenario secret               # inject a log line containing secrets
python demo/simulator.py --scenario cpu                  # CPU climbs far above baseline
python demo/simulator.py --scenario latency              # network latency + packet loss rise
python demo/simulator.py --scenario logins               # burst of failed logins
python demo/simulator.py --scenario incident             # cpu + latency + service warnings together
```

Outage and duplicate scenarios are driven from the collector/SaaS side (see `docs/PLAN.md`):
- **Outage:** stop the SaaS process (or `POST /local/saas-link {"enabled":false}`), wait, restart.
- **Duplicate / out-of-order:** `scenarios/replay.sh` re-sends `contracts/sample_payloads/04_out_of_order_late.json` and a duplicate `payload_id` (needs signing; M2 provides a helper).

Put one script per scenario in `demo/scenarios/`.
