import json
import hashlib
from typing import Dict, Any
from collector.config import settings
from collector.store import store_egress_payload

def submit(payload: Dict[str, Any]) -> bool:
    """
    Submits the MetadataPayload to transport.
    In Collector standalone / local mode, it logs to collector/data/pending_payloads.jsonl
    and records in the egress_audit store for the local egress proof panel.
    When Transport (Person B) provides their real submit handler, it will plug into this interface.
    """
    body_str = json.dumps(payload, separators=(',', ':'))
    sha256_hash = hashlib.sha256(body_str.encode("utf-8")).hexdigest()

    # Append to pending payloads
    with open(settings.PENDING_PAYLOADS_PATH, "a", encoding="utf-8") as f:
        f.write(body_str + "\n")

    # Store in local egress audit
    store_egress_payload(
        payload_id=payload["payload_id"],
        seq=payload.get("seq", 1),
        sent_at_utc=payload.get("sent_at_utc", ""),
        sha256_hash=sha256_hash,
        body_str=body_str,
        result="queued"
    )
    return True
