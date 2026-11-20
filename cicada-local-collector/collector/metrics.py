"""Metrics Collection Module.

Collects real, live system telemetry using psutil:
- CPU usage percentage and CPU temperature
- GPU usage percentage (when GPU is present)
- RAM total, used, available, percentage
- Disk total, used, free, percentage, and disk health status
- Network bytes sent and received
- Network upload and download speed
- System uptime

Handles unavailable metrics and missing permissions gracefully without crashing.
"""

import logging
import os
import shutil
import subprocess
import time
from typing import Any, Dict, Optional

from collector.subprocess_util import safe_run_subprocess

try:
    import psutil
except ImportError:
    psutil = None

logger = logging.getLogger(__name__)


def _get_primary_disk_path() -> str:
    """Determine the primary system disk mount point safely."""
    if os.name == "nt":
        try:
            drive = os.path.splitdrive(os.path.abspath("."))[0]
            return f"{drive}\\" if drive else "C:\\"
        except Exception:
            return "C:\\"
    return "/"


def get_cpu_temperature() -> Optional[float]:
    """Retrieve CPU temperature in Celsius across supported platforms."""
    if psutil and hasattr(psutil, "sensors_temperatures"):
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                for name, entries in temps.items():
                    if entries:
                        return round(entries[0].current, 1)
        except Exception:
            pass

    # Windows WMI / thermal zone probe if accessible
    if os.name == "nt":
        try:
            cmd = ["powershell", "-NoProfile", "-Command", 
                   "(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue).CurrentTemperature"]
            proc = safe_run_subprocess(cmd, timeout=1)
            if proc.returncode == 0 and proc.stdout.strip():
                # Kelvin tenths to Celsius
                kelvin_tenth = float(proc.stdout.strip().splitlines()[0])
                celsius = (kelvin_tenth / 10.0) - 273.15
                if 10.0 <= celsius <= 115.0:
                    return round(celsius, 1)
        except Exception:
            pass

    return None


def get_gpu_usage() -> Optional[float]:
    """Retrieve GPU usage percentage when a supported GPU is present."""
    # Check NVIDIA GPU via nvidia-smi
    if shutil.which("nvidia-smi"):
        try:
            proc = safe_run_subprocess(
                ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
                timeout=1,
            )
            if proc.returncode == 0 and proc.stdout.strip():
                return round(float(proc.stdout.strip().splitlines()[0]), 1)
        except Exception:
            pass

    return None


class MetricsCollector:
    """Stateful metrics collector for calculating time-delta rates (e.g., network speed)."""

    def __init__(self):
        self._last_net_time: Optional[float] = None
        self._last_bytes_sent: Optional[int] = None
        self._last_bytes_recv: Optional[int] = None
        self._has_collected_cpu: bool = False

    def collect_metrics(self) -> Dict[str, Any]:
        """Collect a live snapshot of system metrics.

        Returns:
            Dictionary of raw collected metrics with fallback defaults on error.
        """
        metrics: Dict[str, Any] = {
            "cpu_usage_percent": None,
            "cpu_temperature_c": None,
            "gpu_usage_percent": None,
            "ram_total_bytes": None,
            "ram_used_bytes": None,
            "ram_available_bytes": None,
            "ram_usage_percent": None,
            "disk_total_bytes": None,
            "disk_used_bytes": None,
            "disk_free_bytes": None,
            "disk_usage_percent": None,
            "disk_health": "HEALTHY",
            "net_bytes_sent": None,
            "net_bytes_recv": None,
            "net_upload_speed_bps": 0.0,
            "net_download_speed_bps": 0.0,
            "uptime_seconds": None,
        }

        if psutil is None:
            logger.error("psutil is not installed. System metrics cannot be collected.")
            return metrics

        # 1. CPU Usage & Temperature
        try:
            if not self._has_collected_cpu:
                metrics["cpu_usage_percent"] = float(psutil.cpu_percent(interval=0.1))
                self._has_collected_cpu = True
            else:
                metrics["cpu_usage_percent"] = float(psutil.cpu_percent(interval=None))
        except Exception as e:
            logger.warning("Could not collect CPU usage: %s", e)

        try:
            metrics["cpu_temperature_c"] = get_cpu_temperature()
        except Exception:
            pass

        # 2. GPU Usage
        try:
            metrics["gpu_usage_percent"] = get_gpu_usage()
        except Exception:
            pass

        # 3. RAM Usage
        try:
            mem = psutil.virtual_memory()
            metrics["ram_total_bytes"] = int(mem.total)
            metrics["ram_used_bytes"] = int(mem.used)
            metrics["ram_available_bytes"] = int(mem.available)
            metrics["ram_usage_percent"] = float(mem.percent)
        except Exception as e:
            logger.warning("Could not collect RAM metrics: %s", e)

        # 4. Disk Usage & Disk Health
        try:
            disk_path = _get_primary_disk_path()
            disk = psutil.disk_usage(disk_path)
            metrics["disk_total_bytes"] = int(disk.total)
            metrics["disk_used_bytes"] = int(disk.used)
            metrics["disk_free_bytes"] = int(disk.free)
            disk_pct = float(disk.percent)
            metrics["disk_usage_percent"] = disk_pct

            # Determine disk health indicator
            if disk_pct >= 95.0:
                metrics["disk_health"] = "CRITICAL"
            elif disk_pct >= 85.0:
                metrics["disk_health"] = "WARNING"
            else:
                metrics["disk_health"] = "HEALTHY"
        except Exception as e:
            logger.warning("Could not collect Disk metrics: %s", e)
            metrics["disk_health"] = "UNKNOWN"

        # 5. Network I/O and Speeds
        try:
            net_io = psutil.net_io_counters()
            current_time = time.time()
            if net_io:
                bytes_sent = int(net_io.bytes_sent)
                bytes_recv = int(net_io.bytes_recv)
                metrics["net_bytes_sent"] = bytes_sent
                metrics["net_bytes_recv"] = bytes_recv

                if (
                    self._last_net_time is not None
                    and self._last_bytes_sent is not None
                    and self._last_bytes_recv is not None
                ):
                    time_delta = current_time - self._last_net_time
                    if time_delta > 0:
                        sent_delta = bytes_sent - self._last_bytes_sent
                        recv_delta = bytes_recv - self._last_bytes_recv

                        upload_speed = max(0.0, sent_delta / time_delta)
                        download_speed = max(0.0, recv_delta / time_delta)

                        metrics["net_upload_speed_bps"] = round(upload_speed, 2)
                        metrics["net_download_speed_bps"] = round(download_speed, 2)

                self._last_net_time = current_time
                self._last_bytes_sent = bytes_sent
                self._last_bytes_recv = bytes_recv
        except Exception as e:
            logger.warning("Could not collect Network metrics: %s", e)

        # 6. System Uptime
        try:
            boot_time = psutil.boot_time()
            uptime = max(0.0, time.time() - boot_time)
            metrics["uptime_seconds"] = round(uptime, 2)
        except Exception as e:
            logger.warning("Could not collect System uptime: %s", e)

        return metrics
