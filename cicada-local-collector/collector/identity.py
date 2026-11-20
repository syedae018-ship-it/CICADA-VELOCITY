"""Collector Identity Module.

Manages persistent, anonymous collector identification.
A random UUIDv4 is generated on first run and stored locally.
Machine hostnames and personal identifiers are never stored or transmitted.
"""

import json
import logging
import os
import uuid
from typing import Optional

from collector.paths import get_collector_id_path

logger = logging.getLogger(__name__)


def is_valid_uuid(val: str) -> bool:
    """Check if the string is a valid UUID."""
    try:
        uuid_obj = uuid.UUID(val, version=4)
        return str(uuid_obj) == val
    except (ValueError, AttributeError, TypeError):
        return False


def get_or_create_collector_id(storage_path: Optional[str] = None) -> str:
    """Retrieve the existing collector UUID or generate and persist a new one.

    Args:
        storage_path: Path to the JSON identity file. Defaults to AppData/data path.

    Returns:
        A persistent UUIDv4 string.
    """
    path = storage_path or get_collector_id_path()

    # Attempt to load existing ID
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing_id = data.get("collector_id")
                if existing_id and is_valid_uuid(existing_id):
                    return existing_id
                logger.warning("Found invalid collector_id in %s, regenerating.", path)
        except Exception as e:
            logger.warning("Failed to read existing collector ID (%s), generating new one.", e)

    # Generate new random UUIDv4
    new_id = str(uuid.uuid4())

    # Save to disk
    try:
        parent_dir = os.path.dirname(path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)

        payload = {
            "collector_id": new_id,
            "description": "Anonymous CICADA local collector identifier",
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
    except Exception as e:
        logger.error("Could not persist collector ID to %s: %s. Using ephemeral ID.", path, e)

    return new_id
