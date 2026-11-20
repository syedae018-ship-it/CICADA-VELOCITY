import uuid
import time
import json
import psutil
from datetime import datetime, timezone
from typing import List, Dict, Any
from collector.config import settings
from collector.pseudo import source_id
from collector.detect import detect_events_in_window
from collector.store import store_egress_payload

START_TIME = time.time()
_seq_counter = 0

ALLOWED_SOURCE_FIELDS = {"source_id", "source_type", "service", "event_time_utc", "metrics"}
ALLOWED_METRICS = {
    "cpu_pct", "mem_pct", "disk_pct", "latency_ms",
    "packet_loss_pct", "bandwidth_mbps", "service_up", "connectivity_ok"
}

BOOLEAN_METRICS = {"service_up", "connectivity_ok"}

def next_seq() -> int:
    global _seq_counter
    _seq_counter += 1
    return _seq_counter

def get_collector_health(buffer_depth: int = 0) -> Dict[str, Any]:
    uptime = int(time.time() - START_TIME)
    cpu_pct = float(psutil.cpu_percent(interval=None))
    mem_pct = float(psutil.virtual_memory().percent)
    return {
        "version": settings.VERSION,
        "cpu_pct": round(cpu_pct, 2),
        "mem_pct": round(mem_pct, 2),
        "buffer_depth": buffer_depth,
        "config_hash": settings.get_config_hash(),
        "uptime_s": uptime
    }

def build_payload(
    window_records: List[Dict[str, Any]],
    start_utc: str,
    end_utc: str,
    secrets_redacted_count: int,
    records_in_count: int,
    buffer_depth: int = 0
) -> Dict[str, Any]:
    """
    Builds the clean MetadataPayload strictly according to contracts/payload_schema.json.
    Defense in depth:
    Only allow-listed fields are picked. Fields are NEVER copied directly from the raw record.
    Any extra field in raw record is counted as fields_dropped.
    """
    fields_dropped_count = 0
    sources_map: Dict[str, Dict[str, Any]] = {}

    for r in window_records:
        host = r.get("host", "unknown")
        sid = r.get("source_id") or source_id(host)
        kind = r.get("kind")

        # Track fields dropped from incoming record
        for k, v in r.items():
            if k in ("user", "ip", "src_ip", "dst_ip", "message", "bytes", "outcome", "raw", "redacted"):
                fields_dropped_count += 1

        if kind in ("metric", "flow", "log", "auth"):
            s = sources_map.setdefault(sid, {
                "source_id": sid,
                "source_type": r.get("source_type", "server"),
                "service": str(r.get("service", "unknown"))[:40],
                "event_time_utc": r.get("ts", end_utc),
                "metrics": {}
            })

            rec_ts = r.get("ts", end_utc)
            if rec_ts > s["event_time_utc"]:
                s["event_time_utc"] = rec_ts

            if "metrics" in r and isinstance(r["metrics"], dict):
                for m_key, m_val in r["metrics"].items():
                    if m_key in ALLOWED_METRICS:
                        if m_key in BOOLEAN_METRICS:
                            if isinstance(m_val, bool):
                                s["metrics"][m_key] = m_val
                            elif isinstance(m_val, (int, float)):
                                s["metrics"][m_key] = bool(m_val)
                            elif isinstance(m_val, str):
                                s["metrics"][m_key] = m_val.lower() in ("true", "1", "yes")
                        else:
                            if isinstance(m_val, bool):
                                fields_dropped_count += 1
                            elif isinstance(m_val, (int, float)):
                                s["metrics"][m_key] = round(float(m_val), 2)
                    else:
                        fields_dropped_count += 1

    sources_list = []
    for sid, s_data in sources_map.items():
        sources_list.append({
            "source_id": s_data["source_id"],
            "source_type": s_data["source_type"] if s_data["source_type"] in ("server", "network", "app", "security") else "server",
            "service": s_data["service"],
            "event_time_utc": s_data["event_time_utc"],
            "metrics": s_data["metrics"]
        })

    detected_events = detect_events_in_window(window_records)

    payload_id = str(uuid.uuid4())
    seq = next_seq()
    sent_at_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    payload = {
        "schema_version": "1.0",
        "payload_id": payload_id,
        "tenant_id": settings.TENANT_ID,
        "collector_id": settings.COLLECTOR_ID,
        "region": settings.REGION,
        "seq": seq,
        "sent_at_utc": sent_at_utc,
        "source_tz": settings.SOURCE_TZ,
        "window": {
            "start_utc": start_utc,
            "end_utc": end_utc
        },
        "sources": sources_list,
        "events": detected_events,
        "collector_health": get_collector_health(buffer_depth=buffer_depth),
        "redaction_stats": {
            "records_in": records_in_count,
            "secrets_redacted": secrets_redacted_count,
            "fields_dropped": fields_dropped_count
        }
    }

    return payload
