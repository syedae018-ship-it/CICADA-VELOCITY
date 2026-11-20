"""Infrastructure Health Module.

Evaluates system infrastructure health status based on resource utilization,
swap usage, running process counts, power/battery status, and computes a composite
system health score (0-100).
"""

import logging
from typing import Any, Dict, List, Optional

try:
    import psutil
except ImportError:
    psutil = None

logger = logging.getLogger(__name__)

# Configurable threshold levels (%)
CPU_WARNING_THRESHOLD = 80.0
CPU_CRITICAL_THRESHOLD = 95.0
RAM_WARNING_THRESHOLD = 80.0
RAM_CRITICAL_THRESHOLD = 95.0
DISK_WARNING_THRESHOLD = 85.0
DISK_CRITICAL_THRESHOLD = 95.0


def calculate_system_health_score(metrics: Dict[str, Any]) -> int:
    """Compute a composite system health score between 0 and 100."""
    score = 100.0

    cpu = metrics.get("cpu_usage_percent")
    ram = metrics.get("ram_usage_percent")
    disk = metrics.get("disk_usage_percent")
    temp = metrics.get("cpu_temperature_c")

    # CPU penalty (if above 50%)
    if cpu is not None and cpu > 50.0:
        score -= (cpu - 50.0) * 0.3

    # RAM penalty (if above 70%)
    if ram is not None and ram > 70.0:
        score -= (ram - 70.0) * 0.4

    # Disk penalty (if above 80%)
    if disk is not None and disk > 80.0:
        score -= (disk - 80.0) * 0.5

    # High temperature penalty (if above 80°C)
    if temp is not None and temp > 80.0:
        score -= (temp - 80.0) * 0.5

    return max(0, min(100, int(round(score))))


def check_infrastructure_health(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze resource usage and determine overall health status, score, and alerts."""
    warnings: List[str] = []
    status = "HEALTHY"

    # 1. Process Count
    process_count: Optional[int] = None
    if psutil:
        try:
            process_count = len(psutil.pids())
        except Exception:
            pass

    # 2. Swap Memory
    swap_total: Optional[int] = None
    swap_used: Optional[int] = None
    swap_pct: Optional[float] = None
    if psutil:
        try:
            swap = psutil.swap_memory()
            swap_total = int(swap.total)
            swap_used = int(swap.used)
            swap_pct = float(swap.percent)
        except Exception:
            pass

    # 3. Battery Status
    battery_pct: Optional[float] = None
    power_plugged: Optional[bool] = None
    if psutil:
        try:
            sensors = psutil.sensors_battery()
            if sensors is not None:
                battery_pct = float(sensors.percent)
                power_plugged = bool(sensors.power_plugged)
        except Exception:
            pass

    # 4. Evaluate Thresholds & Alerts
    cpu = metrics.get("cpu_usage_percent")
    ram = metrics.get("ram_usage_percent")
    disk = metrics.get("disk_usage_percent")

    if cpu is not None:
        if cpu >= CPU_CRITICAL_THRESHOLD:
            status = "CRITICAL"
            warnings.append(f"Critical CPU utilization ({cpu:.1f}%)")
        elif cpu >= CPU_WARNING_THRESHOLD:
            if status != "CRITICAL":
                status = "WARNING"
            warnings.append(f"CPU Usage Above {int(CPU_WARNING_THRESHOLD)}%")

    if ram is not None:
        if ram >= RAM_CRITICAL_THRESHOLD:
            status = "CRITICAL"
            warnings.append(f"Critical RAM pressure ({ram:.1f}%)")
        elif ram >= RAM_WARNING_THRESHOLD:
            if status != "CRITICAL":
                status = "WARNING"
            warnings.append(f"RAM Usage Above {int(RAM_WARNING_THRESHOLD)}%")

    if disk is not None:
        if disk >= DISK_CRITICAL_THRESHOLD:
            status = "CRITICAL"
            warnings.append(f"Critical disk usage ({disk:.1f}%)")
        elif disk >= DISK_WARNING_THRESHOLD:
            if status != "CRITICAL":
                status = "WARNING"
            warnings.append(f"Disk Usage Above {int(DISK_WARNING_THRESHOLD)}%")

    # Calculate numeric system health score (e.g. 92/100)
    health_score = calculate_system_health_score(metrics)
    system_health_display = f"{health_score}/100"

    primary_warning = warnings[0] if warnings else "None (All Systems Normal)"
    disk_health = metrics.get("disk_health", "HEALTHY")

    return {
        "status": status,
        "warnings": warnings,
        "active_alerts_count": len(warnings),
        "primary_warning": primary_warning,
        "system_health": system_health_display,
        "system_health_score": health_score,
        "disk_health": disk_health,
        "process_count": process_count,
        "swap_total_bytes": swap_total,
        "swap_used_bytes": swap_used,
        "swap_usage_percent": swap_pct,
        "battery_percent": battery_pct,
        "power_plugged": power_plugged,
    }
