import sqlite3
import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from collector.config import settings

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(settings.DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS raw_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            received_utc TEXT NOT NULL,
            kind TEXT,
            host TEXT,
            source_id TEXT,
            raw_json TEXT NOT NULL,
            redacted_json TEXT NOT NULL,
            regex_catches INTEGER DEFAULT 0,
            ai_catches INTEGER DEFAULT 0
        )
    """)
    # Ensure columns exist if table was already created
    try:
        cursor.execute("ALTER TABLE raw_records ADD COLUMN regex_catches INTEGER DEFAULT 0")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE raw_records ADD COLUMN ai_catches INTEGER DEFAULT 0")
    except Exception:
        pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            detected_utc TEXT NOT NULL,
            source_id TEXT NOT NULL,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            type TEXT NOT NULL,
            count INTEGER NOT NULL,
            summary TEXT NOT NULL,
            local_details_json TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS egress_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payload_id TEXT NOT NULL UNIQUE,
            seq INTEGER,
            sent_at_utc TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            attempts INTEGER DEFAULT 1,
            result TEXT,
            body TEXT NOT NULL
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_received ON raw_records(received_utc)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_kind ON raw_records(kind)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_detections_time ON detections(detected_utc)")
    conn.commit()
    conn.close()

# Ensure DB tables are initialized on import as well
init_db()

def store_raw_record(
    received_utc: str,
    kind: str,
    host: str,
    sid: str,
    raw_obj: Dict[str, Any],
    redacted_obj: Dict[str, Any],
    regex_catches: int = 0,
    ai_catches: int = 0
) -> int:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO raw_records (received_utc, kind, host, source_id, raw_json, redacted_json, regex_catches, ai_catches)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        received_utc,
        kind,
        host,
        sid,
        json.dumps(raw_obj, separators=(',', ':')),
        json.dumps(redacted_obj, separators=(',', ':')),
        regex_catches,
        ai_catches
    ))
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return record_id

def get_raw_records(limit: int = 50) -> List[Dict[str, Any]]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, received_utc, kind, host, source_id, raw_json, redacted_json, regex_catches, ai_catches
        FROM raw_records
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "received_utc": r["received_utc"],
            "kind": r["kind"],
            "host": r["host"],
            "source_id": r["source_id"],
            "raw": json.loads(r["raw_json"]),
            "redacted": json.loads(r["redacted_json"]),
            "regex_catches": r["regex_catches"] if "regex_catches" in r.keys() else 0,
            "ai_catches": r["ai_catches"] if "ai_catches" in r.keys() else 0
        })
    return result

def store_detection(detected_utc: str, source_id: str, category: str, severity: str,
                    event_type: str, count: int, summary: str, local_details: Dict[str, Any]) -> int:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO detections (detected_utc, source_id, category, severity, type, count, summary, local_details_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        detected_utc,
        source_id,
        category,
        severity,
        event_type,
        count,
        summary,
        json.dumps(local_details, separators=(',', ':'))
    ))
    det_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return det_id

def get_detections(limit: int = 50) -> List[Dict[str, Any]]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, detected_utc, source_id, category, severity, type, count, summary, local_details_json
        FROM detections
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "detected_utc": r["detected_utc"],
            "source_id": r["source_id"],
            "category": r["category"],
            "severity": r["severity"],
            "type": r["type"],
            "count": r["count"],
            "summary": r["summary"],
            "local_details": json.loads(r["local_details_json"])
        })
    return result

def store_egress_payload(payload_id: str, seq: int, sent_at_utc: str, sha256_hash: str, body_str: str, result: str = "sent"):
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO egress_audit (payload_id, seq, sent_at_utc, sha256, attempts, result, body)
        VALUES (?, ?, ?, ?, 1, ?, ?)
    """, (payload_id, seq, sent_at_utc, sha256_hash, result, body_str))
    conn.commit()
    conn.close()

def get_egress_records(limit: int = 20) -> List[Dict[str, Any]]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT payload_id, seq, sent_at_utc, sha256, attempts, result, body
        FROM egress_audit
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_egress_by_id(payload_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT payload_id, seq, sent_at_utc, sha256, attempts, result, body
        FROM egress_audit
        WHERE payload_id = ?
    """, (payload_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def purge_old_records(retention_hours: int = 24):
    init_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=retention_hours)).isoformat().replace("+00:00", "Z")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM raw_records WHERE received_utc < ?", (cutoff,))
    cursor.execute("DELETE FROM detections WHERE detected_utc < ?", (cutoff,))
    conn.commit()
    conn.close()
