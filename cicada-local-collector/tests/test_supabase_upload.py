"""Unit tests for Supabase Client and Direct Upload Engine."""

import unittest
from unittest.mock import MagicMock, patch
import urllib.error
import uuid

from collector.buffer import OfflineBuffer
from collector.config import CollectorConfig
from collector.supabase_client import SupabaseTelemetryUploader


class TestSupabaseUploadEngine(unittest.TestCase):
    """Verifies upload handling, error codes, offline fallback, and auth checks."""

    def setUp(self):
        self.config = CollectorConfig()
        self.config.supabase_url = "https://example.supabase.co"
        self.config.supabase_key = "test_publishable_key"
        self.config.supabase_token = "test_device_jwt_token"
        self.config.tenant_id = str(uuid.uuid4())
        self.config.consent_given = True

        self.mock_buffer = MagicMock(spec=OfflineBuffer)
        self.uploader = SupabaseTelemetryUploader(config=self.config, buffer=self.mock_buffer)

        self.sample_payload = {
            "schema_version": "2.0.0",
            "tenant_id": self.config.tenant_id,
            "device_id": str(uuid.uuid4()),
            "payload_id": str(uuid.uuid4()),
            "timestamp": "2026-11-20T17:00:00Z",
            "operating_system": "Windows",
            "cpu_percent": 10.0,
            "cpu_temperature_c": 54.0,
            "memory_total_bytes": 8000000000,
            "memory_used_bytes": 4000000000,
            "memory_percent": 50.0,
            "disk_total_bytes": 100000000000,
            "disk_used_bytes": 50000000000,
            "disk_percent": 50.0,
            "network_upload_bytes_per_second": 100.0,
            "network_download_bytes_per_second": 200.0,
            "uptime_seconds": 1200.0,
            "system_health_score": 95,
        }

    @patch("urllib.request.urlopen")
    def test_upload_success_201(self, mock_urlopen):
        """Successful HTTP 201 response records upload success."""
        mock_resp = MagicMock()
        mock_resp.getcode.return_value = 201
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        success, msg = self.uploader.upload(self.sample_payload)
        self.assertTrue(success)
        self.assertIn("successful", msg)
        self.mock_buffer.enqueue.assert_not_called()

    @patch("urllib.request.urlopen")
    def test_duplicate_payload_409_handled_as_idempotent_success(self, mock_urlopen):
        """HTTP 409 Conflict (duplicate payload_id) is handled gracefully without error."""
        http_err = urllib.error.HTTPError(
            url="https://example.supabase.co",
            code=409,
            msg="Conflict",
            hdrs={},
            fp=None,
        )
        mock_urlopen.side_effect = http_err

        success, msg = self.uploader.upload(self.sample_payload)
        self.assertTrue(success)
        self.assertIn("Duplicate payload_id", msg)

    @patch("urllib.request.urlopen")
    def test_network_drop_queues_to_offline_buffer(self, mock_urlopen):
        """Network drop (URLError / ConnectionError) automatically saves to offline buffer."""
        mock_urlopen.side_effect = urllib.error.URLError("Temporary network failure")
        self.mock_buffer.enqueue.return_value = True

        success, msg = self.uploader.upload(self.sample_payload)
        self.assertFalse(success)
        self.assertIn("Stored in local offline buffer", msg)
        self.mock_buffer.enqueue.assert_called_once_with(self.sample_payload)

    @patch("urllib.request.urlopen")
    def test_authentication_failure_401(self, mock_urlopen):
        """HTTP 401 Unauthorized reports authentication failure without logging secrets."""
        http_err = urllib.error.HTTPError(
            url="https://example.supabase.co",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=None,
        )
        mock_urlopen.side_effect = http_err

        success, msg = self.uploader.upload(self.sample_payload)
        self.assertFalse(success)
        self.assertIn("Authentication error", msg)
        self.mock_buffer.enqueue.assert_not_called()

    def test_missing_config_runs_locally(self):
        """Unconfigured collector operates locally without crashing."""
        unconfigured = CollectorConfig()
        unconfigured.supabase_url = None
        uploader_local = SupabaseTelemetryUploader(config=unconfigured)

        success, msg = uploader_local.upload(self.sample_payload)
        self.assertFalse(success)
        self.assertIn("local mode", msg)


if __name__ == "__main__":
    unittest.main()
