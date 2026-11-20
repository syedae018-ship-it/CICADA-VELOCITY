"""Owner: Person B. Ingest and Reliability API routes.

Endpoints:
  * POST /api/v1/ingest
  * POST /api/v1/heartbeat
  * GET  /api/v1/collectors
  * GET  /api/v1/metrics
  * GET  /api/v1/reliability
"""
import asyncio
import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response, status
from jsonschema import Draft202012Validator

from saas import config
from saas.aiops import on_ingest
from saas.db import connect, db_for_tenant, init_schema, tenant_query
from saas.ingest.auth import get_tenant_from_auth, verify_collector_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["ingest"])

# Load JSON schemas
CONTRACTS_DIR = Path(__file__).resolve().parent.parent.parent / "contracts"
PAYLOAD_SCHEMA = json.loads((CONTRACTS_DIR / "payload_schema.json").read_text())
HEARTBEAT_SCHEMA = json.loads((CONTRACTS_DIR / "heartbeat_schema.json").read_text())
payload_validator = Draft202012Validator(PAYLOAD_SCHEMA)
heartbeat_validator = Draft202012Validator(HEARTBEAT_SCHEMA)

# In-memory tracking for reliability metrics
_duplicates_count: dict[str, int] = {}  # tenant_id -> count
_bg_task: Optional[asyncio.Task] = None


def _now_utc_str() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@router.post("/ingest", status_code=status.HTTP_202_ACCEPTED)
async def ingest_payload(
    request: Request,
    x_collector_id: Optional[str] = Header(None, alias="X-Collector-Id"),
    x_timestamp: Optional[str] = Header(None, alias="X-Timestamp"),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
):
    # 1. Read raw body bytes (needed for byte-exact HMAC check and hash computation)
    raw_body = await request.body()

    # 2 & 3. Look up collector in registry and verify HMAC
    is_valid, auth_err, collector_info = verify_collector_auth(
        collector_id=x_collector_id or "",
        raw_body=raw_body,
        timestamp=x_timestamp or "",
        signature=x_signature or "",
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=auth_err)

    # 4. Parse JSON and validate against schema
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"status": "rejected", "errors": [f"Malformed JSON: {str(e)}"]},
        )

    schema_errors = [e.message for e in payload_validator.iter_errors(payload)]
    if schema_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"status": "rejected", "errors": schema_errors},
        )

    # 5. Verify tenant_id and collector_id in body match registry
    expected_tenant = collector_info["tenant_id"]
    if payload.get("collector_id") != x_collector_id or payload.get("tenant_id") != expected_tenant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Collector or tenant mismatch with registry",
        )

    tenant_id = expected_tenant
    payload_id = payload["payload_id"]
    seq = payload["seq"]
    sent_at_utc = payload["sent_at_utc"]
    now_utc = _now_utc_str()
    body_sha256 = hashlib.sha256(raw_body).hexdigest()

    conn = db_for_tenant(tenant_id)
    cursor = conn.cursor()

    # 6. Deduplication check (idempotency)
    existing = cursor.execute(
        "SELECT payload_id FROM received_payloads WHERE payload_id = ?", (payload_id,)
    ).fetchone()
    if existing:
        _duplicates_count[tenant_id] = _duplicates_count.get(tenant_id, 0) + 1
        return Response(
            content=json.dumps({"status": "duplicate", "payload_id": payload_id}),
            status_code=status.HTTP_200_OK,
            media_type="application/json",
        )

    # Insert into received_payloads
    cursor.execute(
        """INSERT INTO received_payloads
           (payload_id, tenant_id, collector_id, seq, sent_at_utc, received_at_utc, body_sha256)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (payload_id, tenant_id, x_collector_id, seq, sent_at_utc, now_utc, body_sha256),
    )

    # 7. Insert metrics rows (one per metric value)
    for source in payload.get("sources", []):
        src_id = source["source_id"]
        svc = source.get("service")
        stype = source.get("source_type")
        event_time = source["event_time_utc"]
        for metric_name, val in source.get("metrics", {}).items():
            if val is not None and isinstance(val, (int, float)):
                cursor.execute(
                    """INSERT INTO metrics
                       (tenant_id, collector_id, source_id, service, source_type, metric, value, event_time_utc, received_at_utc, payload_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (tenant_id, x_collector_id, src_id, svc, stype, metric_name, float(val), event_time, now_utc, payload_id),
                )

    # Insert events rows
    for evt in payload.get("events", []):
        cursor.execute(
            """INSERT OR IGNORE INTO events
               (event_id, tenant_id, collector_id, source_id, category, severity, type, count, summary, event_time_utc, received_at_utc, payload_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                evt["event_id"],
                tenant_id,
                x_collector_id,
                evt["source_id"],
                evt["category"],
                evt["severity"],
                evt["type"],
                evt["count"],
                evt["summary"],
                evt["event_time_utc"],
                now_utc,
                payload_id,
            ),
        )

    # 8. Update collector status, buffer depth, health
    c_health = payload.get("collector_health", {})
    cursor.execute(
        """UPDATE collectors
           SET status = 'online',
               last_seen_utc = ?,
               buffer_depth = ?,
               version = ?,
               cpu_pct = ?,
               mem_pct = ?,
               config_hash = ?
           WHERE collector_id = ?""",
        (
            now_utc,
            c_health.get("buffer_depth", 0),
            c_health.get("version"),
            c_health.get("cpu_pct"),
            c_health.get("mem_pct"),
            c_health.get("config_hash"),
            x_collector_id,
        ),
    )
    conn.commit()

    # 9. Call AIOps hook (guarded so AIOps exceptions never drop ingested data)
    try:
        on_ingest(tenant_id, payload)
    except Exception as exc:
        logger.exception("AIOps hook on_ingest failed: %s", exc)

    # 10. Return accepted
    return {"status": "accepted", "payload_id": payload_id}


@router.post("/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
async def heartbeat(
    request: Request,
    x_collector_id: Optional[str] = Header(None, alias="X-Collector-Id"),
    x_timestamp: Optional[str] = Header(None, alias="X-Timestamp"),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
):
    raw_body = await request.body()
    is_valid, auth_err, collector_info = verify_collector_auth(
        collector_id=x_collector_id or "",
        raw_body=raw_body,
        timestamp=x_timestamp or "",
        signature=x_signature or "",
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=auth_err)

    try:
        hb = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"status": "rejected", "errors": [str(e)]},
        )

    errors = [e.message for e in heartbeat_validator.iter_errors(hb)]
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"status": "rejected", "errors": errors},
        )

    if hb.get("collector_id") != x_collector_id or hb.get("tenant_id") != collector_info["tenant_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registry mismatch")

    now_utc = _now_utc_str()
    conn = db_for_tenant(collector_info["tenant_id"])
    conn.execute(
        """UPDATE collectors
           SET status = 'online',
               last_seen_utc = ?,
               buffer_depth = ?,
               version = ?,
               config_hash = ?
           WHERE collector_id = ?""",
        (now_utc, hb.get("buffer_depth", 0), hb.get("version"), hb.get("config_hash"), x_collector_id),
    )
    conn.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/collectors")
def get_collectors(authorization: Optional[str] = Header(None)):
    tenant_id = get_tenant_from_auth(authorization)
    rows = tenant_query(
        tenant_id,
        "SELECT collector_id, region, version, status, state, last_seen_utc, buffer_depth, cpu_pct, mem_pct, config_hash FROM collectors WHERE tenant_id = ?",
        (tenant_id,),
    )
    return rows


@router.get("/metrics")
def get_metrics(
    source_id: Optional[str] = None,
    metric: Optional[str] = None,
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    authorization: Optional[str] = Header(None),
):
    tenant_id = get_tenant_from_auth(authorization)
    clauses = ["tenant_id = ?"]
    params: list[object] = [tenant_id]

    if source_id:
        clauses.append("source_id = ?")
        params.append(source_id)
    if metric:
        clauses.append("metric = ?")
        params.append(metric)
    if from_time:
        clauses.append("event_time_utc >= ?")
        params.append(from_time)
    if to_time:
        clauses.append("event_time_utc <= ?")
        params.append(to_time)

    where_sql = " AND ".join(clauses)
    sql = f"""SELECT event_time_utc, value, metric, source_id
              FROM metrics
              WHERE {where_sql}
              ORDER BY event_time_utc ASC"""
    return tenant_query(tenant_id, sql, tuple(params))


@router.get("/reliability")
def get_reliability(authorization: Optional[str] = Header(None)):
    tenant_id = get_tenant_from_auth(authorization)
    conn = db_for_tenant(tenant_id)

    # 1. Total received payloads count
    row = conn.execute("SELECT count(*) as cnt FROM received_payloads WHERE tenant_id = ?", (tenant_id,)).fetchone()
    received_count = row["cnt"] if row else 0

    # 2. Duplicates rejected count
    duplicates_rejected = _duplicates_count.get(tenant_id, 0)

    # 3. Sequence gaps per collector
    seq_gaps: dict[str, list[int]] = {}
    collectors = conn.execute("SELECT collector_id FROM collectors WHERE tenant_id = ?", (tenant_id,)).fetchall()
    for c in collectors:
        cid = c["collector_id"]
        rows = conn.execute(
            "SELECT seq FROM received_payloads WHERE tenant_id = ? AND collector_id = ? ORDER BY seq ASC",
            (tenant_id, cid),
        ).fetchall()
        seqs = [r["seq"] for r in rows]
        gaps = []
        if seqs:
            for i in range(len(seqs) - 1):
                diff = seqs[i + 1] - seqs[i]
                if diff > 1:
                    gaps.extend(range(seqs[i] + 1, seqs[i + 1]))
        seq_gaps[cid] = gaps

    # 4. Latency p95 in seconds: (received_at_utc - event_time_utc)
    metric_latencies = []
    rows = conn.execute(
        """SELECT received_at_utc, event_time_utc
           FROM metrics
           WHERE tenant_id = ?
           ORDER BY id DESC LIMIT 500""",
        (tenant_id,),
    ).fetchall()
    for r in rows:
        try:
            recv = datetime.fromisoformat(r["received_at_utc"].replace("Z", "+00:00"))
            evt = datetime.fromisoformat(r["event_time_utc"].replace("Z", "+00:00"))
            sec = max(0.0, (recv - evt).total_seconds())
            metric_latencies.append(sec)
        except Exception:
            continue

    if metric_latencies:
        metric_latencies.sort()
        p95_idx = int(len(metric_latencies) * 0.95)
        p95_idx = min(p95_idx, len(metric_latencies) - 1)
        latency_p95_s = round(metric_latencies[p95_idx], 3)
    else:
        latency_p95_s = 0.0

    # 5. Alert latency: time between event_time_utc and created_at_utc for latest alert
    alert_row = conn.execute(
        """SELECT created_at_utc, event_time_utc
           FROM alerts
           WHERE tenant_id = ?
           ORDER BY created_at_utc DESC LIMIT 1""",
        (tenant_id,),
    ).fetchone()
    alert_latency_s_last = 0.0
    if alert_row and alert_row["created_at_utc"] and alert_row["event_time_utc"]:
        try:
            created = datetime.fromisoformat(alert_row["created_at_utc"].replace("Z", "+00:00"))
            event = datetime.fromisoformat(alert_row["event_time_utc"].replace("Z", "+00:00"))
            alert_latency_s_last = round(max(0.0, (created - event).total_seconds()), 3)
        except Exception:
            pass

    return {
        "received_count": received_count,
        "duplicates_rejected": duplicates_rejected,
        "seq_gaps": seq_gaps,
        "latency_p95_s": latency_p95_s,
        "alert_latency_s_last": alert_latency_s_last,
    }


async def _offline_detector_loop() -> None:
    """Check for collectors that have not sent heartbeat/telemetry for > 60 seconds."""
    while True:
        try:
            await asyncio.sleep(5)
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat().replace("+00:00", "Z")
            for region in config.REGIONS:
                conn = connect(region)
                rows = conn.execute(
                    "SELECT collector_id, tenant_id, last_seen_utc, status, state FROM collectors WHERE status = 'online'"
                ).fetchall()
                for r in rows:
                    last_seen_str = r["last_seen_utc"]
                    if not last_seen_str:
                        continue
                    try:
                        last_seen = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
                        diff_sec = (now - last_seen).total_seconds()
                        if diff_sec > 60:
                            cid = r["collector_id"]
                            tid = r["tenant_id"]
                            prev_state = r["state"]
                            conn.execute(
                                "UPDATE collectors SET status = 'offline', state = 'poor' WHERE collector_id = ?",
                                (cid,),
                            )
                            conn.execute(
                                """INSERT INTO health_history
                                   (tenant_id, entity_type, entity_id, prev_state, state, reason, at_utc)
                                   VALUES (?, 'collector', ?, ?, 'poor', 'no heartbeat for 60s', ?)""",
                                (tid, cid, prev_state, now_iso),
                            )
                            conn.execute(
                                """INSERT INTO audit_log
                                   (tenant_id, actor, action, target, details, at_utc)
                                   VALUES (?, 'system', 'collector_offline', ?, ?, ?)""",
                                (tid, cid, json.dumps({"reason": "no heartbeat for 60s", "last_seen_utc": last_seen_str}), now_iso),
                            )
                            conn.commit()
                    except Exception as e:
                        logger.error("Error processing collector %s: %s", r["collector_id"], e)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Error in offline detector loop: %s", e)


async def startup() -> None:
    """Initialize schemas, seed records, and start background offline detector."""
    global _bg_task
    init_schema()
    if _bg_task is None or _bg_task.done():
        _bg_task = asyncio.create_task(_offline_detector_loop())
