"""Tier 1 collector: local API on port 8001. Owner: Person A (docs/members/PERSON_A_collector.md).

Run from repo root:  uvicorn collector.app:app --port 8001 --reload
"""
import time
from contextlib import asynccontextmanager

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import transport
from collector import config
from collector import demo_driver
from collector import routes as collector_routes
from collector.routes import router as collector_router   # Person A's endpoints
from transport.router import router as transport_router   # Person B's endpoints (pre-wired)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await collector_routes.startup()   # Person A: aggregation / retention background tasks
    await transport.startup()          # Person B: sender loop + heartbeat
    await demo_driver.startup()        # live demo controls (DEMO_CONTROLS=1)
    if os.getenv("ENABLE_HOST_SAMPLER", "1") == "1":
        from collector.host_collector import start_host_sampler
        start_host_sampler()
    yield


app = FastAPI(title="Velocity Cicada Collector (Tier 1)", lifespan=lifespan)
# Only the local dashboard may read this customer-side API from a browser (raw view, egress proof panel).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("DASHBOARD_ORIGIN", "http://localhost:3000")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.include_router(collector_router)
app.include_router(transport_router)
app.include_router(demo_driver.router)
STARTED = time.time()


@app.get("/local/status")
def status() -> dict:
    from collector.host_collector import is_collector_paused
    return {
        "collector_id": config.COLLECTOR_ID,
        "tenant_id": config.TENANT_ID,
        "region": config.REGION,
        "version": config.VERSION,
        "saas_reachable": transport.get_saas_reachable(),
        "saas_link_enabled": transport.is_saas_link_enabled(),
        "buffer_depth": transport.get_buffer_depth(),
        "last_sent_utc": transport.get_last_sent_utc(),
        "uptime_s": int(time.time() - STARTED),
        "transmission_interval_s": config.TRANSMISSION_INTERVAL_SECONDS,
        "collection_interval_s": config.COLLECTION_INTERVAL_SECONDS,
        "collection_paused": is_collector_paused(),
    }


@app.post("/local/pause")
def pause_collection():
    from collector.host_collector import set_collector_paused
    set_collector_paused(True)
    return {"status": "paused", "collection_paused": True}


@app.post("/local/resume")
def resume_collection():
    from collector.host_collector import set_collector_paused
    set_collector_paused(False)
    return {"status": "resumed", "collection_paused": False}


@app.post("/local/flush")
async def trigger_flush():
    from collector.routes import flush_aggregation_window
    await flush_aggregation_window()
    return {"status": "flushed"}
