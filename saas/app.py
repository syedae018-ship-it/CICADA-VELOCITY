"""Tier 2 SaaS: one FastAPI app on port 8000. Shared file, changes by team agreement.

Run from repo root:  uvicorn saas.app:app --port 8000 --reload
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from saas import config
from saas import aiops, ingest
from saas.aiops import router as aiops_router
from saas.ingest import router as ingest_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await ingest.startup()   # Person B: init region DBs, seed tenants, offline-detector task
    await aiops.startup()    # Person C: staleness timer, SSE broker
    yield


app = FastAPI(title="Velocity Cicada SaaS (Tier 2)", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.DASHBOARD_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ingest_router)
app.include_router(aiops_router)


@app.get("/api/v1/health")
def health() -> dict:
    from saas.db import get_store
    return {"status": "ok", "service": "saas", "storage": get_store().name,
            "regions": config.REGIONS,
            "time_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}


@app.get("/api/v1/config/thresholds")
def thresholds() -> dict:
    """The configurable health-state rules (contracts/health_thresholds.json), shown to operators."""
    from saas.aiops.thresholds import load_thresholds
    return load_thresholds()
