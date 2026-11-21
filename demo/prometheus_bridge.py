"""Prometheus bridge: real-time mock collector.

Until the local collector is finished, this pulls LIVE metrics from a public Prometheus demo
server, turns them into a contract-valid MetadataPayload (contracts/payload_schema.json),
signs it with HMAC and sends it to the SaaS receiver, through the ingest firewall, exactly
like the real collector would.

Public servers (free, no key, real node_exporter / app metrics updated every few seconds):
    https://prometheus.demo.prometheus.io     official Prometheus project demo (default)
    https://demo.promlabs.com                 PromLabs demo

Privacy is kept the same as the real collector: Prometheus `instance` labels (hostnames/IPs)
never leave this process. They are replaced by HMAC(site_salt, instance)[:12] source ids and
the logical job name is used as the service.

Run from the repo root (SaaS must be running on :8000):
    .venv/bin/python -m demo.prometheus_bridge
    PROM_URL=https://demo.promlabs.com .venv/bin/python -m demo.prometheus_bridge
    PROM_CHAOS=1 .venv/bin/python -m demo.prometheus_bridge     # add a CPU spike every ~2 min to exercise AIOps
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

from saas import config
from transport.signing import sign

log = logging.getLogger("prometheus_bridge")

PROM_URL = os.getenv("PROM_URL", "https://prometheus.demo.prometheus.io").rstrip("/")
SAAS_URL = os.getenv("SAAS_URL", "http://localhost:8000").rstrip("/")
COLLECTOR_ID = os.getenv("PROM_COLLECTOR_ID", "c_prom01")
INTERVAL_S = int(os.getenv("PROM_INTERVAL_S", "10"))
CHAOS = os.getenv("PROM_CHAOS", "0") == "1"
STATE_FILE = Path(os.getenv("PROM_STATE_FILE", "saas/data/prometheus_bridge_state.json"))
VERSION = "prom-bridge-1.0"

Q_CPU = '100 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100'
Q_MEM = "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100"
Q_DISK = ('max by (instance) ((1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay|ramfs"} '
          '/ node_filesystem_size_bytes{fstype!~"tmpfs|overlay|ramfs"}) * 100)')
Q_NET = ("sum by (instance) (rate(node_network_receive_bytes_total[1m]) "
         "+ rate(node_network_transmit_bytes_total[1m])) * 8 / 1e6")
Q_UP = "up"
Q_PROBE = "avg(probe_duration_seconds) * 1000"


def _utc(ts: float | None = None) -> str:
    return datetime.fromtimestamp(ts or time.time(), timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"seq": 0, "salt": secrets.token_hex(16)}


def _save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state))


def _source_id(salt: str, label: str) -> str:
    return "src_" + hmac.new(salt.encode(), label.encode(), hashlib.sha256).hexdigest()[:12]


def _service(name: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")[:40] or "unknown"


def _clamp(v: float) -> float:
    return round(max(0.0, min(100.0, v)), 2)


def query(client: httpx.Client, promql: str) -> list[tuple[dict, float]]:
    r = client.get(f"{PROM_URL}/api/v1/query", params={"query": promql}, timeout=10)
    r.raise_for_status()
    out = []
    for row in r.json().get("data", {}).get("result", []):
        try:
            v = float(row["value"][1])
        except (KeyError, ValueError, IndexError):
            continue
        if v == v and abs(v) != float("inf"):   # drop NaN / Inf
            out.append((row.get("metric", {}), v))
    return out


def build_payload(client: httpx.Client, state: dict, started: float) -> dict:
    now = time.time()
    salt = state["salt"]
    coll = config.COLLECTORS[COLLECTOR_ID]

    by_inst = lambda rows: {m.get("instance", ""): v for m, v in rows}
    cpu, mem, disk, net = (by_inst(query(client, q)) for q in (Q_CPU, Q_MEM, Q_DISK, Q_NET))
    up_rows = query(client, Q_UP)
    probe = query(client, Q_PROBE)

    sources, events = [], []
    records_in = sum(len(x) for x in (cpu, mem, disk, net, up_rows))

    # Node hosts → one "server" source + one "network" source each (hostname hashed, never sent).
    for i, inst in enumerate(sorted(set(cpu) | set(mem))):
        metrics = {"service_up": True}
        if inst in cpu:
            metrics["cpu_pct"] = _clamp(cpu[inst])
        if inst in mem:
            metrics["mem_pct"] = _clamp(mem[inst])
        if inst in disk:
            metrics["disk_pct"] = _clamp(disk[inst])
        if CHAOS and i == 0 and int(now // 60) % 2 == 0 and int(now) % 60 < 30:
            metrics["cpu_pct"] = _clamp(metrics.get("cpu_pct", 20) + 70)
        sid = _source_id(salt, f"node:{inst}")
        sources.append({"source_id": sid, "source_type": "server", "service": f"node-{i + 1}",
                        "event_time_utc": _utc(now), "metrics": metrics})
        if metrics.get("cpu_pct", 0) >= 85:
            events.append({"event_id": str(uuid.uuid4()), "event_time_utc": _utc(now), "source_id": sid,
                           "category": "resource", "severity": "high", "type": "resource_pressure", "count": 1,
                           "summary": f"CPU at {metrics['cpu_pct']:.0f}% on node-{i + 1}"})
        if inst in net:
            nm = {"bandwidth_mbps": round(max(net[inst], 0), 3), "connectivity_ok": True}
            if probe:
                nm["latency_ms"] = round(max(probe[0][1], 0), 2)
            sources.append({"source_id": _source_id(salt, f"net:{inst}"), "source_type": "network",
                            "service": f"node-{i + 1}-net", "event_time_utc": _utc(now), "metrics": nm})

    # Scrape targets → one "app" source per job (availability from `up`).
    jobs: dict[str, list[float]] = {}
    for m, v in up_rows:
        jobs.setdefault(m.get("job", "unknown"), []).append(v)
    for job, vals in sorted(jobs.items()):
        healthy = all(v >= 1 for v in vals)
        sid = _source_id(salt, f"job:{job}")
        sources.append({"source_id": sid, "source_type": "app", "service": _service(job),
                        "event_time_utc": _utc(now), "metrics": {"service_up": healthy}})
        if not healthy:
            events.append({"event_id": str(uuid.uuid4()), "event_time_utc": _utc(now), "source_id": sid,
                           "category": "availability", "severity": "high", "type": "service_down",
                           "count": sum(1 for v in vals if v < 1),
                           "summary": f"{sum(1 for v in vals if v < 1)} of {len(vals)} {_service(job)} targets down"})

    state["seq"] += 1
    return {
        "schema_version": "1.0",
        "payload_id": str(uuid.uuid4()),
        "tenant_id": coll["tenant_id"],
        "collector_id": COLLECTOR_ID,
        "region": coll["region"],
        "seq": state["seq"],
        "sent_at_utc": _utc(now),
        "source_tz": "UTC",
        "window": {"start_utc": _utc(now - INTERVAL_S), "end_utc": _utc(now)},
        "sources": sources,
        "events": events,
        "collector_health": {"version": VERSION, "cpu_pct": 1.0, "mem_pct": 2.0, "buffer_depth": 0,
                             "config_hash": hashlib.sha256(PROM_URL.encode()).hexdigest()[:12],
                             "uptime_s": int(now - started)},
        # Every label (instance, job, device…) is dropped or hashed before sending.
        "redaction_stats": {"records_in": records_in, "secrets_redacted": 0, "fields_dropped": records_in},
    }


def send(client: httpx.Client, path: str, doc: dict) -> httpx.Response:
    body = json.dumps(doc, separators=(",", ":")).encode()
    headers = {"Content-Type": "application/json", "X-Collector-Id": COLLECTOR_ID,
               **sign(config.COLLECTORS[COLLECTOR_ID]["secret"], body)}
    return client.post(f"{SAAS_URL}{path}", content=body, headers=headers, timeout=10)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if COLLECTOR_ID not in config.COLLECTORS:
        raise SystemExit(f"{COLLECTOR_ID} is not registered in saas/config.py COLLECTORS")
    state = _load_state()
    started = time.time()
    log.info("Prometheus bridge: %s → %s as %s every %ss%s", PROM_URL, SAAS_URL, COLLECTOR_ID, INTERVAL_S,
             " (chaos on)" if CHAOS else "")
    with httpx.Client() as client:
        while True:
            t0 = time.time()
            try:
                payload = build_payload(client, state, started)
                r = send(client, "/api/v1/ingest", payload)
                if r.status_code in (200, 202):
                    _save_state(state)
                    log.info("seq=%s sources=%d events=%d → %s", payload["seq"], len(payload["sources"]),
                             len(payload["events"]), r.status_code)
                else:
                    log.warning("receiver said %s: %s", r.status_code, r.text[:300])
            except httpx.HTTPError as exc:
                log.warning("cycle failed: %s", exc)
            time.sleep(max(1.0, INTERVAL_S - (time.time() - t0)))


if __name__ == "__main__":
    main()
