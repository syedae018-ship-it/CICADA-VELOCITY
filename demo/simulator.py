"""Telemetry simulator: stand-in for the organizer stream (stdlib only).

Emits RawRecords (contracts/raw_input.md) once per second for a few fake hosts.
Use --scenario to inject one of the demo scenarios. See demo/README.md.
"""
import argparse
import json
import random
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

HOSTS = [
    {"host": "db-prod-01.acme.local", "ip": "10.0.4.17", "service": "payments-api", "source_type": "server"},
    {"host": "web-01.acme.local", "ip": "10.0.4.21", "service": "web-frontend", "source_type": "server"},
    {"host": "core-sw-01", "ip": "10.0.0.1", "service": "core-switch", "source_type": "network"},
]
VPN = {"host": "vpn-gw-01.acme.local", "ip": "10.0.9.2", "service": "vpn", "source_type": "security"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def metric_record(h: dict, tick: int, scenario: str | None) -> dict:
    hot = scenario in ("cpu", "incident") and h["service"] == "payments-api" and tick > 5
    slow = scenario in ("latency", "incident") and tick > 5
    if h["source_type"] == "network":
        m = {
            "latency_ms": round(random.gauss(240 if slow else 4, 15 if slow else 1), 1),
            "packet_loss_pct": round(random.uniform(3, 8) if slow else random.uniform(0, 0.05), 2),
            "bandwidth_mbps": round(random.gauss(410, 20), 1),
            "connectivity_ok": True,
        }
    else:
        m = {
            "cpu_pct": round(min(100, random.gauss(93 if hot else 38, 3 if hot else 6)), 1),
            "mem_pct": round(min(100, random.gauss(85 if hot else 57, 3)), 1),
            "disk_pct": round(random.gauss(61, 0.5), 1),
            "latency_ms": round(abs(random.gauss(190 if (hot or slow) else 22, 10 if (hot or slow) else 4)), 1),
            "service_up": True,
        }
    return {"kind": "metric", "ts": now(), **h, "metrics": m}


def scenario_records(scenario: str | None, tick: int) -> list[dict]:
    out = []
    if scenario == "secret" and tick % 3 == 0:
        out.append({
            "kind": "log", "ts": now(), **HOSTS[0], "source_type": "app", "level": "ERROR",
            "message": "DB connect failed user=admin password=hunter2 api_key=sk_live_51HxYzABCDEF "
                       "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJlX3g "
                       "client=alice@acme.com from 203.0.113.9",
        })
    if scenario == "logins" and tick > 3:
        for _ in range(random.randint(2, 4)):
            out.append({
                "kind": "auth", "ts": now(), **VPN,
                "user": random.choice(["alice@acme.com", "bob@acme.com", "admin"]),
                "src_ip": random.choice(["203.0.113.9", "198.51.100.23", "192.0.2.77"]),
                "outcome": "failure",
            })
    if scenario == "incident" and tick > 6:
        out.append({"kind": "log", "ts": now(), **HOSTS[0], "level": "WARN",
                    "message": "request queue depth high, worker pool saturated"})
    return out


def send(record: dict, target: str | None) -> None:
    body = json.dumps(record)
    if target is None:
        print(body, flush=True)
        return
    req = urllib.request.Request(target, data=body.encode(), headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=2).read()
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"[simulator] send failed ({e}); is the collector running on {target}?", flush=True)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--target", default="http://localhost:8001/local/raw")
    p.add_argument("--stdout", action="store_true", help="print records instead of POSTing")
    p.add_argument("--scenario", choices=["secret", "cpu", "latency", "logins", "incident"])
    p.add_argument("--interval", type=float, default=1.0)
    p.add_argument("--ticks", type=int, default=0, help="stop after N ticks (0 = forever)")
    a = p.parse_args()
    target = None if a.stdout else a.target

    tick = 0
    while a.ticks == 0 or tick < a.ticks:
        tick += 1
        for h in HOSTS:
            send(metric_record(h, tick, a.scenario), target)
        for r in scenario_records(a.scenario, tick):
            send(r, target)
        time.sleep(a.interval)


if __name__ == "__main__":
    main()
