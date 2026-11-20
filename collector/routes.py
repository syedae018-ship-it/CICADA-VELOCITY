from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import Dict, Any, List
from datetime import datetime, timezone
import asyncio
import time

from collector.config import settings
from collector.adapters.simulator import adapt_to_raw_record
from collector.redact import redact_obj_with_details
from collector.store import (
    store_raw_record, get_raw_records, get_detections,
    get_egress_records, get_egress_by_id, purge_old_records
)
from collector.aggregate import build_payload, get_collector_health
from collector.transport_stub import submit

router = APIRouter()

# In-memory buffer of sanitized window records for the 5-second aggregation flush
_current_window_records: List[Dict[str, Any]] = []
_records_in_count = 0
_secrets_redacted_count = 0
_ai_catches_count = 0
_window_start_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
_lock = asyncio.Lock()

_saas_link_enabled = True

@router.get("/local/status")
async def get_status():
    async with _lock:
        depth = len(_current_window_records)
        ai_catches = _ai_catches_count
    health = get_collector_health(buffer_depth=depth)
    return {
        "collector_id": settings.COLLECTOR_ID,
        "tenant_id": settings.TENANT_ID,
        "region": settings.REGION,
        "version": settings.VERSION,
        "saas_reachable": _saas_link_enabled,
        "buffer_depth": depth,
        "last_sent_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "uptime_s": health["uptime_s"],
        "ai_redaction": {
            "enabled": True,
            "engine": "local_nlp_entropy_ner",
            "tier": "Tier 1 (Customer-side only)"
        }
    }

@router.post("/local/raw")
async def ingest_raw(record: Dict[str, Any]):
    global _records_in_count, _secrets_redacted_count, _ai_catches_count
    
    # 1. Normalize with adapter
    canonical = adapt_to_raw_record(record)
    
    # 2. Redact sensitive values with Regex (Tier 1) and Local AI (Tier 2)
    redacted, regex_c, ai_c = redact_obj_with_details(canonical)
    total_c = regex_c + ai_c
    
    now_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # 3. Store both raw and redacted in local SQLite store, including catch breakdown
    store_raw_record(
        received_utc=now_utc,
        kind=canonical.get("kind", "unknown"),
        host=canonical.get("host", "unknown"),
        sid=canonical.get("source_id", "unknown"),
        raw_obj=canonical,
        redacted_obj=redacted,
        regex_catches=regex_c,
        ai_catches=ai_c
    )
    
    # 4. Buffer for next 5s aggregation window
    async with _lock:
        _records_in_count += 1
        _secrets_redacted_count += total_c
        _ai_catches_count += ai_c
        _current_window_records.append(redacted)
        
    return {
        "status": "accepted",
        "source_id": canonical.get("source_id"),
        "secrets_redacted": total_c,
        "regex_catches": regex_c,
        "ai_catches": ai_c
    }

@router.get("/local/raw")
async def list_raw(limit: int = Query(50, ge=1, le=500)):
    return get_raw_records(limit=limit)

@router.get("/local/detections")
async def list_detections(limit: int = Query(50, ge=1, le=500)):
    return get_detections(limit=limit)

@router.get("/local/egress")
async def list_egress(limit: int = Query(20, ge=1, le=100)):
    return get_egress_records(limit=limit)

@router.get("/local/egress/{payload_id}")
async def get_egress_payload(payload_id: str):
    rec = get_egress_by_id(payload_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Payload not found in egress log")
    return rec

@router.get("/local/buffer")
async def get_buffer():
    async with _lock:
        depth = len(_current_window_records)
    return {
        "depth": depth,
        "oldest_utc": _window_start_utc,
        "items": []
    }

@router.post("/local/saas-link")
async def set_saas_link(payload: Dict[str, Any]):
    global _saas_link_enabled
    _saas_link_enabled = bool(payload.get("enabled", True))
    return {"saas_reachable": _saas_link_enabled}

async def flush_aggregation_window():
    global _current_window_records, _records_in_count, _secrets_redacted_count, _window_start_utc
    async with _lock:
        if not _current_window_records:
            _window_start_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            return
        
        records_to_flush = list(_current_window_records)
        in_count = _records_in_count
        redacted_count = _secrets_redacted_count
        start_utc = _window_start_utc
        end_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        # Reset window buffer
        _current_window_records = []
        _records_in_count = 0
        _secrets_redacted_count = 0
        _window_start_utc = end_utc

    # Build allow-listed metadata payload
    payload = build_payload(
        window_records=records_to_flush,
        start_utc=start_utc,
        end_utc=end_utc,
        secrets_redacted_count=redacted_count,
        records_in_count=in_count,
        buffer_depth=0
    )
    
    # Submit to transport
    submit(payload)

async def aggregation_loop():
    while True:
        try:
            await asyncio.sleep(5)
            await flush_aggregation_window()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Aggregation Loop Error] {e}")

async def retention_cleanup_loop():
    while True:
        try:
            await asyncio.sleep(60)
            purge_old_records(retention_hours=settings.LOCAL_RETENTION_HOURS)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Retention Cleanup Error] {e}")
