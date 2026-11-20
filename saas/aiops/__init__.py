"""AIOps engine + read API. Owner: M3 (see saas/aiops/README.md)."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["aiops"])


def on_ingest(tenant_id: str, payload: dict) -> None:
    """Called by ingest (M2) for every accepted payload. TODO(M3): baselines, anomalies, health, correlation."""
    return None

# TODO(M3): /overview, /alerts, /incidents, /incidents/{id}, /health-history, /audit,
#           /recommendations/{id}/approve|rollback, /stream (SSE)
