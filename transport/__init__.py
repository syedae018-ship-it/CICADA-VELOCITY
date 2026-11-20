"""Collector → SaaS transport. Owner: Person B (see docs/members/PERSON_B_transport_ingest.md).

Public API used by the collector (Person A):
    submit(payload: dict) -> str     # returns payload_id; never raises on SaaS outage

Until Person B implements the real outbox, this stub appends payloads to
collector/data/pending_payloads.jsonl so Person A can build and test independently.
"""
import json
import uuid
from pathlib import Path

_FALLBACK = Path("collector/data/pending_payloads.jsonl")


async def startup() -> None:
    """Called once when the collector starts. TODO(Person B): start sender loop + heartbeat tasks."""
    return None


def submit(payload: dict) -> str:
    """TODO(Person B): assign payload_id/seq/sent_at_utc, validate, write outbox + egress_log, send."""
    payload_id = payload.get("payload_id") or str(uuid.uuid4())
    _FALLBACK.parent.mkdir(parents=True, exist_ok=True)
    with _FALLBACK.open("a") as f:
        f.write(json.dumps({**payload, "payload_id": payload_id}) + "\n")
    return payload_id
