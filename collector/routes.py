from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import Dict, Any, List
from datetime import datetime, timezone
import asyncio
import time

from collector.config import settings
from collector.adapters.simulator import adapt_to_raw_record
from collector.redact import redact_obj
from collector.store import init_db
from collector.store import (
    store_raw_record, get_raw_records, get_detections, purge_old_records
)
from collector.aggregate import build_payload, get_collector_health
import transport

# Person A's endpoints. /local/status is in collector/app.py; /local/egress, /local/buffer and
# /local/saas-link belong to transport (Person B, transport/router.py).
router = APIRouter()

# In-memory buffer of sanitized window records for the 5-second aggregation flush
_current_window_records: List[Dict[str, Any]] = []
_records_in_count = 0
_secrets_redacted_count = 0
_window_start_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
_lock = asyncio.Lock()

@router.post("/local/raw")
async def ingest_raw(record: Dict[str, Any]):
    global _records_in_count, _secrets_redacted_count
    
    # 1. Normalize with adapter
    canonical = adapt_to_raw_record(record)
    
    # 2. Redact sensitive values
    redacted, count = redact_obj(canonical)
    
    now_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # 3. Store both raw and redacted in local SQLite store
    store_raw_record(
        received_utc=now_utc,
        kind=canonical.get("kind", "unknown"),
        host=canonical.get("host", "unknown"),
        sid=canonical.get("source_id", "unknown"),
        raw_obj=canonical,
        redacted_obj=redacted
    )
    
    # 4. Buffer for next 5s aggregation window
    async with _lock:
        _records_in_count += 1
        _secrets_redacted_count += count
        _current_window_records.append(redacted)
        
    return {"status": "accepted", "source_id": canonical.get("source_id"), "secrets_redacted": count}

@router.get("/local/raw")
async def list_raw(limit: int = Query(50, ge=1, le=500)):
    return get_raw_records(limit=limit)

@router.get("/local/detections")
async def list_detections(limit: int = Query(50, ge=1, le=500)):
    return get_detections(limit=limit)

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
        buffer_depth=transport.get_buffer_depth() if hasattr(transport, "get_buffer_depth") else 0
    )

    # Hand over to transport: it assigns the persistent seq, validates, buffers and sends
    transport.submit(payload)

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


_tasks: List[asyncio.Task] = []


async def startup() -> None:
    """Called once by collector/app.py on boot: local DB + 5-s aggregation + retention purge."""
    init_db()
    if not _tasks:
        _tasks.append(asyncio.create_task(aggregation_loop()))
        _tasks.append(asyncio.create_task(retention_cleanup_loop()))
