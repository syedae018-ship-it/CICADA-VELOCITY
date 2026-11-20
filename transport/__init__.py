"""Collector → SaaS transport. Owner: Person B (see docs/members/PERSON_B_transport_ingest.md).

Public API used by the collector (Person A):
    submit(payload: dict) -> str     # returns payload_id; never raises on SaaS outage
    startup() -> None                # boots sender loop and heartbeat worker
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft202012Validator

from transport.db import (
    enqueue_payload,
    get_buffer_stats,
    get_next_seq,
    init_collector_db,
)
from transport.router import router
from transport.sender import (
    get_buffer_depth,
    get_last_sent_utc,
    get_saas_reachable,
    is_saas_link_enabled,
    start_workers,
)

logger = logging.getLogger(__name__)

CONTRACTS_DIR = Path(__file__).resolve().parent.parent / "contracts"
PAYLOAD_SCHEMA = json.loads((CONTRACTS_DIR / "payload_schema.json").read_text())
validator = Draft202012Validator(PAYLOAD_SCHEMA)


async def startup() -> None:
    """Initialize collector SQLite database and start sender and heartbeat background loops."""
    init_collector_db()
    start_workers()


def submit(payload: dict) -> str:
    """Ingest a metadata payload from Person A's collector.
    
    1. Assigns a fresh UUIDv4 payload_id if not already present.
    2. Assigns a monotonic sequence number (seq).
    3. Assigns sent_at_utc (ISO-8601 with Z).
    4. Canonicalizes JSON serialization (exact bytes).
    5. Validates against payload_schema.json (defense in depth):
       - If invalid: routes to dead_letter locally, logs, never raises.
       - If valid: enqueues into persistent SQLite outbox and egress_log.
    6. Returns payload_id.
    """
    init_collector_db()

    payload_id = payload.get("payload_id") or str(uuid.uuid4())
    payload["payload_id"] = payload_id

    # Transport owns the sequence number: always use the persistent, restart-safe counter
    # (the collector's own counter resets on restart and would create false gaps / repeats).
    payload["seq"] = get_next_seq()

    if "sent_at_utc" not in payload or not payload["sent_at_utc"]:
        payload["sent_at_utc"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Canonical byte serialization (sorted keys, compact separators)
    body_str = json.dumps(payload, sort_keys=True, separators=(",", ":"))

    # Validate against schema
    errors = [e.message for e in validator.iter_errors(payload)]
    if errors:
        logger.warning(
            "Payload schema violation (%d errors) for payload %s; moving to dead_letter",
            len(errors),
            payload_id,
        )
        enqueue_payload(
            payload_id=payload_id,
            seq=payload["seq"],
            body=body_str,
            status="dead_letter",
        )
        return payload_id

    # Valid payload: enqueue into outbox
    enqueue_payload(
        payload_id=payload_id,
        seq=payload["seq"],
        body=body_str,
        status="pending",
    )
    return payload_id


__all__ = [
    "submit",
    "startup",
    "router",
    "get_saas_reachable",
    "get_buffer_depth",
    "get_last_sent_utc",
    "is_saas_link_enabled",
]
