"""Live demo driver: drives REAL telemetry through the collector pipeline so judges can inject
scenarios from the dashboard (or curl) and watch the whole system react end to end.

Nothing here is faked downstream: records go through the same redaction → aggregation →
transport → SaaS → AIOps path as the organizer stream would. Enabled when DEMO_CONTROLS=1
(default in dev); disable it in production.

  GET  /local/demo                         status (traffic on/off, active scenario, seconds left)
  POST /local/demo/traffic {"enabled":true} continuous normal telemetry (baseline)
  POST /local/demo/{scenario}?duration=40   inject a scenario on top of the baseline

Scenarios: normal | secret | cpu_spike | latency | correlation | logins | outage | duplicate | out_of_order
"""
import asyncio
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from collector.config import settings
from demo import simulator

logger = logging.getLogger(__name__)

ENABLED = os.getenv("DEMO_CONTROLS", "1") == "1"
SCENARIOS = {
    "normal": "Clear all injected faults; baseline traffic only",
    "secret": "Raw log lines containing a password, API key, JWT, email and IPs",
    "cpu_spike": "payments-api CPU and memory far above their 15-minute baseline",
    "latency": "Network latency and packet loss rise on every source",
    "correlation": "CPU + latency + warning logs together → one correlated incident",
    "logins": "Burst of failed logins on the VPN gateway",
    "outage": "Collector loses the SaaS link: buffer locally, detect offline, then replay",
    "duplicate": "Re-send an already delivered payload: SaaS must reject it as a duplicate",
    "out_of_order": "Late telemetry stamped 2 minutes in the past: stored by event time",
}
_SIM_SCENARIO = {"cpu_spike": "cpu", "correlation": "incident", "latency": "latency",
                 "secret": "secret", "logins": "logins"}

router = APIRouter(prefix="/local/demo", tags=["demo"])


class _State:
    traffic = os.getenv("DEMO_TRAFFIC", "1") == "1"   # baseline traffic on by default in dev
    scenario: Optional[str] = None
    until = 0.0
    tick = 0
    scenario_tick = 0
    task: Optional[asyncio.Task] = None
    outage_task: Optional[asyncio.Task] = None
    last_result: dict[str, Any] = {}


S = _State()


def _tenant_hosts(rec: dict) -> dict:
    """The simulator speaks 'acme'; rename hosts for this collector's tenant (e.g. globex)."""
    short = settings.TENANT_ID.removeprefix("t_")
    if short != "acme":
        for k in ("host", "user"):
            if isinstance(rec.get(k), str):
                rec[k] = rec[k].replace("acme", short)
        if isinstance(rec.get("message"), str):
            rec["message"] = rec["message"].replace("acme", short)
    return rec


async def _feed(records: list[dict]) -> None:
    from collector.routes import ingest_raw          # the same entry point as POST /local/raw
    for r in records:
        await ingest_raw(_tenant_hosts(r))


def _active() -> Optional[str]:
    if S.scenario and time.time() < S.until:
        return S.scenario
    S.scenario = None
    return None


async def _loop() -> None:
    while True:
        try:
            await asyncio.sleep(1)
            if not S.traffic:
                continue
            S.tick += 1
            scen = _active()
            sim = _SIM_SCENARIO.get(scen or "")
            S.scenario_tick += 1
            tick = S.scenario_tick + 10 if sim else S.tick % 5   # scenario ticks start "hot"
            recs = [simulator.metric_record(h, tick, sim) for h in simulator.HOSTS]
            recs += simulator.scenario_records(sim, S.scenario_tick + 10) if sim else []
            await _feed(recs)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("demo driver tick failed")


async def _outage(duration: int) -> None:
    from transport.sender import set_saas_link
    set_saas_link(False)
    S.last_result = {"scenario": "outage", "link": "down", "for_s": duration}
    try:
        await asyncio.sleep(duration)
    finally:
        set_saas_link(True)
        S.last_result = {"scenario": "outage", "link": "restored", "after_s": duration}


def _resend_last_payload() -> dict:
    """Send the newest delivered payload again, byte for byte, with a fresh signature."""
    from transport.db import get_egress_logs
    from transport.signing import sign
    delivered = [e for e in get_egress_logs(limit=50) if e.get("result") in ("accepted", "duplicate")]
    if not delivered:
        raise HTTPException(status_code=409, detail="No delivered payload yet; wait a few seconds")
    e = delivered[0]
    body = e["body_raw"].encode()
    headers = {"X-Collector-Id": settings.COLLECTOR_ID, "Content-Type": "application/json",
               **sign(settings.COLLECTOR_SECRET, body)}
    r = httpx.post(f"{settings.SAAS_URL.rstrip('/')}/api/v1/ingest", content=body, headers=headers, timeout=10)
    return {"payload_id": e["payload_id"], "http_status": r.status_code, "saas_said": r.json().get("status")}


async def _late_records() -> None:
    past = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    recs = [simulator.metric_record(h, 1, None) | {"ts": past} for h in simulator.HOSTS]
    await _feed(recs)


@router.get("")
def status() -> dict:
    return {
        "enabled": ENABLED,
        "traffic": S.traffic,
        "scenario": _active(),
        "seconds_left": max(0, int(S.until - time.time())) if _active() else 0,
        "scenarios": SCENARIOS,
        "last_result": S.last_result,
    }


class TrafficRequest(BaseModel):
    enabled: bool


@router.post("/traffic")
def set_traffic(req: TrafficRequest) -> dict:
    _require()
    S.traffic = req.enabled
    return status()


@router.post("/{scenario}")
async def trigger(scenario: str, duration: int = Query(40, ge=5, le=300)) -> dict:
    _require()
    if scenario not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Unknown scenario. Use one of: {', '.join(SCENARIOS)}")
    S.traffic = True
    if scenario == "normal":
        S.scenario, S.until = None, 0
        S.last_result = {"scenario": "normal"}
    elif scenario == "outage":
        duration = max(duration, 75)          # long enough for the 60 s offline detection to fire
        if S.outage_task is None or S.outage_task.done():
            S.last_result = {"scenario": "outage", "link": "down", "for_s": duration}
            S.outage_task = asyncio.create_task(_outage(duration))
    elif scenario == "duplicate":
        S.last_result = {"scenario": "duplicate", **await asyncio.to_thread(_resend_last_payload)}
    elif scenario == "out_of_order":
        await _late_records()
        S.last_result = {"scenario": "out_of_order", "note": "3 metric records stamped 2 minutes ago"}
    else:
        S.scenario, S.until, S.scenario_tick = scenario, time.time() + duration, 0
        S.last_result = {"scenario": scenario, "duration_s": duration}
    return status()


def _require() -> None:
    if not ENABLED:
        raise HTTPException(status_code=403, detail="Demo controls are disabled (DEMO_CONTROLS=0)")


async def startup() -> None:
    if ENABLED and (S.task is None or S.task.done()):
        S.task = asyncio.create_task(_loop())
