"""Supabase Direct HTTPS REST Upload Module.

Directly uploads allowlisted telemetry events to Supabase PostgREST endpoint
using Python standard library urllib.request (zero third-party dependencies).
Handles network drops, authentication errors, duplicates, and offline queueing.
"""

from datetime import datetime, timezone
import json
import logging
import time
from typing import Any, Dict, Optional, Tuple
import urllib.error
import urllib.request

from collector.buffer import OfflineBuffer
from collector.config import CollectorConfig

logger = logging.getLogger(__name__)


class CloudUploadAuditor:
    """Tracks cloud upload telemetry statistics for privacy proof & terminal UI."""

    def __init__(self):
        self.successful_uploads: int = 0
        self.failed_uploads: int = 0
        self.last_successful_upload: Optional[str] = None
        self.current_status: str = "INITIALIZING"

    def record_success(self):
        self.successful_uploads += 1
        self.last_successful_upload = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        self.current_status = "ONLINE"

    def record_failure(self, status: str):
        self.failed_uploads += 1
        self.current_status = status


cloud_auditor = CloudUploadAuditor()


class SupabaseTelemetryUploader:
    """Uploads validated telemetry directly to Supabase PostgREST API."""

    def __init__(self, config: Optional[CollectorConfig] = None, buffer: Optional[OfflineBuffer] = None):
        self.config = config or CollectorConfig()
        self.buffer = buffer or OfflineBuffer()

        if not self.config.is_cloud_enabled:
            cloud_auditor.current_status = "LOCAL_ONLY (Missing Supabase URL/Key)"
        elif not self.config.is_authenticated:
            cloud_auditor.current_status = "UNENROLLED (Missing SUPABASE_DEVICE_TOKEN)"
        else:
            cloud_auditor.current_status = "STANDBY"

    def _format_supabase_record(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Map cloud payload fields directly to Supabase telemetry_events table schema."""
        record = dict(payload)
        # Ensure timestamp is mapped to collected_at
        if "timestamp" in record and "collected_at" not in record:
            record["collected_at"] = record["timestamp"]
        # Remove timestamp key if table uses collected_at exclusively
        record.pop("timestamp", None)
        return record

    def send_http_request(self, payload: Dict[str, Any]) -> Tuple[bool, str, int]:
        """Perform direct HTTPS POST to Supabase PostgREST.

        Returns:
            Tuple of (success, message, http_status_code).
        """
        if not self.config.is_cloud_enabled:
            return False, "Cloud upload skipped: Supabase URL/Key not configured.", 0

        endpoint = f"{self.config.supabase_url.rstrip('/')}/rest/v1/telemetry_events"
        headers = {
            "apikey": self.config.supabase_key,
            "Authorization": f"Bearer {self.config.supabase_token or self.config.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

        record = self._format_supabase_record(payload)
        data_bytes = json.dumps(record).encode("utf-8")

        req = urllib.request.Request(endpoint, data=data_bytes, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=5.0) as response:
                status_code = response.getcode()
                if 200 <= status_code < 300:
                    return True, "Upload successful", status_code
                return False, f"Unexpected HTTP status {status_code}", status_code

        except urllib.error.HTTPError as e:
            # 409 Conflict indicates payload_id already ingested (idempotent success)
            if e.code == 409:
                return True, "Duplicate payload_id already stored in Supabase (idempotent)", 409
            elif e.code in (401, 403):
                return False, f"Authentication error (HTTP {e.code}): Check SUPABASE_DEVICE_TOKEN", e.code
            else:
                return False, f"Supabase HTTP error {e.code}", e.code

        except (urllib.error.URLError, TimeoutError, OSError) as e:
            return False, f"Network connection error: {e}", 0

        except Exception as e:
            return False, f"Unexpected upload exception: {e}", 0

    def upload(self, payload: Dict[str, Any]) -> Tuple[bool, str]:
        """Attempt direct upload, automatically buffering to SQLite on network drops.

        Args:
            payload: Validated, allowlisted telemetry dictionary.

        Returns:
            Tuple of (success: bool, status_message: str).
        """
        # If not authenticated, keep collector running locally without crashing
        if not self.config.is_authenticated:
            cloud_auditor.current_status = "LOCAL_ONLY (Unenrolled)"
            return False, "Collector running in local mode (SUPABASE_DEVICE_TOKEN not set)."

        success, msg, code = self.send_http_request(payload)

        if success:
            cloud_auditor.record_success()
            # Try draining any previously queued offline records
            self.drain_offline_queue(limit=5)
            return True, msg

        # If permanent auth error (401, 403), do not fill buffer endlessly
        if code in (401, 403):
            cloud_auditor.record_failure(f"AUTH_FAILED (HTTP {code})")
            return False, msg

        # Transient failure (offline, timeout, 5xx): save to SQLite buffer
        buffered = self.buffer.enqueue(payload)
        status_msg = "OFFLINE_BUFFERED" if buffered else "OFFLINE_BUFFER_FAILED"
        cloud_auditor.record_failure(f"{status_msg} ({self.buffer.count_pending()} pending)")
        return False, f"{msg} -> Stored in local offline buffer."

    def drain_offline_queue(self, limit: int = 10) -> int:
        """Attempt to transmit records stored in the offline buffer.

        Returns:
            Number of successfully drained records.
        """
        if not self.config.is_authenticated:
            return 0

        pending_items = self.buffer.get_pending(limit=limit)
        drained_count = 0

        for payload_id, payload in pending_items:
            success, _, code = self.send_http_request(payload)
            if success:
                self.buffer.mark_succeeded(payload_id)
                drained_count += 1
            else:
                self.buffer.mark_failed(payload_id)
                # If network is still down, stop draining this cycle
                if code == 0 or code >= 500:
                    break

        return drained_count
