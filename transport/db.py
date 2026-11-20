"""Collector-side SQLite storage for outbox, sequence tracking, and egress proof log.

Tables owned by Person B in collector/data/collector.db:
  * outbox (payload_id PK, seq, body, created_utc, attempts, next_retry_utc, status)
  * egress_log (payload_id PK, seq, body, sha256, first_attempt_utc, sent_utc, attempts, result)
  * meta (key PK, val)
"""
import hashlib
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

_DB_PATH = Path("collector/data/collector.db")
_conn: Optional[sqlite3.Connection] = None


def close_conn() -> None:
    global _conn
    if _conn is not None:
        try:
            _conn.close()
        except Exception:
            pass
        _conn = None


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL;")
    return _conn


def init_collector_db() -> None:
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            val INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS outbox (
            payload_id     TEXT PRIMARY KEY,
            seq            INTEGER NOT NULL,
            body           TEXT NOT NULL,
            created_utc    TEXT NOT NULL,
            attempts       INTEGER NOT NULL DEFAULT 0,
            next_retry_utc TEXT NOT NULL,
            status         TEXT NOT NULL DEFAULT 'pending'
        );
        CREATE INDEX IF NOT EXISTS outbox_status_seq ON outbox (status, seq);

        CREATE TABLE IF NOT EXISTS egress_log (
            payload_id        TEXT PRIMARY KEY,
            seq               INTEGER NOT NULL,
            body              TEXT NOT NULL,
            sha256            TEXT NOT NULL,
            first_attempt_utc TEXT NOT NULL,
            sent_utc          TEXT,
            attempts          INTEGER NOT NULL DEFAULT 0,
            result            TEXT
        );
        CREATE INDEX IF NOT EXISTS egress_seq ON egress_log (seq DESC);
    """)
    # Initialize sequence if not present
    conn.execute("INSERT OR IGNORE INTO meta (key, val) VALUES ('seq', 100);")
    conn.commit()


def get_next_seq() -> int:
    """Return a strictly monotonic sequence number, persisted across restarts."""
    conn = get_conn()
    with conn:
        row = conn.execute("SELECT val FROM meta WHERE key = 'seq'").fetchone()
        current_seq = row["val"] if row else 100
        next_seq = current_seq + 1
        conn.execute("UPDATE meta SET val = ? WHERE key = 'seq'", (next_seq,))
        return next_seq


def enqueue_payload(
    payload_id: str,
    seq: int,
    body: str,
    status: str = "pending",
) -> None:
    conn = get_conn()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    body_sha256 = hashlib.sha256(body.encode("utf-8")).hexdigest()
    with conn:
        conn.execute(
            """INSERT OR REPLACE INTO outbox
               (payload_id, seq, body, created_utc, attempts, next_retry_utc, status)
               VALUES (?, ?, ?, ?, 0, ?, ?)""",
            (payload_id, seq, body, now, now, status),
        )
        conn.execute(
            """INSERT OR REPLACE INTO egress_log
               (payload_id, seq, body, sha256, first_attempt_utc, attempts, result)
               VALUES (?, ?, ?, ?, ?, 0, ?)""",
            (payload_id, seq, body, body_sha256, now, status if status != "pending" else None),
        )


def get_pending_outbox(limit: int = 50) -> list[dict]:
    conn = get_conn()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    rows = conn.execute(
        """SELECT payload_id, seq, body, attempts, next_retry_utc, status
           FROM outbox
           WHERE status = 'pending' AND next_retry_utc <= ?
           ORDER BY seq ASC LIMIT ?""",
        (now, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def mark_outbox_sent(payload_id: str, attempts: int, result: str) -> None:
    conn = get_conn()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with conn:
        conn.execute("UPDATE outbox SET status = 'sent', attempts = ? WHERE payload_id = ?", (attempts, payload_id))
        conn.execute(
            """UPDATE egress_log
               SET sent_utc = ?, attempts = ?, result = ?
               WHERE payload_id = ?""",
            (now, attempts, result, payload_id),
        )


def mark_outbox_failure(payload_id: str, attempts: int, next_retry_utc: str, result: str) -> None:
    conn = get_conn()
    with conn:
        conn.execute(
            """UPDATE outbox
               SET attempts = ?, next_retry_utc = ?
               WHERE payload_id = ?""",
            (attempts, next_retry_utc, payload_id),
        )
        conn.execute(
            """UPDATE egress_log
               SET attempts = ?, result = ?
               WHERE payload_id = ?""",
            (attempts, result, payload_id),
        )


def mark_outbox_dead_letter(payload_id: str, attempts: int, error: str) -> None:
    conn = get_conn()
    with conn:
        conn.execute(
            "UPDATE outbox SET status = 'dead_letter', attempts = ? WHERE payload_id = ?",
            (attempts, payload_id),
        )
        conn.execute(
            "UPDATE egress_log SET attempts = ?, result = ? WHERE payload_id = ?",
            (attempts, f"dead_letter: {error}", payload_id),
        )


def get_buffer_stats() -> dict:
    conn = get_conn()
    depth_row = conn.execute("SELECT count(*) as depth FROM outbox WHERE status = 'pending'").fetchone()
    depth = depth_row["depth"] if depth_row else 0

    oldest_row = conn.execute(
        "SELECT created_utc FROM outbox WHERE status = 'pending' ORDER BY seq ASC LIMIT 1"
    ).fetchone()
    oldest_utc = oldest_row["created_utc"] if oldest_row else None

    items_rows = conn.execute(
        """SELECT payload_id, attempts, next_retry_utc
           FROM outbox
           WHERE status = 'pending'
           ORDER BY seq ASC LIMIT 20"""
    ).fetchall()
    items = [dict(r) for r in items_rows]

    return {
        "depth": depth,
        "oldest_utc": oldest_utc,
        "items": items,
    }


def get_egress_logs(limit: int = 20) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT payload_id, seq, sent_at_utc, sha256, attempts, result, body
           FROM (
               SELECT payload_id, seq, first_attempt_utc as sent_at_utc, sha256, attempts, result, body
               FROM egress_log
               ORDER BY seq DESC LIMIT ?
           )""",
        (limit,),
    ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        # Parse body as JSON object if possible for consumer convenience
        try:
            d["body"] = json.loads(d["body"])
        except Exception:
            pass
        results.append(d)
    return results


def get_egress_by_id(payload_id: str) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM egress_log WHERE payload_id = ?", (payload_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        d["body"] = json.loads(d["body"])
    except Exception:
        pass
    return d
