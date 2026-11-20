"""Tier 2 SaaS: one FastAPI app on port 8000. Shared file, changes by team agreement.

Run from repo root:  uvicorn saas.app:app --port 8000 --reload
"""
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from saas import config
from saas.aiops import router as aiops_router
from saas.ingest import router as ingest_router

app = FastAPI(title="Velocity Cicada SaaS (Tier 2)")
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
    return {"status": "ok", "service": "saas", "time_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
