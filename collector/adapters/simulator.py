from typing import Dict, Any
from datetime import datetime, timezone
from collector.pseudo import source_id

def adapt_to_raw_record(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes any organizer stream or simulated JSON into the canonical internal RawRecord format:
    {
       "kind": "metric | log | auth | flow | heartbeat",
       "ts": "...",
       "host": "...",
       "ip": "...",
       "service": "...",
       "source_type": "server | network | app | security",
       "metrics": {...},
       "message": "...",
       "user": "...",
       "src_ip": "...",
       "outcome": "...",
       ...
    }
    """
    ts = payload.get("ts") or payload.get("timestamp") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    host = payload.get("host") or payload.get("hostname") or "unknown-host"
    source_type = payload.get("source_type") or "server"
    if source_type not in ("server", "network", "app", "security"):
        source_type = "server"

    kind = payload.get("kind")
    if not kind:
        if "metrics" in payload:
            kind = "metric"
        elif "message" in payload or "level" in payload:
            kind = "log"
        elif "outcome" in payload or "user" in payload:
            kind = "auth"
        elif "bytes" in payload or "src_ip" in payload:
            kind = "flow"
        else:
            kind = "metric"

    rec = dict(payload)
    rec["kind"] = kind
    rec["ts"] = ts
    rec["host"] = host
    rec["source_type"] = source_type
    rec["source_id"] = source_id(host)
    return rec
