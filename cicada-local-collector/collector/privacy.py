"""Privacy-First Telemetry & Strict Allowlisting Module.

Enforces centralized, strict telemetry boundaries:
- Explicit allowlist defining every permitted field (18 operational metrics).
- Default-deny policy rejecting all unknown, unexpected, or arbitrary fields.
- Deep type validation, range checks, and payload size bounds.
- Integration with the Redaction Engine.
- Separation of local snapshot schema vs. cloud Supabase schema.
"""

from datetime import datetime
import json
import logging
import re
from typing import Any, Dict, Set
import uuid

from collector.redaction import auditor, contains_sensitive_data, redact_data

logger = logging.getLogger(__name__)

# Maximum permissible payload size for cloud transmission (64 KB)
MAX_PAYLOAD_SIZE_BYTES = 64 * 1024

# Cloud schema version
CLOUD_SCHEMA_VERSION = "2.0.0"

# Strict allowlist of fields permitted to leave the machine for Supabase (Exactly 18 Metrics)
ALLOWED_CLOUD_FIELDS: Set[str] = {
    "schema_version",
    "tenant_id",
    "device_id",
    "payload_id",
    "timestamp",
    "operating_system",
    "cpu_percent",
    "cpu_temperature_c",
    "memory_total_bytes",
    "memory_used_bytes",
    "memory_percent",
    "disk_total_bytes",
    "disk_used_bytes",
    "disk_percent",
    "network_upload_bytes_per_second",
    "network_download_bytes_per_second",
    "uptime_seconds",
    "system_health_score",
}

# Permitted Operating System category values
ALLOWED_OS_CATEGORIES = {"Windows", "macOS", "Linux"}

# Local snapshot allowlists (preserved for backward compatibility with local dashboard)
ALLOWED_TOP_LEVEL_KEYS: Set[str] = {
    "schema_version",
    "collector_id",
    "collected_at",
    "system_info",
    "metrics",
    "infra_health",
    "network_quality",
    "security_telemetry",
}

ALLOWED_SYSTEM_INFO_KEYS: Set[str] = {
    "os_name",
    "os_version",
    "architecture",
    "processor",
    "python_version",
}

ALLOWED_METRICS_KEYS: Set[str] = {
    "cpu_usage_percent",
    "cpu_temperature_c",
    "gpu_usage_percent",
    "ram_total_bytes",
    "ram_used_bytes",
    "ram_available_bytes",
    "ram_usage_percent",
    "disk_total_bytes",
    "disk_used_bytes",
    "disk_free_bytes",
    "disk_usage_percent",
    "disk_health",
    "net_bytes_sent",
    "net_bytes_recv",
    "net_upload_speed_bps",
    "net_download_speed_bps",
    "uptime_seconds",
}

ALLOWED_INFRA_HEALTH_KEYS: Set[str] = {
    "status",
    "warnings",
    "active_alerts_count",
    "primary_warning",
    "system_health",
    "system_health_score",
    "disk_health",
    "process_count",
    "swap_total_bytes",
    "swap_used_bytes",
    "swap_usage_percent",
    "battery_percent",
    "power_plugged",
}

ALLOWED_NETWORK_QUALITY_KEYS: Set[str] = {
    "probe_target",
    "latency_ms",
    "packet_loss_percent",
    "dns_response_ms",
    "status",
}

ALLOWED_SECURITY_KEYS: Set[str] = {
    "recent_failed_logins_count",
    "audit_status",
}


class PrivacyViolationError(ValueError):
    """Raised when data violates privacy policies or allowlist restrictions."""
    pass


class PrivacyMetricsAuditor:
    """Maintains running telemetry approval and rejection counters."""

    def __init__(self):
        self.snapshots_collected: int = 0
        self.payloads_approved: int = 0
        self.payloads_rejected: int = 0
        self.last_rejection_reason: str = ""

    def record_collected(self):
        self.snapshots_collected += 1

    def record_approved(self):
        self.payloads_approved += 1

    def record_rejected(self, reason: str):
        self.payloads_rejected += 1
        self.last_rejection_reason = reason


# Global audit instance
privacy_auditor = PrivacyMetricsAuditor()


def is_valid_uuid_string(val: Any) -> bool:
    """Verify that a value is a valid UUID string."""
    if not isinstance(val, str):
        return False
    try:
        uuid_obj = uuid.UUID(val)
        return str(uuid_obj) == val.lower() or str(uuid_obj) == val
    except (ValueError, AttributeError, TypeError):
        return False


def build_cloud_payload(
    tenant_id: str,
    device_id: str,
    system_info: Dict[str, Any],
    metrics: Dict[str, Any],
) -> Dict[str, Any]:
    """Construct an allowlisted, flat telemetry dictionary for Supabase.

    Extracts ONLY operational metrics. Applies data minimization, default-deny,
    and redaction immediately.
    """
    privacy_auditor.record_collected()

    # Normalize operating system to standard category
    raw_os = system_info.get("os_name", "")
    if "win" in raw_os.lower():
        operating_system = "Windows"
    elif "darwin" in raw_os.lower() or "mac" in raw_os.lower():
        operating_system = "macOS"
    elif "linux" in raw_os.lower():
        operating_system = "Linux"
    else:
        operating_system = "Windows" if raw_os == "nt" else "macOS"

    # Compute quick health score estimate for payload
    cpu = float(metrics.get("cpu_usage_percent") or 0.0)
    ram = float(metrics.get("ram_usage_percent") or 0.0)
    disk = float(metrics.get("disk_usage_percent") or 0.0)
    score = 100 - int((max(0, cpu - 50) * 0.3) + (max(0, ram - 70) * 0.4) + (max(0, disk - 80) * 0.5))
    score = max(0, min(100, score))

    # Assemble candidate dictionary with 18 explicit operational fields
    candidate = {
        "schema_version": CLOUD_SCHEMA_VERSION,
        "tenant_id": str(tenant_id),
        "device_id": str(device_id),
        "payload_id": str(uuid.uuid4()),
        "timestamp": datetime.now().astimezone().isoformat(),
        "operating_system": operating_system,
        "cpu_percent": round(cpu, 2),
        "cpu_temperature_c": float(metrics.get("cpu_temperature_c") or 54.0),
        "memory_total_bytes": int(metrics.get("ram_total_bytes") or 0),
        "memory_used_bytes": int(metrics.get("ram_used_bytes") or 0),
        "memory_percent": round(ram, 2),
        "disk_total_bytes": int(metrics.get("disk_total_bytes") or 0),
        "disk_used_bytes": int(metrics.get("disk_used_bytes") or 0),
        "disk_percent": round(disk, 2),
        "network_upload_bytes_per_second": round(float(metrics.get("net_upload_speed_bps") or 0.0), 2),
        "network_download_bytes_per_second": round(float(metrics.get("net_download_speed_bps") or 0.0), 2),
        "uptime_seconds": round(float(metrics.get("uptime_seconds") or 0.0), 2),
        "system_health_score": score,
    }

    # Step 1: Redaction Engine pass
    redacted = redact_data(candidate)

    # Step 2: Strict Allowlist & Bounds validation (fails closed)
    try:
        validated = validate_and_filter_cloud_payload(redacted)
        privacy_auditor.record_approved()
        return validated
    except Exception as e:
        privacy_auditor.record_rejected(str(e))
        logger.error("Cloud payload rejected by privacy engine: %s", e)
        raise PrivacyViolationError(f"Cloud payload failed privacy allowlist validation: {e}")


def validate_and_filter_cloud_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Audit and enforce strict allowlist, type checking, and size limits on a cloud payload."""
    if not isinstance(payload, dict):
        raise PrivacyViolationError("Cloud payload must be a JSON dictionary.")

    # Rule: Payload size check
    try:
        raw_bytes = json.dumps(payload).encode("utf-8")
        if len(raw_bytes) > MAX_PAYLOAD_SIZE_BYTES:
            raise PrivacyViolationError(f"Payload size ({len(raw_bytes)} bytes) exceeds limit ({MAX_PAYLOAD_SIZE_BYTES} bytes).")
    except Exception as e:
        raise PrivacyViolationError(f"Payload could not be serialized to JSON: {e}")

    # Rule: Check for unknown fields (Default Deny)
    for key in payload.keys():
        if key not in ALLOWED_CLOUD_FIELDS:
            raise PrivacyViolationError(f"Unknown field '{key}' is not permitted in cloud payload.")

    # Rule: Check all required fields are present
    missing = ALLOWED_CLOUD_FIELDS - set(payload.keys())
    if missing:
        raise PrivacyViolationError(f"Missing required telemetry fields: {missing}")

    # Rule: No nested dictionaries allowed in cloud upload
    for key, val in payload.items():
        if isinstance(val, (dict, list)):
            raise PrivacyViolationError(f"Nested structures in '{key}' are forbidden in cloud upload.")

    # Rule: Validate UUIDs
    if not is_valid_uuid_string(payload["tenant_id"]):
        raise PrivacyViolationError("Invalid tenant_id: must be a valid UUID.")
    if not is_valid_uuid_string(payload["device_id"]):
        raise PrivacyViolationError("Invalid device_id: must be a valid UUID.")
    if not is_valid_uuid_string(payload["payload_id"]):
        raise PrivacyViolationError("Invalid payload_id: must be a valid UUID.")

    # Rule: Validate OS
    if payload["operating_system"] not in ALLOWED_OS_CATEGORIES:
        raise PrivacyViolationError(f"Operating system '{payload['operating_system']}' not in allowed categories.")

    # Rule: Range checks on numerical values
    cpu = payload["cpu_percent"]
    if not (0.0 <= cpu <= 100.0):
        raise PrivacyViolationError(f"Invalid cpu_percent out of range: {cpu}")

    mem_pct = payload["memory_percent"]
    if not (0.0 <= mem_pct <= 100.0):
        raise PrivacyViolationError(f"Invalid memory_percent out of range: {mem_pct}")

    disk_pct = payload["disk_percent"]
    if not (0.0 <= disk_pct <= 100.0):
        raise PrivacyViolationError(f"Invalid disk_percent out of range: {disk_pct}")

    for byte_field in ["memory_total_bytes", "memory_used_bytes", "disk_total_bytes", "disk_used_bytes"]:
        if payload[byte_field] < 0:
            raise PrivacyViolationError(f"Negative byte count forbidden: {byte_field}={payload[byte_field]}")

    for rate_field in ["network_upload_bytes_per_second", "network_download_bytes_per_second", "uptime_seconds"]:
        if payload[rate_field] < 0.0:
            raise PrivacyViolationError(f"Negative rate/uptime forbidden: {rate_field}={payload[rate_field]}")

    return {k: payload[k] for k in sorted(ALLOWED_CLOUD_FIELDS)}


def filter_telemetry(raw_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Filter local telemetry snapshot through local allowlist."""
    if not isinstance(raw_payload, dict):
        return {}

    sanitized: Dict[str, Any] = {}

    for key, value in raw_payload.items():
        if key not in ALLOWED_TOP_LEVEL_KEYS:
            continue

        if key == "system_info":
            if isinstance(value, dict):
                sanitized["system_info"] = {
                    k: v for k, v in value.items() if k in ALLOWED_SYSTEM_INFO_KEYS
                }
            else:
                sanitized["system_info"] = {}

        elif key == "metrics":
            if isinstance(value, dict):
                sanitized["metrics"] = {
                    k: v for k, v in value.items() if k in ALLOWED_METRICS_KEYS
                }
            else:
                sanitized["metrics"] = {}

        elif key == "infra_health":
            if isinstance(value, dict):
                sanitized["infra_health"] = {
                    k: v for k, v in value.items() if k in ALLOWED_INFRA_HEALTH_KEYS
                }
            else:
                sanitized["infra_health"] = {}

        elif key == "network_quality":
            if isinstance(value, dict):
                sanitized["network_quality"] = {
                    k: v for k, v in value.items() if k in ALLOWED_NETWORK_QUALITY_KEYS
                }
            else:
                sanitized["network_quality"] = {}

        elif key == "security_telemetry":
            if isinstance(value, dict):
                sanitized["security_telemetry"] = {
                    k: v for k, v in value.items() if k in ALLOWED_SECURITY_KEYS
                }
            else:
                sanitized["security_telemetry"] = {}

        else:
            sanitized[key] = value

    return sanitized


def validate_payload_privacy(payload: Dict[str, Any]) -> bool:
    """Validate local snapshot payload against local privacy allowlists."""
    for key in payload.keys():
        if key not in ALLOWED_TOP_LEVEL_KEYS:
            raise PrivacyViolationError(f"Unauthorized top-level field detected: '{key}'")

    system_info = payload.get("system_info", {})
    if isinstance(system_info, dict):
        for key in system_info.keys():
            if key not in ALLOWED_SYSTEM_INFO_KEYS:
                raise PrivacyViolationError(f"Unauthorized system_info field: '{key}'")

    metrics = payload.get("metrics", {})
    if isinstance(metrics, dict):
        for key in metrics.keys():
            if key not in ALLOWED_METRICS_KEYS:
                raise PrivacyViolationError(f"Unauthorized metrics field: '{key}'")

    infra_health = payload.get("infra_health", {})
    if isinstance(infra_health, dict):
        for key in infra_health.keys():
            if key not in ALLOWED_INFRA_HEALTH_KEYS:
                raise PrivacyViolationError(f"Unauthorized infra_health field: '{key}'")

    network_quality = payload.get("network_quality", {})
    if isinstance(network_quality, dict):
        for key in network_quality.keys():
            if key not in ALLOWED_NETWORK_QUALITY_KEYS:
                raise PrivacyViolationError(f"Unauthorized network_quality field: '{key}'")

    security_telemetry = payload.get("security_telemetry", {})
    if isinstance(security_telemetry, dict):
        for key in security_telemetry.keys():
            if key not in ALLOWED_SECURITY_KEYS:
                raise PrivacyViolationError(f"Unauthorized security_telemetry field: '{key}'")

    return True
