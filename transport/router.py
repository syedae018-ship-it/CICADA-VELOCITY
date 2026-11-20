"""Collector-side local endpoints owned by Person B, mounted on collector/app.py (port 8001).

Endpoints (contracts/api.md §C):
  * GET  /local/egress?limit=20
  * GET  /local/egress/{payload_id}
  * GET  /local/buffer
  * POST /local/saas-link
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from transport.db import get_buffer_stats, get_egress_by_id, get_egress_logs
from transport.sender import is_saas_link_enabled, set_saas_link

router = APIRouter(prefix="/local", tags=["transport"])


class SaasLinkRequest(BaseModel):
    enabled: bool


@router.get("/egress")
def get_egress(limit: int = Query(20, ge=1, le=100)):
    """Egress proof panel: returns recent payloads byte-for-byte with SHA-256 hashes."""
    return get_egress_logs(limit=limit)


@router.get("/egress/{payload_id}")
def get_single_egress(payload_id: str):
    """Retrieve one payload exactly as sent."""
    log_entry = get_egress_by_id(payload_id)
    if not log_entry:
        raise HTTPException(status_code=404, detail="Payload not found in egress log")
    return log_entry


@router.get("/buffer")
def get_buffer():
    """Buffer depth, oldest item timestamp, and pending items."""
    return get_buffer_stats()


@router.post("/saas-link")
def toggle_saas_link(req: SaasLinkRequest):
    """Demo control: toggles whether the collector communicates with SaaS."""
    new_state = set_saas_link(req.enabled)
    return {"enabled": new_state, "message": f"SaaS link {'enabled' if new_state else 'disabled'}"}


@router.get("/saas-link")
def get_saas_link_status():
    """Check current state of the simulated SaaS link."""
    return {"enabled": is_saas_link_enabled()}
