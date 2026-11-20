"""Tier 1 collector: local API on port 8001. Owner: M1 (see collector/README.md).

Run from repo root:  uvicorn collector.app:app --port 8001 --reload
"""
import time

from fastapi import FastAPI

from collector import config

app = FastAPI(title="Velocity Cicada Collector (Tier 1)")
STARTED = time.time()


@app.get("/local/status")
def status() -> dict:
    return {
        "collector_id": config.COLLECTOR_ID,
        "tenant_id": config.TENANT_ID,
        "region": config.REGION,
        "version": config.VERSION,
        "saas_reachable": None,   # TODO(M2): set from sender loop
        "buffer_depth": 0,        # TODO(M2): from outbox
        "last_sent_utc": None,
        "uptime_s": int(time.time() - STARTED),
    }


# TODO(M1): POST /local/raw, GET /local/raw, GET /local/detections
# TODO(M2): app.include_router(transport.router)  ->  /local/egress, /local/buffer, /local/saas-link
