"""Network Quality & Latency Probe Module.

Measures:
- Network Latency (RTT in ms)
- Packet Loss percentage (%)
- DNS query response time (in ms)

Gracefully handles offline states, sandbox boundaries, and ICMP blocks without crashing.
"""

import logging
import os
import re
import socket
import subprocess
import time
from typing import Any, Dict, Optional

from collector.subprocess_util import safe_run_subprocess

logger = logging.getLogger(__name__)

DEFAULT_PROBE_TARGET = "1.1.1.1"


def measure_dns_response_time(target_host: str = "one.one.one.one") -> Optional[float]:
    """Measure the DNS resolution response time in milliseconds."""
    try:
        t0 = time.perf_counter()
        # Resolve hostname to IP
        socket.getaddrinfo(target_host, 53, family=socket.AF_INET)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return round(elapsed_ms, 1)
    except Exception:
        return None


def parse_ping_output(output: str, is_windows: bool) -> Dict[str, Optional[float]]:
    """Parse ping command output for average latency (ms) and packet loss percentage (%)."""
    result: Dict[str, Optional[float]] = {
        "latency_ms": None,
        "packet_loss_percent": None,
    }

    # 1. Packet Loss Extraction
    loss_match = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:packet\s*)?loss", output, re.IGNORECASE)
    if loss_match:
        try:
            result["packet_loss_percent"] = float(loss_match.group(1))
        except ValueError:
            pass

    # 2. Average Latency Extraction
    if is_windows:
        avg_match = re.search(r"Average\s*=\s*(\d+)\s*ms", output, re.IGNORECASE)
        if avg_match:
            try:
                result["latency_ms"] = float(avg_match.group(1))
            except ValueError:
                pass
    else:
        avg_match = re.search(r"min/avg/max/(?:stddev|mdev)\s*=\s*[\d\.]+/([\d\.]+)/", output)
        if avg_match:
            try:
                result["latency_ms"] = float(avg_match.group(1))
            except ValueError:
                pass

    return result


def _tcp_latency_probe(target: str, port: int = 443, count: int = 3, timeout_sec: float = 1.5) -> Dict[str, Any]:
    """Pure-Python TCP-connect latency probe (no subprocess, no ping).

    Opens short-lived TCP connections to `target:port` and measures round-trip.
    Avoids spawning the OS `ping` binary, which flashes a console window on
    some Windows configurations even with CREATE_NO_WINDOW set.
    """
    rtts = []
    failures = 0
    for _ in range(count):
        t0 = time.perf_counter()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout_sec)
        try:
            sock.connect((target, port))
            rtts.append((time.perf_counter() - t0) * 1000.0)
        except Exception:
            failures += 1
        finally:
            try:
                sock.close()
            except Exception:
                pass

    if rtts:
        latency = round(sum(rtts) / len(rtts), 1)
    else:
        latency = None
    loss = round((failures / count) * 100.0, 1) if count else None
    return {"latency_ms": latency, "packet_loss_percent": loss}


def measure_network_quality(target: str = DEFAULT_PROBE_TARGET, count: int = 3, timeout_sec: int = 2) -> Dict[str, Any]:
    """Probe network latency, packet loss, and DNS response time.

    Implementation note: uses a pure-Python TCP connect probe instead of the
    OS `ping` command, so no console window is ever spawned on Windows.
    """
    dns_ms = measure_dns_response_time()

    try:
        probed = _tcp_latency_probe(target=target, port=443, count=max(1, count), timeout_sec=float(timeout_sec))
        latency = probed["latency_ms"]
        loss = probed["packet_loss_percent"]

        if loss is not None and loss >= 100.0:
            status = "UNREACHABLE"
        elif latency is not None:
            status = "CONNECTED"
        else:
            status = "UNKNOWN"

        return {
            "probe_target": target,
            "latency_ms": latency,
            "packet_loss_percent": loss,
            "dns_response_ms": dns_ms,
            "status": status,
        }

    except Exception as e:
        logger.debug("Network probe exception: %s", e)
        return {
            "probe_target": target,
            "latency_ms": None,
            "packet_loss_percent": None,
            "dns_response_ms": dns_ms,
            "status": "UNAVAILABLE",
        }
