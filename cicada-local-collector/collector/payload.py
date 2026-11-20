"""Telemetry Payload Module.

Constructs versioned, sanitized JSON telemetry payloads ready for local storage
and future CICADA backend integration.
"""

from datetime import datetime, timezone
import json
import logging
import os
import tempfile
from typing import Any, Dict, Optional

from collector.paths import get_local_snapshot_path
from collector.privacy import filter_telemetry, validate_payload_privacy

logger = logging.getLogger(__name__)

SCHEMA_VERSION = "1.1.0"


def build_telemetry_payload(
    collector_id: str,
    system_info: Dict[str, Any],
    metrics: Dict[str, Any],
    infra_health: Optional[Dict[str, Any]] = None,
    network_quality: Optional[Dict[str, Any]] = None,
    security_telemetry: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Assemble and privacy-filter a structured telemetry snapshot."""
    raw_payload: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "collector_id": collector_id,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "system_info": system_info,
        "metrics": metrics,
    }

    if infra_health is not None:
        raw_payload["infra_health"] = infra_health

    if network_quality is not None:
        raw_payload["network_quality"] = network_quality

    if security_telemetry is not None:
        raw_payload["security_telemetry"] = security_telemetry

    # Strict allowlist filtering (default-deny)
    sanitized = filter_telemetry(raw_payload)

    # Secondary verification check
    validate_payload_privacy(sanitized)

    return sanitized


def save_telemetry_snapshot(
    payload: Dict[str, Any],
    file_path: Optional[str] = None,
) -> bool:
    """Save an approved telemetry snapshot to a local JSON file."""
    target_path = file_path or get_local_snapshot_path()
    try:
        target_dir = os.path.dirname(target_path)
        if target_dir:
            os.makedirs(target_dir, exist_ok=True)

        dir_to_use = target_dir if target_dir else "."
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=dir_to_use,
            delete=False,
            suffix=".tmp",
        ) as tmp_file:
            json.dump(payload, tmp_file, indent=2)
            tmp_path = tmp_file.name

        os.replace(tmp_path, target_path)
        return True

    except Exception as e:
        logger.error("Failed to save telemetry snapshot to '%s': %s", target_path, e)
        try:
            with open(target_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            return True
        except Exception as direct_err:
            logger.error("Direct write fallback also failed: %s", direct_err)
            return False
