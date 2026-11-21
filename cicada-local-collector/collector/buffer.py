"""Local Offline Buffer & Data Management Module.

Uses a lightweight SQLite database to reliably store telemetry events
when the network is offline or Supabase is temporarily unreachable.
Implements:
- Exponential backoff
- 30-day automated data retention pruning
- Telemetry export to CSV and JSON formats
"""

from contextlib import contextmanager
import csv
import json
import logging
import os
import sqlite3
import time
from typing import Any, Dict, Generator, List, Optional, Tuple

from collector.paths import get_buffer_db_path

logger = logging.getLogger(__name__)


class OfflineBuffer:
    """Manages persistent offline queue and local data retention."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or get_buffer_db_path()
        os.makedirs(os.path.dirname(self.db_path) or ".", exist_ok=True)
        self._init_db()

    @contextmanager
    def _get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager that ensures the database connection is cleanly closed."""
        conn = sqlite3.connect(self.db_path, timeout=5.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Initialize SQLite schema if it does not exist."""
        try:
            with self._get_connection() as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS offline_queue (
                        payload_id TEXT PRIMARY KEY,
                        tenant_id TEXT NOT NULL,
                        device_id TEXT NOT NULL,
                        payload_json TEXT NOT NULL,
                        created_at REAL NOT NULL,
                        retry_count INTEGER NOT NULL DEFAULT 0,
                        next_retry_at REAL NOT NULL
                    )
                    """
                )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_queue_retry ON offline_queue(next_retry_at ASC)"
                )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_queue_created ON offline_queue(created_at ASC)"
                )
        except Exception as e:
            logger.error("Failed to initialize offline buffer database: %s", e)

    def enqueue(self, payload: Dict[str, Any]) -> bool:
        """Store an un-uploaded telemetry payload into the offline buffer."""
        payload_id = str(payload.get("payload_id", ""))
        tenant_id = str(payload.get("tenant_id", ""))
        device_id = str(payload.get("device_id", ""))

        if not payload_id or not tenant_id or not device_id:
            logger.warning("Attempted to buffer invalid payload missing identifiers.")
            return False

        now = time.time()
        try:
            payload_json = json.dumps(payload)
            with self._get_connection() as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO offline_queue 
                    (payload_id, tenant_id, device_id, payload_json, created_at, retry_count, next_retry_at)
                    VALUES (?, ?, ?, ?, ?, 0, ?)
                    """,
                    (payload_id, tenant_id, device_id, payload_json, now, now),
                )
            # Prune records older than 30 days
            self.prune_expired(retention_days=30)
            return True
        except Exception as e:
            logger.error("Could not buffer telemetry record %s: %s", payload_id, e)
            return False

    def get_pending(self, limit: int = 20) -> List[Tuple[str, Dict[str, Any]]]:
        """Fetch pending records that are due for retry."""
        now = time.time()
        pending = []
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    """
                    SELECT payload_id, payload_json FROM offline_queue
                    WHERE next_retry_at <= ?
                    ORDER BY created_at ASC
                    LIMIT ?
                    """,
                    (now, limit),
                )
                for row in cursor.fetchall():
                    try:
                        data = json.loads(row["payload_json"])
                        pending.append((row["payload_id"], data))
                    except Exception:
                        pass
        except Exception as e:
            logger.error("Failed reading offline buffer: %s", e)

        return pending

    def mark_succeeded(self, payload_id: str) -> bool:
        """Remove a successfully transmitted record from the queue."""
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM offline_queue WHERE payload_id = ?", (payload_id,))
            return True
        except Exception as e:
            logger.error("Failed deleting record %s from offline buffer: %s", payload_id, e)
            return False

    def mark_failed(self, payload_id: str) -> None:
        """Increment retry count and compute exponential backoff delay."""
        now = time.time()
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    "SELECT retry_count FROM offline_queue WHERE payload_id = ?",
                    (payload_id,),
                )
                row = cursor.fetchone()
                if row:
                    new_retries = row["retry_count"] + 1
                    backoff = min(300.0, float(2**min(new_retries, 8)))
                    next_retry = now + backoff
                    conn.execute(
                        """
                        UPDATE offline_queue 
                        SET retry_count = ?, next_retry_at = ?
                        WHERE payload_id = ?
                        """,
                        (new_retries, next_retry, payload_id),
                    )
        except Exception as e:
            logger.error("Failed updating retry state for %s: %s", payload_id, e)

    def count_pending(self) -> int:
        """Count total pending records waiting in the offline queue."""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("SELECT COUNT(*) as cnt FROM offline_queue")
                row = cursor.fetchone()
                return int(row["cnt"]) if row else 0
        except Exception:
            return 0

    def prune_expired(self, retention_days: int = 30) -> int:
        """Enforce data retention: remove records older than retention_days (default 30 days)."""
        cutoff = time.time() - (retention_days * 86400.0)
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("DELETE FROM offline_queue WHERE created_at < ?", (cutoff,))
                return cursor.rowcount
        except Exception as e:
            logger.error("Failed pruning expired telemetry records: %s", e)
            return 0

    def export_to_json(self, export_path: str) -> int:
        """Export all stored offline records to a JSON file."""
        records = []
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("SELECT payload_json FROM offline_queue ORDER BY created_at ASC")
                for row in cursor.fetchall():
                    try:
                        records.append(json.loads(row["payload_json"]))
                    except Exception:
                        pass

            os.makedirs(os.path.dirname(os.path.abspath(export_path)), exist_ok=True)
            with open(export_path, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
            return len(records)
        except Exception as e:
            logger.error("Export to JSON failed: %s", e)
            return 0

    def export_to_csv(self, export_path: str) -> int:
        """Export all stored offline records to a flat CSV file."""
        records = []
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("SELECT payload_json FROM offline_queue ORDER BY created_at ASC")
                for row in cursor.fetchall():
                    try:
                        records.append(json.loads(row["payload_json"]))
                    except Exception:
                        pass

            if not records:
                return 0

            os.makedirs(os.path.dirname(os.path.abspath(export_path)), exist_ok=True)
            fieldnames = sorted(records[0].keys())
            with open(export_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(records)
            return len(records)
        except Exception as e:
            logger.error("Export to CSV failed: %s", e)
            return 0

    def clear_all(self) -> None:
        """Clear all records from the offline queue."""
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM offline_queue")
        except Exception:
            pass
