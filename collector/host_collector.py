"""Continuous Host Telemetry Sampler for Velocity Cicada Collector.

Collects live hardware, OS, network, and security telemetry from the local Windows host:
- CPU %, Memory %, Disk % (psutil)
- Network bandwidth & upload/download rates
- Latency & Packet Loss (safe ping without console windows)
- Failed login attempt counts (safe wevtutil without console windows)
- Feeds normalized records into the local ingestion pipeline and SQLite store.

Guarantees 100% adherence to the data pipeline:
COLLECT -> NORMALIZE -> REDACT -> PSEUDONYMIZE -> AGGREGATE -> ALLOW-LIST -> SIGN -> SEND
"""

import asyncio
import logging
import os
import socket
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import psutil

from collector import config
from collector.subprocess_util import safe_run_subprocess

logger = logging.getLogger("cicada.host_collector")

_last_net_time: Optional[float] = None
_last_bytes_sent: Optional[int] = None
_last_bytes_recv: Optional[int] = None
_has_cpu_initialized: bool = False
_collector_paused: bool = False
_host_task: Optional[asyncio.Task] = None


def is_collector_paused() -> bool:
    return _collector_paused


def set_collector_paused(paused: bool) -> bool:
    global _collector_paused
    _collector_paused = paused
    logger.info("Host telemetry collection paused: %s", paused)
    return _collector_paused


def get_primary_disk_path() -> str:
    """Determine primary drive safely across Windows and Unix."""
    if os.name == "nt":
        try:
            drive = os.path.splitdrive(os.path.abspath("."))[0]
            return f"{drive}\\" if drive else "C:\\"
        except Exception:
            return "C:\\"
    return "/"


def sample_network_speeds() -> tuple[float, float]:
    """Calculate upload and download speeds in bytes per second."""
    global _last_net_time, _last_bytes_sent, _last_bytes_recv
    upload_bps = 0.0
    download_bps = 0.0

    try:
        net_io = psutil.net_io_counters()
        now = time.time()
        if net_io:
            bytes_sent = int(net_io.bytes_sent)
            bytes_recv = int(net_io.bytes_recv)

            if _last_net_time is not None and _last_bytes_sent is not None and _last_bytes_recv is not None:
                dt = now - _last_net_time
                if dt > 0:
                    upload_bps = max(0.0, (bytes_sent - _last_bytes_sent) / dt)
                    download_bps = max(0.0, (bytes_recv - _last_bytes_recv) / dt)

            _last_net_time = now
            _last_bytes_sent = bytes_sent
            _last_bytes_recv = bytes_recv
    except Exception as e:
        logger.debug("Network speed sampling exception: %s", e)

    return upload_bps, download_bps


def sample_network_quality(target: str = "1.1.1.1", timeout_sec: int = 1) -> Dict[str, Any]:
    """Measure network latency and packet loss safely without flashing console windows."""
    is_windows = (os.name == "nt")
    if is_windows:
        cmd = ["ping", "-n", "2", "-w", str(timeout_sec * 1000), target]
    else:
        cmd = ["ping", "-c", "2", "-W", str(timeout_sec), target]

    try:
        proc = safe_run_subprocess(cmd, timeout=timeout_sec * 2 + 2)
        combined = f"{proc.stdout}\n{proc.stderr}"
        import re
        latency = None
        loss = None

        loss_match = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:packet\s*)?loss", combined, re.IGNORECASE)
        if loss_match:
            try:
                loss = float(loss_match.group(1))
            except ValueError:
                pass

        if is_windows:
            avg_match = re.search(r"Average\s*=\s*(\d+)\s*ms", combined, re.IGNORECASE)
            if avg_match:
                try:
                    latency = float(avg_match.group(1))
                except ValueError:
                    pass
        else:
            avg_match = re.search(r"min/avg/max/(?:stddev|mdev)\s*=\s*[\d\.]+/([\d\.]+)/", combined)
            if avg_match:
                try:
                    latency = float(avg_match.group(1))
                except ValueError:
                    pass

        status = "CONNECTED" if latency is not None else ("UNREACHABLE" if loss and loss >= 100 else "UNKNOWN")
        return {
            "latency_ms": latency,
            "packet_loss_percent": loss,
            "status": status,
        }
    except Exception:
        return {
            "latency_ms": None,
            "packet_loss_percent": None,
            "status": "UNAVAILABLE",
        }


def sample_failed_logins() -> int:
    """Sample failed login count safely without flashing console windows."""
    if os.name != "nt":
        return 0

    cmd = [
        "wevtutil", "qe", "Security",
        "/q:*[System[(EventID=4625)]]",
        "/c:10", "/rd:true", "/f:text"
    ]
    try:
        proc = safe_run_subprocess(cmd, timeout=3)
        if proc.returncode == 0 and proc.stdout:
            return proc.stdout.count("Event[") or proc.stdout.count("EventID: 4625")
    except Exception:
        pass
    return 0


def collect_host_sample() -> Dict[str, Any]:
    """Collect a complete live hardware and operating system telemetry snapshot."""
    global _has_cpu_initialized

    # 1. CPU Usage
    if not _has_cpu_initialized:
        cpu_pct = float(psutil.cpu_percent(interval=0.1))
        _has_cpu_initialized = True
    else:
        cpu_pct = float(psutil.cpu_percent(interval=None))

    # 2. RAM Usage
    mem = psutil.virtual_memory()
    mem_pct = float(mem.percent)

    # 3. Disk Usage
    disk = psutil.disk_usage(get_primary_disk_path())
    disk_pct = float(disk.percent)

    # 4. Network
    up_bps, down_bps = sample_network_speeds()
    bandwidth_mbps = round((up_bps + down_bps) * 8.0 / 1_000_000.0, 2)
    net_quality = sample_network_quality()

    # 5. Security
    failed_logins = sample_failed_logins()

    now_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    hostname = socket.gethostname() or "workstation-host"

    metrics_obj = {
        "cpu_pct": round(cpu_pct, 2),
        "mem_pct": round(mem_pct, 2),
        "disk_pct": round(disk_pct, 2),
        "bandwidth_mbps": bandwidth_mbps,
        "service_up": True,
        "connectivity_ok": net_quality["status"] in ("CONNECTED", "SKIPPED", None),
    }

    if net_quality.get("latency_ms") is not None:
        metrics_obj["latency_ms"] = round(float(net_quality["latency_ms"]), 2)
    if net_quality.get("packet_loss_percent") is not None:
        metrics_obj["packet_loss_pct"] = round(float(net_quality["packet_loss_percent"]), 2)

    canonical_record = {
        "ts": now_utc,
        "kind": "metric",
        "host": hostname,
        "service": config.SERVICE_NAME,
        "source_type": "server",
        "metrics": metrics_obj,
    }

    extra_records = []
    if failed_logins > 0:
        extra_records.append({
            "ts": now_utc,
            "kind": "auth",
            "host": hostname,
            "service": config.SERVICE_NAME,
            "source_type": "security",
            "count": failed_logins,
            "outcome": "failed",
        })

    return {
        "record": canonical_record,
        "extras": extra_records,
        "raw_snapshot": {
            "cpu_pct": cpu_pct,
            "mem_pct": mem_pct,
            "disk_pct": disk_pct,
            "up_bps": up_bps,
            "down_bps": down_bps,
            "latency_ms": net_quality.get("latency_ms"),
            "packet_loss_pct": net_quality.get("packet_loss_percent"),
            "failed_logins": failed_logins,
        }
    }


async def host_sampler_loop() -> None:
    """Background sampling loop feeding telemetry into the ingestion pipeline."""
    from collector.routes import ingest_raw

    logger.info("Host telemetry sampler started (Interval: %ds, Service: %s)",
                config.COLLECTION_INTERVAL_SECONDS, config.SERVICE_NAME)

    while True:
        try:
            interval = max(2, config.COLLECTION_INTERVAL_SECONDS)
            await asyncio.sleep(interval)

            if _collector_paused:
                continue

            sample = collect_host_sample()
            # Push primary system telemetry record
            await ingest_raw(sample["record"])

            # Push any security telemetry records
            for extra in sample.get("extras", []):
                await ingest_raw(extra)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Error in host telemetry sampler: %s", e)
            await asyncio.sleep(5)


def start_host_sampler() -> None:
    """Start the host telemetry collection loop."""
    global _host_task
    if _host_task is None or _host_task.done():
        _host_task = asyncio.create_task(host_sampler_loop())
