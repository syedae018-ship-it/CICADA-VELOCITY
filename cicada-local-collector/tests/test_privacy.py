"""Unit tests for privacy filtering and allowlist enforcement."""

import unittest

from collector.privacy import (
    PrivacyViolationError,
    filter_telemetry,
    validate_payload_privacy,
)


class TestPrivacyModule(unittest.TestCase):
    """Verifies that the privacy module enforces strict allowlists and default-deny."""

    def setUp(self):
        self.sample_valid_payload = {
            "schema_version": "1.1.0",
            "collector_id": "4b95f1a3-2d58-48b0-8dbb-b2b52fe0c17a",
            "collected_at": "2026-11-20T17:00:00Z",
            "system_info": {
                "os_name": "Windows",
                "os_version": "10.0.26100",
                "architecture": "AMD64",
                "processor": "Intel64 Family",
                "python_version": "3.14.6",
            },
            "metrics": {
                "cpu_usage_percent": 12.5,
                "ram_total_bytes": 16000000000,
                "ram_used_bytes": 8000000000,
                "ram_available_bytes": 8000000000,
                "ram_usage_percent": 50.0,
                "disk_total_bytes": 500000000000,
                "disk_used_bytes": 250000000000,
                "disk_free_bytes": 250000000000,
                "disk_usage_percent": 50.0,
                "net_bytes_sent": 1024,
                "net_bytes_recv": 2048,
                "net_upload_speed_bps": 100.0,
                "net_download_speed_bps": 200.0,
                "uptime_seconds": 3600.0,
            },
            "infra_health": {
                "status": "HEALTHY",
                "warnings": [],
                "process_count": 210,
                "swap_total_bytes": 4000000000,
                "swap_used_bytes": 500000000,
                "swap_usage_percent": 12.5,
                "battery_percent": 90.0,
                "power_plugged": True,
            },
            "network_quality": {
                "probe_target": "1.1.1.1",
                "latency_ms": 14.5,
                "packet_loss_percent": 0.0,
                "status": "CONNECTED",
            },
            "security_telemetry": {
                "recent_failed_logins_count": 0,
                "audit_status": "ACTIVE",
            },
        }

    def test_allowlist_preserves_valid_fields(self):
        """Sanitized payload retains all permitted fields."""
        sanitized = filter_telemetry(self.sample_valid_payload)
        self.assertEqual(sanitized["schema_version"], "1.1.0")
        self.assertEqual(sanitized["collector_id"], "4b95f1a3-2d58-48b0-8dbb-b2b52fe0c17a")
        self.assertEqual(sanitized["system_info"]["os_name"], "Windows")
        self.assertEqual(sanitized["metrics"]["cpu_usage_percent"], 12.5)
        self.assertEqual(sanitized["infra_health"]["status"], "HEALTHY")
        self.assertEqual(sanitized["network_quality"]["latency_ms"], 14.5)
        self.assertEqual(sanitized["security_telemetry"]["recent_failed_logins_count"], 0)
        self.assertTrue(validate_payload_privacy(sanitized))

    def test_default_deny_strips_disallowed_top_level_fields(self):
        """Disallowed top-level fields such as hostname, user, IP, or raw logs are stripped."""
        dirty_payload = dict(self.sample_valid_payload)
        dirty_payload["hostname"] = "SECRET-WORKSTATION"
        dirty_payload["ip_address"] = "192.168.1.100"
        dirty_payload["username"] = "john_doe"
        dirty_payload["raw_system_logs"] = ["kernel panic", "auth failure"]
        dirty_payload["api_key"] = "sk-1234567890"

        sanitized = filter_telemetry(dirty_payload)

        self.assertNotIn("hostname", sanitized)
        self.assertNotIn("ip_address", sanitized)
        self.assertNotIn("username", sanitized)
        self.assertNotIn("raw_system_logs", sanitized)
        self.assertNotIn("api_key", sanitized)
        self.assertTrue(validate_payload_privacy(sanitized))

    def test_default_deny_strips_sensitive_security_fields(self):
        """Disallowed sensitive fields in security_telemetry (e.g. usernames, IPs) are stripped."""
        dirty_payload = dict(self.sample_valid_payload)
        dirty_payload["security_telemetry"] = {
            "recent_failed_logins_count": 3,
            "audit_status": "ACTIVE",
            "targeted_username": "admin",
            "client_ip": "10.0.0.5",
            "password_attempted": "123456",
        }

        sanitized = filter_telemetry(dirty_payload)

        sec = sanitized["security_telemetry"]
        self.assertIn("recent_failed_logins_count", sec)
        self.assertIn("audit_status", sec)
        self.assertNotIn("targeted_username", sec)
        self.assertNotIn("client_ip", sec)
        self.assertNotIn("password_attempted", sec)
        self.assertTrue(validate_payload_privacy(sanitized))

    def test_default_deny_strips_disallowed_nested_system_info_fields(self):
        """Extraneous fields inside system_info are filtered out."""
        dirty_payload = dict(self.sample_valid_payload)
        dirty_payload["system_info"] = dict(self.sample_valid_payload["system_info"])
        dirty_payload["system_info"]["node_name"] = "macbook-pro.local"
        dirty_payload["system_info"]["mac_address"] = "00:11:22:33:44:55"
        dirty_payload["system_info"]["user_home_dir"] = "/Users/john"

        sanitized = filter_telemetry(dirty_payload)

        self.assertNotIn("node_name", sanitized["system_info"])
        self.assertNotIn("mac_address", sanitized["system_info"])
        self.assertNotIn("user_home_dir", sanitized["system_info"])
        self.assertTrue(validate_payload_privacy(sanitized))

    def test_validate_payload_privacy_raises_on_unauthorized_key(self):
        """Validation raises PrivacyViolationError if an unauthorized key is present."""
        dirty_payload = dict(self.sample_valid_payload)
        dirty_payload["unauthorized_field"] = "bad_data"

        with self.assertRaises(PrivacyViolationError):
            validate_payload_privacy(dirty_payload)


if __name__ == "__main__":
    unittest.main()
