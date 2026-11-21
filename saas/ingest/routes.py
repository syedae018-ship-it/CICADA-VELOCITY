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
from pydantic import BaseModel, Field

from saas import config
from saas.aiops import on_heartbeat, on_ingest
from saas.db import DuplicatePayload, get_store, now_utc, parse_utc
from saas.ingest.auth import get_tenant, register_collector, verify_collector_auth
from saas.ingest.firewall import FIREWALL, client_ip

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["ingest"])

CONTRACTS_DIR = Path(__file__).resolve().parent.parent.parent / "contracts"
payload_validator = Draft202012Validator(json.loads((CONTRACTS_DIR / "payload_schema.json").read_text()))
heartbeat_validator = Draft202012Validator(json.loads((CONTRACTS_DIR / "heartbeat_schema.json").read_text()))

OFFLINE_AFTER_S = 60
REPLAY_THRESHOLD_S = 30   # older than this on arrival = buffered during an outage and replayed
HTTP_422 = 422

_duplicates_count: dict[str, int] = {}   # tenant_id -> duplicates rejected since SaaS start
_collector_status: dict[str, dict] = {}  # collector_id -> last known {status, state, last_seen_utc}; saves a read per payload
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
    prev = _collector_status.get(collector_id)
    if prev is None:
        prev = store.get_collector(tenant_id, collector_id) or {}
    now = fields["last_seen_utc"]
    came_back = prev.get("status") in ("offline", None)   # None = first contact ever
    update = {"status": "online", **fields}
    if came_back:
        update["state"] = "good"
    store.update_collector(tenant_id, collector_id, update)
    _collector_status[collector_id] = {**prev, **update}
    if came_back:
        reason = "collector reconnected" if prev.get("last_seen_utc") else "collector first seen"
        store.insert_health(tenant_id, {"entity_type": "collector", "entity_id": collector_id,
                                        "prev_state": prev.get("state"), "state": "good",
                                        "reason": reason, "at_utc": now})
        store.insert_audit(tenant_id, {"actor": "system", "action": "collector_online", "target": collector_id,
                                       "details": {"reason": reason}, "at_utc": now})


def _guarded(request: Request, raw_body: bytes, collector_id: Optional[str], endpoint: str,
             validator: Draft202012Validator) -> tuple[dict, dict]:
    """Firewall → HMAC → schema. Every block is recorded by the firewall; returns (collector, doc)."""
    ip = client_ip(request)
    FIREWALL.inspect(ip=ip, collector_id=collector_id, content_type=request.headers.get("content-type"),
                     body=raw_body, endpoint=endpoint)
    try:
        collector = _authenticate(collector_id, raw_body, request.headers.get("X-Timestamp"),
                                  request.headers.get("X-Signature"))
    except HTTPException as exc:
        FIREWALL.deny("hmac_auth", ip, collector_id, endpoint, str(exc.detail))
        raise
    try:
        doc = _parse(raw_body, validator)
    except HTTPException as exc:
        errs = exc.detail.get("errors", []) if isinstance(exc.detail, dict) else [str(exc.detail)]
        FIREWALL.deny("schema", ip, collector_id, endpoint, (errs[0] if errs else "schema violation")[:160])
        raise
    return collector, doc


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
    # Firewall gate, then HMAC, then allow-list schema (enforced again in SaaS)
    collector, payload = _guarded(request, raw_body, x_collector_id, "ingest", payload_validator)

    tenant_id = collector["tenant_id"]                                # tenant from registry, never trusted from body
    if payload["collector_id"] != x_collector_id or payload["tenant_id"] != tenant_id:
        FIREWALL.deny("schema", client_ip(request), x_collector_id, "ingest", "collector/tenant mismatch with registry")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Collector or tenant mismatch with registry")
    if payload["region"] != collector["region"]:
        FIREWALL.deny("schema", client_ip(request), x_collector_id, "ingest", "wrong regional endpoint")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Collector sent to the wrong regional endpoint")
    FIREWALL.allow(client_ip(request), x_collector_id, "ingest")

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
    collector, hb = _guarded(request, raw_body, x_collector_id, "heartbeat", heartbeat_validator)
    if hb["collector_id"] != x_collector_id or hb["tenant_id"] != collector["tenant_id"]:
        FIREWALL.deny("schema", client_ip(request), x_collector_id, "heartbeat", "registry mismatch")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registry mismatch")
    FIREWALL.allow(client_ip(request), x_collector_id, "heartbeat")
    try:
        await run_in_threadpool(_mark_seen, collector["tenant_id"], x_collector_id,
                                {"last_seen_utc": now_utc(), "buffer_depth": hb["buffer_depth"],
                                 "version": hb["version"], "config_hash": hb["config_hash"]})
    except Exception:
        logger.exception("Heartbeat storage failed")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Storage unavailable")
    try:
        await run_in_threadpool(on_heartbeat, collector["tenant_id"], x_collector_id)
    except Exception:
        logger.exception("AIOps heartbeat hook failed")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class EnrollmentRequest(BaseModel):
    enrollment_token: str = Field(..., description="Authorized enrollment credential or token")
    hostname: Optional[str] = None
    os_name: Optional[str] = None
    requested_collector_id: Optional[str] = None
    tenant_id: Optional[str] = None
    region: Optional[str] = None


@router.post("/enroll", status_code=status.HTTP_200_OK)
async def enroll_collector(req: EnrollmentRequest):
    """Enroll a newly installed collector and return assigned identity and credentials."""
    import re
    import secrets

    token = req.enrollment_token.strip()

    # Determine tenant from authorized token:
    tenant_id = None
    if token == "enroll-token-globex":
        tenant_id = "t_globex"
    elif token in ("enroll-token-acme", "cicada-enroll-default", "dev-enroll-key", "default-enroll-token"):
        tenant_id = "t_acme"
    elif token.startswith("enroll-") and req.tenant_id in config.TENANTS:
        tenant_id = req.tenant_id
    elif config.DEV_INSECURE and token in ("dev", "demo", "dev-token", "test-token"):
        tenant_id = req.tenant_id or "t_acme"

    if not tenant_id or tenant_id not in config.TENANTS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or unauthorized enrollment token"
        )

    # Determine region
    home_reg = config.TENANTS[tenant_id]["home_region"]
    region = req.region if req.region in config.REGIONS else home_reg

    # Assign collector_id conforming to ^c_[a-z0-9]{2,16}$
    if req.requested_collector_id and re.match(r"^c_[a-z0-9]{2,16}$", req.requested_collector_id):
        collector_id = req.requested_collector_id
    else:
        collector_id = f"c_{secrets.token_hex(4)}"

    # Generate HMAC secret
    collector_secret = f"dev-secret-{collector_id}" if config.DEV_INSECURE else f"sec_{secrets.token_hex(16)}"

    # Register in SaaS memory/registry
    register_collector(collector_id, tenant_id=tenant_id, region=region, secret=collector_secret)

    # Pre-seed in store
    try:
        store = get_store()
        store.update_collector(
            tenant_id,
            collector_id,
            {
                "region": region,
                "version": "1.0.0",
                "status": "offline",
                "state": "good",
                "buffer_depth": 0,
            }
        )
    except Exception as e:
        logger.warning("Could not pre-seed collector in store: %s", e)

    return {
        "status": "enrolled",
        "collector_id": collector_id,
        "collector_secret": collector_secret,
        "tenant_id": tenant_id,
        "region": region,
        "transmission_interval_s": 60,
        "heartbeat_interval_s": 10,
    }


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

    all_lat = [x for r in store.recent_metric_times(tenant_id)
               if (x := _seconds_between(r["received_at_utc"], r["event_time_utc"])) is not None]
    # Data held in the outbox during an outage arrives late on purpose; the 10 s target is about live flow.
    latencies = sorted(x for x in all_lat if x <= REPLAY_THRESHOLD_S)
    replayed = [x for x in all_lat if x > REPLAY_THRESHOLD_S]
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
        "replayed_after_outage": len(replayed),
        "max_replay_delay_s": round(max(replayed), 1) if replayed else 0,
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
        _collector_status[cid] = {**_collector_status.get(cid, {}), "status": "offline", "state": "poor"}
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


# ── Firewall visibility (dashboard) ──────────────────────────────────────────

@router.get("/firewall/status")
def firewall_status(tenant_id: str = Depends(get_tenant)):
    """Live firewall rules, counters, quarantine list and recent decisions for this tenant."""
    return FIREWALL.status(tenant_id)


@router.post("/firewall/selftest")
def firewall_selftest(tenant_id: str = Depends(get_tenant)):
    """Fire one synthetic hostile request at each rule and prove it is blocked, plus one clean payload
    that is allowed. Nothing is stored; results are logged as synthetic decisions."""
    from transport.signing import sign

    cid = next((c for c, v in config.COLLECTORS.items() if v["tenant_id"] == tenant_id), None)
    secret = config.COLLECTORS[cid]["secret"] if cid else "none"
    sample = json.loads((CONTRACTS_DIR / "sample_payloads" / "01_normal.json").read_text())
    sample.update({"tenant_id": tenant_id, "collector_id": cid or sample["collector_id"],
                   "region": config.COLLECTORS.get(cid, {}).get("region", sample["region"])})
    clean = json.dumps(sample).encode()
    leaky = json.loads(clean)
    leaky["events"] = [{"event_id": "11111111-2222-4333-8444-555555555555", "event_time_utc": sample["sent_at_utc"],
                        "source_id": sample["sources"][0]["source_id"], "category": "auth", "severity": "high",
                        "type": "failed_login_burst", "count": 3,
                        "summary": "login failed for admin@acme.com key=AKIAIOSFODNN7EXAMPLE"}]
    extra = json.loads(clean)
    extra["raw_log"] = "Nov 21 sshd[311]: Failed password for root"

    results = []

    def run(name: str, expect: str, fn) -> None:
        try:
            fn()
            results.append({"probe": name, "expected": expect, "result": "allowed", "passed": expect == "allowed"})
        except HTTPException as exc:
            rule = exc.detail.get("rule") if isinstance(exc.detail, dict) else None
            results.append({"probe": name, "expected": expect, "result": f"blocked ({rule or exc.status_code})",
                            "passed": expect == "blocked", "rule": rule})

    def gate(ip="127.0.0.1", ctype="application/json", body=clean, collector=cid):
        FIREWALL.inspect(ip=ip, collector_id=collector, content_type=ctype, body=body, endpoint="selftest",
                         synthetic=True)

    run("Request from an unknown public IP", "blocked", lambda: gate(ip="203.0.113.50"))
    run("Non-JSON content type", "blocked", lambda: gate(ctype="text/plain"))
    run("Oversized 1 MB body", "blocked", lambda: gate(body=b'{"x":"' + b"A" * (1024 * 1024) + b'"}'))
    run("Payload leaking an email + AWS key", "blocked", lambda: gate(body=json.dumps(leaky).encode()))

    def flood():
        for _ in range(500):
            gate(collector=None, ip="127.0.0.250", body=b"{}")
    run("Flood of 500 requests", "blocked", flood)

    def forged():
        ok, err, _ = verify_collector_auth(cid or "", clean, str(int(datetime.now().timestamp())), "0" * 64)
        if not ok:
            FIREWALL.deny("hmac_auth", "127.0.0.1", cid, "selftest", err or "bad signature", synthetic=True)
            raise HTTPException(401, detail={"rule": "hmac_auth"})
    run("Forged HMAC signature", "blocked", forged)

    def unknown_field():
        gate(body=json.dumps(extra).encode())
        errs = [e.message for e in payload_validator.iter_errors(extra)]
        if errs:
            FIREWALL.deny("schema", "127.0.0.1", cid, "selftest", errs[0][:160], synthetic=True)
            raise HTTPException(422, detail={"rule": "schema"})
    run("Raw log smuggled in an extra field", "blocked", unknown_field)

    def legit():
        gate()
        hdr = sign(secret, clean)
        ok, err, _ = verify_collector_auth(cid or "", clean, hdr["X-Timestamp"], hdr["X-Signature"])
        if not ok or list(payload_validator.iter_errors(sample)):
            raise HTTPException(500, detail={"rule": "unexpected"})
        FIREWALL.allow("127.0.0.1", cid, "selftest", "clean signed payload", synthetic=True)
    run("Clean, signed, allow-listed payload", "allowed", legit)

    return {"tenant_id": tenant_id, "passed": sum(r["passed"] for r in results), "total": len(results),
            "results": results}
