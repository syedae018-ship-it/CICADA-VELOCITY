import asyncio
import logging
import threading
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Dict
from .correlate import CORRELATOR
from .detect import evaluate_metrics_and_detect_alerts, evaluate_security_events
from .store import STORE

# Idempotency cache: bounded LRU/TTL cache of payload_ids (max 10,000)
class IdempotencyCache:
    def __init__(self, maxsize: int = 10000):
        self.maxsize = maxsize
        self._cache = OrderedDict()  # payload_id -> processed_at_timestamp

    def has(self, payload_id: str) -> bool:
        if not payload_id:
            return False
        return payload_id in self._cache

    def add(self, payload_id: str):
        if not payload_id:
            return
        if payload_id in self._cache:
            self._cache.move_to_end(payload_id)
            return
        if len(self._cache) >= self.maxsize:
            self._cache.popitem(last=False)
        self._cache[payload_id] = datetime.now(timezone.utc).timestamp()

PROCESSED_PAYLOADS = IdempotencyCache()
logger = logging.getLogger(__name__)
STALENESS_INTERVAL_S = 5
_staleness_task = None

def _on_ingest(tenant_id: str, payload: Dict[str, Any]):
    """
    Main hook called by SaaS Ingest for every accepted payload.
    Features:
    - Idempotency guard: ignores duplicate payload_id on retry/replay.
    - Event-time ordering: uses event_time_utc from payload sources/events.
    - Updates collector & source health.
    - Correlates cross-layer signals into incidents and generates recommendations.
    """
    payload_id = payload.get("payload_id")

    # Step 1: Idempotency Guard (Zero double-counting on replay)
    if payload_id and PROCESSED_PAYLOADS.has(payload_id):
        # Already processed this payload_id - idempotent skip
        return

    if payload_id:
        PROCESSED_PAYLOADS.add(payload_id)

    collector_id = payload.get("collector_id", "c_unknown")
    sent_at_utc = payload.get("sent_at_utc", datetime.now(timezone.utc).isoformat())

    # Update collector status as online and nominal
    STORE.update_collector_status(
        tenant_id=tenant_id,
        collector_id=collector_id,
        status="online",
        state="excellent",
        reason="heartbeat / payload received",
        timestamp_utc=sent_at_utc
    )

    # Build source_id -> service lookup
    source_service_map = {}
    for src in payload.get("sources", []):
        if src.get("source_id") and src.get("service"):
            source_service_map[src["source_id"]] = src["service"]

    # 1. Process sources and telemetry metrics using event_time_utc
    for src in payload.get("sources", []):
        source_id = src.get("source_id")
        service = src.get("service", "unknown")
        source_type = src.get("source_type", "server")
        # Critical: event_time_utc strictly from the source sample
        event_time_utc = src.get("event_time_utc", sent_at_utc)

        # Evaluate metrics, z-score anomaly detection and get state
        alerts, state, reason = evaluate_metrics_and_detect_alerts(tenant_id, src)

        # Update source health and history
        STORE.update_source_status(
            tenant_id=tenant_id,
            source_id=source_id,
            service=service,
            source_type=source_type,
            state=state,
            reason=reason,
            event_time_utc=event_time_utc
        )

        # Process alerts through correlation engine
        for alert in alerts:
            STORE.add_alert(alert)
            incident, is_suppressed, recs = CORRELATOR.process_alert(alert)
            if incident:
                STORE.add_incident(incident)
                STORE.persist_alert(alert)
            for rec in recs:
                STORE.add_recommendation(rec)

    # 2. Process structured events (auth, network, resource, availability)
    events = payload.get("events", [])
    if events:
        sec_alerts = evaluate_security_events(tenant_id, events, source_service_map=source_service_map)
        for alert in sec_alerts:
            STORE.add_alert(alert)
            incident, is_suppressed, recs = CORRELATOR.process_alert(alert)
            if incident:
                STORE.add_incident(incident)
                STORE.persist_alert(alert)
            for rec in recs:
                STORE.add_recommendation(rec)

def check_staleness_and_timeouts(tenant_id: str):
    """
    Staleness & Outage audit:
    - Checks sources for silence > 30s and downgrades state.
    - Checks collectors for silence > 60s, marks status=offline, state=poor, and raises offline alert.
    """
    now = datetime.now(timezone.utc).timestamp()

    # 1. Source staleness check
    tenant_sources = STORE.sources.get(tenant_id, {})
    for source_id, info in list(tenant_sources.items()):
        last_seen = info.get("last_seen_utc")
        if last_seen:
            clean = last_seen.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean)
            diff = now - dt.timestamp()
            from .health import apply_staleness
            new_state, stale_reason = apply_staleness(info.get("state", "excellent"), diff)
            if new_state != info.get("state"):
                STORE.update_source_status(
                    tenant_id=tenant_id,
                    source_id=source_id,
                    service=info.get("service", "unknown"),
                    source_type=info.get("source_type", "server"),
                    state=new_state,
                    reason=stale_reason,
                    event_time_utc=datetime.now(timezone.utc).isoformat()
                )

    # 2. Collector offline check (> 60s silence)
    tenant_collectors = STORE.collectors.get(tenant_id, {})
    for col_id, cinfo in list(tenant_collectors.items()):
        last_seen = cinfo.get("last_seen_utc")
        if last_seen:
            clean = last_seen.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean)
            diff = now - dt.timestamp()
            if diff > 60.0 and cinfo.get("status") != "offline":
                STORE.update_collector_status(
                    tenant_id=tenant_id,
                    collector_id=col_id,
                    status="offline",
                    state="poor",
                    reason=f"collector silent for {int(diff)}s (>60s timeout)",
                    timestamp_utc=datetime.now(timezone.utc).isoformat()
                )
                # Emit offline alert and incident
                offline_alert = {
                    "alert_id": f"al_{uuid.uuid4().hex[:12]}",
                    "tenant_id": tenant_id,
                    "source_id": col_id,
                    "service": "collector-fleet",
                    "kind": "offline",
                    "metric": "heartbeat",
                    "severity": "critical",
                    "state": "poor",
                    "event_time_utc": datetime.now(timezone.utc).isoformat(),
                    "created_at_utc": datetime.now(timezone.utc).isoformat(),
                    "incident_id": None,
                    "explanation": {
                        "why": f"Collector {col_id} has not reported heartbeat/payload for {int(diff)}s (>60s limit)",
                        "observed": int(diff),
                        "threshold_crossed": "collector_offline_after_s=60",
                        "confidence": 0.95
                    }
                }
                STORE.add_alert(offline_alert)
                inc, _, recs = CORRELATOR.process_alert(offline_alert)
                if inc:
                    STORE.add_incident(inc)
                    STORE.persist_alert(offline_alert)
                for r in recs:
                    STORE.add_recommendation(r)


# The engine keeps in-memory state; ingest runs in a threadpool, so serialise all engine work.
AIOPS_LOCK = threading.RLock()


def on_ingest(tenant_id: str, payload: Dict[str, Any]):
    """Called by SaaS ingest (Person B) for every accepted payload. Thread-safe."""
    with AIOPS_LOCK:
        _on_ingest(tenant_id, payload)


def run_staleness_sweep() -> None:
    """Apply staleness / offline rules to every tenant the engine has seen."""
    with AIOPS_LOCK:
        tenants = set(STORE.sources) | set(STORE.collectors)
        for tenant_id in tenants:
            check_staleness_and_timeouts(tenant_id)


async def _staleness_loop() -> None:
    while True:
        try:
            await asyncio.sleep(STALENESS_INTERVAL_S)
            await asyncio.to_thread(run_staleness_sweep)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("AIOps staleness sweep failed")


async def startup() -> None:
    """Called once by saas/app.py: enable persistence and start the staleness / collector-offline timer."""
    global _staleness_task
    from . import store as _store_mod
    _store_mod.PERSIST_ENABLED = True
    if _staleness_task is None or _staleness_task.done():
        _staleness_task = asyncio.create_task(_staleness_loop())
