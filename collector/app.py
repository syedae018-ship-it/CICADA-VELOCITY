"""Tier 1 collector: local API on port 8001. Owner: Person A (docs/members/PERSON_A_collector.md).

Run from repo root:  uvicorn collector.app:app --port 8001 --reload
"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI

import transport
from collector import config
from collector import routes as collector_routes
from collector.routes import router as collector_router   # Person A's endpoints
from transport.router import router as transport_router   # Person B's endpoints (pre-wired)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await collector_routes.startup()   # Person A: aggregation / retention background tasks
    await transport.startup()          # Person B: sender loop + heartbeat
    yield


app = FastAPI(title="Velocity Cicada Collector (Tier 1)", lifespan=lifespan)
app.include_router(collector_router)
app.include_router(transport_router)
STARTED = time.time()


@app.get("/local/status")
def status() -> dict:
    return {
        "collector_id": config.COLLECTOR_ID,
        "tenant_id": config.TENANT_ID,
        "region": config.REGION,
        "version": config.VERSION,
        "saas_reachable": None,   # TODO(Person B): from sender loop
        "buffer_depth": 0,        # TODO(Person B): from outbox
        "last_sent_utc": None,
        "uptime_s": int(time.time() - STARTED),
    }
