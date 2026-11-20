"""Unit tests for the Strict Centralized Allowlisting Engine."""

import unittest
import uuid

from collector.privacy import (
    ALLOWED_CLOUD_FIELDS,
    PrivacyViolationError,
    build_cloud_payload,
    validate_and_filter_cloud_payload,
)


class TestAllowlistEngine(unittest.TestCase):
    """Verifies default-deny, strict field allowlisting, and schema validation."""

    def setUp(self):
        self.valid_cloud_payload = {
            "schema_version": "2.0.0",
            "tenant_id": str(uuid.uuid4()),
            "device_id": str(uuid.uuid4()),
            "payload_id": str(uuid.uuid4()),
            "timestamp": "2026-11-20T17:00:00Z",
            "operating_system": "Windows",
            "cpu_percent": 12.5,
            "cpu_temperature_c": 54.0,
            "memory_total_bytes": 16000000000,
            "memory_used_bytes": 8000000000,
            "memory_percent": 50.0,
            "disk_total_bytes": 500000000000,
            "disk_used_bytes": 250000000000,
            "disk_percent": 50.0,
            "network_upload_bytes_per_second": 1024.0,
            "network_download_bytes_per_second": 2048.0,
            "uptime_seconds": 3600.0,
            "system_health_score": 92,
        }

    def test_valid_payload_passes(self):
        """Permitted, correctly typed payload passes validation without error."""
        validated = validate_and_filter_cloud_payload(self.valid_cloud_payload)
        self.assertEqual(set(validated.keys()), ALLOWED_CLOUD_FIELDS)
        self.assertEqual(len(ALLOWED_CLOUD_FIELDS), 18)

    def test_unknown_field_rejected(self):
        """Unknown fields (e.g. hostname, user, IP, raw logs) cause rejection."""
        bad_payload = dict(self.valid_cloud_payload)
        bad_payload["hostname"] = "MY-SECRET-LAPTOP"

        with self.assertRaises(PrivacyViolationError) as ctx:
            validate_and_filter_cloud_payload(bad_payload)
        self.assertIn("Unknown field 'hostname'", str(ctx.exception))

    def test_nested_objects_rejected_in_cloud_payload(self):
        """Arbitrary nested dictionaries or lists cannot be sent to Supabase."""
        bad_payload = dict(self.valid_cloud_payload)
        bad_payload["cpu_percent"] = {"core0": 10.0, "core1": 15.0}

        with self.assertRaises(PrivacyViolationError):
            validate_and_filter_cloud_payload(bad_payload)

    def test_oversized_payload_rejected(self):
        """Payloads exceeding maximum permitted size are rejected."""
        bad_payload = dict(self.valid_cloud_payload)
        bad_payload["operating_system"] = "X" * (70 * 1024)

        with self.assertRaises(PrivacyViolationError) as ctx:
            validate_and_filter_cloud_payload(bad_payload)
        self.assertIn("exceeds limit", str(ctx.exception))

    def test_negative_numeric_bounds_rejected(self):
        """Negative memory bytes or invalid percentages out of 0-100 range are rejected."""
        bad_payload = dict(self.valid_cloud_payload)
        bad_payload["cpu_percent"] = 150.0

        with self.assertRaises(PrivacyViolationError):
            validate_and_filter_cloud_payload(bad_payload)

        bad_payload_mem = dict(self.valid_cloud_payload)
        bad_payload_mem["memory_total_bytes"] = -100
        with self.assertRaises(PrivacyViolationError):
            validate_and_filter_cloud_payload(bad_payload_mem)

    def test_build_cloud_payload_end_to_end(self):
        """Test build_cloud_payload creates verified, allowlisted dictionary."""
        tenant_id = str(uuid.uuid4())
        device_id = str(uuid.uuid4())
        system_info = {"os_name": "Windows"}
        metrics = {
            "cpu_usage_percent": 14.5,
            "cpu_temperature_c": 52.0,
            "ram_total_bytes": 8000000000,
            "ram_used_bytes": 4000000000,
            "ram_usage_percent": 50.0,
            "disk_total_bytes": 100000000000,
            "disk_used_bytes": 50000000000,
            "disk_usage_percent": 50.0,
            "net_upload_speed_bps": 500.0,
            "net_download_speed_bps": 1000.0,
            "uptime_seconds": 7200.0,
        }

        cloud_payload = build_cloud_payload(tenant_id, device_id, system_info, metrics)
        self.assertEqual(cloud_payload["schema_version"], "2.0.0")
        self.assertEqual(cloud_payload["operating_system"], "Windows")
        self.assertEqual(cloud_payload["cpu_percent"], 14.5)
        self.assertEqual(len(cloud_payload), 18)
        self.assertTrue(uuid.UUID(cloud_payload["payload_id"]))


if __name__ == "__main__":
    unittest.main()
