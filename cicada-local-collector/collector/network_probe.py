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


def measure_network_quality(target: str = DEFAULT_PROBE_TARGET, count: int = 3, timeout_sec: int = 2) -> Dict[str, Any]:
    """Probe network latency, packet loss, and DNS response time.

    Args:
        target: IP address or hostname to probe (default: 1.1.1.1).
        count: Number of ping packets to send.
        timeout_sec: Timeout per ping request.

    Returns:
        Dictionary with probe_target, latency_ms, packet_loss_percent, dns_response_ms, and status.
    """
    is_windows = (os.name == "nt")
    dns_ms = measure_dns_response_time()

    if is_windows:
        cmd = ["ping", "-n", str(count), "-w", str(timeout_sec * 1000), target]
    else:
        cmd = ["ping", "-c", str(count), "-W", str(timeout_sec), target]

    try:
        proc = safe_run_subprocess(
            cmd,
            timeout=timeout_sec * count + 2,
        )

        combined_output = f"{proc.stdout}\n{proc.stderr}"
        parsed = parse_ping_output(combined_output, is_windows=is_windows)

        latency = parsed["latency_ms"]
        loss = parsed["packet_loss_percent"]

        if loss is not None and loss >= 100.0:
            status = "UNREACHABLE"
        elif latency is not None:
            status = "CONNECTED"
        elif proc.returncode != 0:
            status = "FAILED"
        else:
            status = "UNKNOWN"

        return {
            "probe_target": target,
            "latency_ms": latency,
            "packet_loss_percent": loss,
            "dns_response_ms": dns_ms,
            "status": status,
        }

    except subprocess.TimeoutExpired:
        return {
            "probe_target": target,
            "latency_ms": None,
            "packet_loss_percent": 100.0,
            "dns_response_ms": dns_ms,
            "status": "TIMEOUT",
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
