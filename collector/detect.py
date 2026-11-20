import sqlite3
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple
from collector.store import store_detection, get_connection

def get_recent_auth_failures_60s(now_iso: str = None) -> Dict[str, List[Dict[str, Any]]]:
    """
    Queries raw_records for kind='auth' within the last 60 seconds from the database.
    Returns {source_id: [records]}
    """
    if not now_iso:
        now_dt = datetime.now(timezone.utc)
    else:
        try:
            now_dt = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
        except Exception:
            now_dt = datetime.now(timezone.utc)

    cutoff_iso = (now_dt - timedelta(seconds=60)).isoformat().replace("+00:00", "Z")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT source_id, raw_json
        FROM raw_records
        WHERE kind = 'auth' AND received_utc >= ?
        ORDER BY id ASC
    """, (cutoff_iso,))
    rows = cursor.fetchall()
    conn.close()

    failures_by_source: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        sid = r["source_id"]
        try:
            rec = json.loads(r["raw_json"])
            if rec.get("outcome") == "failure":
                failures_by_source.setdefault(sid, []).append(rec)
        except Exception:
            pass

    return failures_by_source

def detect_events_in_window(window_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyzes telemetry locally:
    1. Failed-login bursts:
       Sliding 60 s window across recent auth failures.
       Also incorporates any auth failures in the current window_records.
       If >= 5 -> event 'failed_login_burst' (severity high, or critical if >= 20).
       Summary is strictly templated: f"{n} failed logins in 60s on {sid} from {k} distinct origins".
       Forensics (usernames/IPs) are saved only in local detections table.
    2. Recurring warnings:
       kind='log', level in ('WARN', 'WARNING', 'ERROR'). Count per source.
    3. Availability drops:
       service_up is False -> service_down event.
       connectivity_ok is False -> link_down event.
    """
    events: List[Dict[str, Any]] = []
    auth_failures_by_source: Dict[str, List[Dict[str, Any]]] = {}
    warning_counts_by_source: Dict[str, int] = {}
    service_down_sources: Dict[str, str] = {}
    link_down_sources: Dict[str, str] = {}

    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # 1. Collect records in current window
    for rec in window_records:
        sid = rec.get("source_id")
        if not sid:
            continue
        kind = rec.get("kind")
        ts = rec.get("ts", now_iso)

        if kind == "auth":
            if rec.get("outcome") == "failure":
                auth_failures_by_source.setdefault(sid, []).append(rec)

        elif kind == "log":
            lvl = str(rec.get("level", "")).upper()
            if lvl in ("WARN", "WARNING", "ERROR"):
                warning_counts_by_source[sid] = warning_counts_by_source.get(sid, 0) + 1

        elif kind in ("metric", "flow"):
            metrics = rec.get("metrics") or {}
            if metrics.get("service_up") is False:
                service_down_sources[sid] = ts
            if metrics.get("connectivity_ok") is False:
                link_down_sources[sid] = ts

    # Check database 60s sliding window for auth failures
    try:
        db_failures = get_recent_auth_failures_60s(now_iso)
        for sid, records in db_failures.items():
            existing = auth_failures_by_source.setdefault(sid, [])
            # Combine without duplicating identical objects
            seen_ts_user = {(r.get("ts"), r.get("user")) for r in existing}
            for rec in records:
                key = (rec.get("ts"), rec.get("user"))
                if key not in seen_ts_user:
                    existing.append(rec)
                    seen_ts_user.add(key)
    except Exception as e:
        # Graceful fallback to window-only in tests where db may be isolated
        pass

    # 1. Evaluate Failed logins (>= 5 in 60s)
    for sid, failures in auth_failures_by_source.items():
        n = len(failures)
        if n >= 5:
            severity = "critical" if n >= 20 else "high"
            distinct_origins = len(set(f.get("src_ip") for f in failures if f.get("src_ip")))
            distinct_users = len(set(f.get("user") for f in failures if f.get("user")))
            summary = f"{n} failed logins in 60s on {sid} from {distinct_origins} distinct origins"

            # Store full sensitive details LOCALLY ONLY
            local_details = {
                "users": [f.get("user") for f in failures],
                "src_ips": [f.get("src_ip") for f in failures],
                "distinct_origins": distinct_origins,
                "distinct_users": distinct_users,
                "failure_count": n
            }
            try:
                store_detection(
                    detected_utc=now_iso,
                    source_id=sid,
                    category="auth",
                    severity=severity,
                    event_type="failed_login_burst",
                    count=n,
                    summary=summary,
                    local_details=local_details
                )
            except Exception:
                pass

            # Allow-listed clean event for payload
            events.append({
                "event_id": str(uuid.uuid4()),
                "event_time_utc": failures[-1].get("ts", now_iso),
                "source_id": sid,
                "category": "auth",
                "severity": severity,
                "type": "failed_login_burst",
                "count": n,
                "summary": summary
            })

    # 2. Warning recurring
    for sid, count in warning_counts_by_source.items():
        if count >= 3:
            events.append({
                "event_id": str(uuid.uuid4()),
                "event_time_utc": now_iso,
                "source_id": sid,
                "category": "resource",
                "severity": "medium",
                "type": "warning_recurring",
                "count": count,
                "summary": f"{count} warning/error log lines detected on {sid}"
            })

    # 3. Service down
    for sid, ts in service_down_sources.items():
        events.append({
            "event_id": str(uuid.uuid4()),
            "event_time_utc": ts,
            "source_id": sid,
            "category": "availability",
            "severity": "critical",
            "type": "service_down",
            "count": 1,
            "summary": f"Service availability check reported down on {sid}"
        })

    # 4. Link down
    for sid, ts in link_down_sources.items():
        events.append({
            "event_id": str(uuid.uuid4()),
            "event_time_utc": ts,
            "source_id": sid,
            "category": "network",
            "severity": "high",
            "type": "link_down",
            "count": 1,
            "summary": f"Network connectivity failure reported on {sid}"
        })

    return events
