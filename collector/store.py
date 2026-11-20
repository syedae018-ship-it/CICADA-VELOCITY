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
            redacted_json TEXT NOT NULL
        )
    """)
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
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_received ON raw_records(received_utc)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_kind ON raw_records(kind)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_detections_time ON detections(detected_utc)")
    conn.commit()
    conn.close()

# Ensure DB tables are initialized on import as well
init_db()

def store_raw_record(received_utc: str, kind: str, host: str, sid: str, raw_obj: Dict[str, Any], redacted_obj: Dict[str, Any]) -> int:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO raw_records (received_utc, kind, host, source_id, raw_json, redacted_json)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        received_utc,
        kind,
        host,
        sid,
        json.dumps(raw_obj, separators=(',', ':')),
        json.dumps(redacted_obj, separators=(',', ':'))
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
        SELECT id, received_utc, kind, host, source_id, raw_json, redacted_json
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
            "redacted": json.loads(r["redacted_json"])
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

def purge_old_records(retention_hours: int = 24):
    init_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=retention_hours)).isoformat().replace("+00:00", "Z")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM raw_records WHERE received_utc < ?", (cutoff,))
    cursor.execute("DELETE FROM detections WHERE detected_utc < ?", (cutoff,))
    conn.commit()
    conn.close()
