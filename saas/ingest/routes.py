"""Owner: Person B. Ingest and reliability API (contracts/api.md §A and §B).

  * POST /api/v1/ingest       HMAC → schema → registry → dedupe → store (by event time) → AIOps hook
  * POST /api/v1/heartbeat    HMAC → schema → registry → last_seen / online
  * GET  /api/v1/collectors   tenant-scoped (dashboard may also read Supabase directly)
  * GET  /api/v1/metrics      tenant-scoped, ordered by EVENT time
  * GET  /api/v1/reliability  received, duplicates, seq gaps, p95 latency, alert latency

All storage goes through saas.db.get_store() (Supabase when configured, SQLite otherwise).
Blocking storage calls run in a worker thread so the event loop stays responsive.
"""
import asyncio
import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from jsonschema import Draft202012Validator

from saas.aiops import on_ingest
from saas.db import DuplicatePayload, get_store, now_utc, parse_utc
from saas.ingest.auth import get_tenant, verify_collector_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["ingest"])

CONTRACTS_DIR = Path(__file__).resolve().parent.parent.parent / "contracts"
payload_validator = Draft202012Validator(json.loads((CONTRACTS_DIR / "payload_schema.json").read_text()))
heartbeat_validator = Draft202012Validator(json.loads((CONTRACTS_DIR / "heartbeat_schema.json").read_text()))

OFFLINE_AFTER_S = 60
HTTP_422 = 422

_duplicates_count: dict[str, int] = {}   # tenant_id -> duplicates rejected since SaaS start
_bg_task: Optional[asyncio.Task] = None


def _reject(errors: list[str]) -> HTTPException:
    return HTTPException(status_code=HTTP_422, detail={"status": "rejected", "errors": errors})


def _authenticate(collector_id: Optional[str], raw_body: bytes, ts: Optional[str], sig: Optional[str]) -> dict:
    ok, err, info = verify_collector_auth(collector_id or "", raw_body, ts or "", sig or "")
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=err)
    return info


def _parse(raw_body: bytes, validator: Draft202012Validator) -> dict:
    try:
        doc = json.loads(raw_body.decode("utf-8"))
    except Exception as exc:
        raise _reject([f"Malformed JSON: {exc}"])
    errors = [f"{list(e.path)}: {e.message}" for e in validator.iter_errors(doc)]
    if errors:
        raise _reject(errors)
    return doc


def _mark_seen(tenant_id: str, collector_id: str, fields: dict) -> None:
    """Update collector liveness; record an 'online' transition in health history + audit."""
    store = get_store()
    prev = store.get_collector(tenant_id, collector_id) or {}
    now = fields["last_seen_utc"]
    came_back = prev.get("status") == "offline"
    update = {"status": "online", **fields}
    if came_back:
        update["state"] = "good"
    store.update_collector(tenant_id, collector_id, update)
    if came_back:
        reason = "collector reconnected" if prev.get("last_seen_utc") else "collector first seen"
        store.insert_health(tenant_id, {"entity_type": "collector", "entity_id": collector_id,
                                        "prev_state": prev.get("state"), "state": "good",
                                        "reason": reason, "at_utc": now})
        store.insert_audit(tenant_id, {"actor": "system", "action": "collector_online", "target": collector_id,
                                       "details": {"reason": reason}, "at_utc": now})


def _store_payload(tenant_id: str, collector_id: str, payload: dict, body_sha256: str) -> bool:
    """Persist one payload. Returns False if it was a duplicate. Rolls back the idempotency
    record on partial failure so the collector's retry is processed instead of being treated as a duplicate."""
    store = get_store()
    received = now_utc()
    payload_id = payload["payload_id"]
    try:
        store.record_payload({"payload_id": payload_id, "tenant_id": tenant_id, "collector_id": collector_id,
                              "seq": payload["seq"], "sent_at_utc": payload["sent_at_utc"],
                              "received_at_utc": received, "body_sha256": body_sha256})
    except DuplicatePayload:
        return False

    try:
        metrics = [
            {"tenant_id": tenant_id, "collector_id": collector_id, "source_id": src["source_id"],
             "service": src.get("service"), "source_type": src.get("source_type"), "metric": name,
             "value": float(val), "event_time_utc": src["event_time_utc"],   # stored by EVENT time
             "received_at_utc": received, "payload_id": payload_id}
            for src in payload["sources"]
            for name, val in src.get("metrics", {}).items()
            if isinstance(val, (int, float))                                  # booleans become 1.0 / 0.0
        ]
        events = [
            {"event_id": ev["event_id"], "tenant_id": tenant_id, "collector_id": collector_id,
             "source_id": ev["source_id"], "category": ev["category"], "severity": ev["severity"],
             "type": ev["type"], "count": ev["count"], "summary": ev["summary"],
             "event_time_utc": ev["event_time_utc"], "received_at_utc": received, "payload_id": payload_id}
            for ev in payload["events"]
        ]
        store.insert_metrics(tenant_id, metrics)
        store.insert_events(tenant_id, events)
        ch = payload["collector_health"]
        _mark_seen(tenant_id, collector_id, {"last_seen_utc": received, "buffer_depth": ch["buffer_depth"],
                                             "version": ch["version"], "cpu_pct": ch["cpu_pct"],
                                             "mem_pct": ch["mem_pct"], "config_hash": ch["config_hash"]})
    except Exception:
        logger.exception("Storing payload %s failed; rolling back idempotency record", payload_id)
        try:
            store.delete_payload(tenant_id, payload_id)
        except Exception:
            logger.exception("Rollback of payload %s failed", payload_id)
        raise
    return True


@router.post("/ingest", status_code=status.HTTP_202_ACCEPTED)
async def ingest_payload(
    request: Request,
    x_collector_id: Optional[str] = Header(None, alias="X-Collector-Id"),
    x_timestamp: Optional[str] = Header(None, alias="X-Timestamp"),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
):
    raw_body = await request.body()                                   # exact bytes for HMAC + hash
    collector = _authenticate(x_collector_id, raw_body, x_timestamp, x_signature)
    payload = _parse(raw_body, payload_validator)                     # allow-list enforced again in SaaS

    tenant_id = collector["tenant_id"]                                # tenant from registry, never trusted from body
    if payload["collector_id"] != x_collector_id or payload["tenant_id"] != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Collector or tenant mismatch with registry")
    if payload["region"] != collector["region"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Collector sent to the wrong regional endpoint")

    body_sha256 = hashlib.sha256(raw_body).hexdigest()
    accepted = None
    for attempt in (1, 2):   # pooled connections can be reset by the storage server; the failed attempt is fully rolled back
        try:
            accepted = await run_in_threadpool(_store_payload, tenant_id, x_collector_id, payload, body_sha256)
            break
        except Exception:
            if attempt == 2:
                # 503 → the collector keeps the payload in its outbox and retries with the same payload_id
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Storage unavailable, retry")
            logger.warning("Storing payload %s failed (attempt 1), retrying once", payload["payload_id"])

    if not accepted:
        _duplicates_count[tenant_id] = _duplicates_count.get(tenant_id, 0) + 1
        return Response(content=json.dumps({"status": "duplicate", "payload_id": payload["payload_id"]}),
                        status_code=status.HTTP_200_OK, media_type="application/json")

    try:
        await run_in_threadpool(on_ingest, tenant_id, payload)        # AIOps bugs must never drop stored data
    except Exception:
        logger.exception("AIOps hook on_ingest failed")
    return {"status": "accepted", "payload_id": payload["payload_id"]}


@router.post("/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
async def heartbeat(
    request: Request,
    x_collector_id: Optional[str] = Header(None, alias="X-Collector-Id"),
    x_timestamp: Optional[str] = Header(None, alias="X-Timestamp"),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
):
    raw_body = await request.body()
    collector = _authenticate(x_collector_id, raw_body, x_timestamp, x_signature)
    hb = _parse(raw_body, heartbeat_validator)
    if hb["collector_id"] != x_collector_id or hb["tenant_id"] != collector["tenant_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registry mismatch")
    try:
        await run_in_threadpool(_mark_seen, collector["tenant_id"], x_collector_id,
                                {"last_seen_utc": now_utc(), "buffer_depth": hb["buffer_depth"],
                                 "version": hb["version"], "config_hash": hb["config_hash"]})
    except Exception:
        logger.exception("Heartbeat storage failed")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Storage unavailable")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/collectors")
def get_collectors(tenant_id: str = Depends(get_tenant)):
    return get_store().list_collectors(tenant_id)


@router.get("/metrics")
def get_metrics(
    source_id: Optional[str] = None,
    metric: Optional[str] = None,
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    tenant_id: str = Depends(get_tenant),
):
    return get_store().query_metrics(tenant_id, source_id, metric, from_time, to_time)


def _seconds_between(later: str, earlier: str) -> Optional[float]:
    try:
        return max(0.0, (parse_utc(later) - parse_utc(earlier)).total_seconds())
    except Exception:
        return None


@router.get("/reliability")
def get_reliability(tenant_id: str = Depends(get_tenant)):
    store = get_store()

    seq_gaps: dict[str, list[int]] = {}
    for c in store.list_collectors(tenant_id):
        seqs = store.received_seqs(tenant_id, c["collector_id"])
        seq_gaps[c["collector_id"]] = [m for a, b in zip(seqs, seqs[1:]) for m in range(a + 1, b)][:1000]

    latencies = sorted(x for r in store.recent_metric_times(tenant_id)
                       if (x := _seconds_between(r["received_at_utc"], r["event_time_utc"])) is not None)
    p95 = round(latencies[min(int(len(latencies) * 0.95), len(latencies) - 1)], 3) if latencies else None

    last_alert = store.last_alert_times(tenant_id)
    alert_latency = _seconds_between(last_alert["created_at_utc"], last_alert["event_time_utc"]) if last_alert else None

    return {
        "received_count": store.received_count(tenant_id),
        "duplicates_rejected": _duplicates_count.get(tenant_id, 0),
        "seq_gaps": seq_gaps,
        "latency_p95_s": p95,
        "alert_latency_s_last": round(alert_latency, 3) if alert_latency is not None else None,
        "sample_size": len(latencies),
    }


def check_offline_collectors(now: Optional[datetime] = None) -> list[str]:
    """Mark collectors with no heartbeat/payload for > 60 s as offline + Poor. Returns the ids marked."""
    store = get_store()
    now = now or datetime.now(timezone.utc)
    now_iso = now.isoformat().replace("+00:00", "Z")
    marked = []
    for c in store.online_collectors():
        if not c.get("last_seen_utc"):
            continue
        silent_s = (now - parse_utc(c["last_seen_utc"])).total_seconds()
        if silent_s <= OFFLINE_AFTER_S:
            continue
        tid, cid = c["tenant_id"], c["collector_id"]
        reason = f"no heartbeat for {int(silent_s)}s"
        store.update_collector(tid, cid, {"status": "offline", "state": "poor"})
        store.insert_health(tid, {"entity_type": "collector", "entity_id": cid, "prev_state": c.get("state"),
                                  "state": "poor", "reason": reason, "at_utc": now_iso})
        store.insert_audit(tid, {"actor": "system", "action": "collector_offline", "target": cid,
                                 "details": {"reason": reason, "last_seen_utc": c["last_seen_utc"]}, "at_utc": now_iso})
        marked.append(cid)
    return marked


async def _offline_detector_loop() -> None:
    while True:
        try:
            await asyncio.sleep(5)
            await asyncio.to_thread(check_offline_collectors)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Offline detector iteration failed")


async def startup() -> None:
    """Called by saas/app.py: initialise the storage backend and start the offline detector."""
    global _bg_task
    store = get_store()
    await asyncio.to_thread(store.init)
    logger.info("SaaS storage backend: %s", store.name)
    if _bg_task is None or _bg_task.done():
        _bg_task = asyncio.create_task(_offline_detector_loop())
