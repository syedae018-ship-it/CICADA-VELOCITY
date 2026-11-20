"""Unit tests for payload construction, identity persistence, and snapshot saving."""

import json
import os
import tempfile
import unittest
import uuid

from collector.health import check_infrastructure_health
from collector.identity import get_or_create_collector_id, is_valid_uuid
from collector.metrics import MetricsCollector
from collector.network_probe import measure_network_quality, parse_ping_output
from collector.payload import (
    SCHEMA_VERSION,
    build_telemetry_payload,
    save_telemetry_snapshot,
)
from collector.security import get_failed_login_telemetry
from collector.system_info import get_system_info


class TestPayloadAndIdentity(unittest.TestCase):
    """Tests payload generation, identity stability, and local storage."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_collector_id_generation_and_persistence(self):
        """Collector ID is generated as UUIDv4, persists to disk, and reloads identically."""
        id_path = os.path.join(self.temp_dir.name, "collector_id.json")

        id_1 = get_or_create_collector_id(storage_path=id_path)
        self.assertTrue(is_valid_uuid(id_1))
        self.assertTrue(os.path.exists(id_path))

        id_2 = get_or_create_collector_id(storage_path=id_path)
        self.assertEqual(id_1, id_2)

    def test_system_info_structure(self):
        """System info returns required fields and non-empty values."""
        sys_info = get_system_info()
        self.assertIn("os_name", sys_info)
        self.assertIn("os_version", sys_info)
        self.assertIn("architecture", sys_info)
        self.assertIn("processor", sys_info)
        self.assertIn("python_version", sys_info)

        for k, v in sys_info.items():
            self.assertIsInstance(v, str)
            self.assertTrue(len(v) > 0)

    def test_infrastructure_health_evaluation(self):
        """Health check returns HEALTHY under normal metrics and WARNING under high resource loads."""
        # Normal metrics -> HEALTHY
        normal_metrics = {
            "cpu_usage_percent": 15.0,
            "ram_usage_percent": 45.0,
            "disk_usage_percent": 50.0,
        }
        health_normal = check_infrastructure_health(normal_metrics)
        self.assertEqual(health_normal["status"], "HEALTHY")
        self.assertEqual(len(health_normal["warnings"]), 0)

        # High metrics -> WARNING
        high_metrics = {
            "cpu_usage_percent": 88.0,
            "ram_usage_percent": 86.0,
            "disk_usage_percent": 40.0,
        }
        health_high = check_infrastructure_health(high_metrics)
        self.assertEqual(health_high["status"], "WARNING")
        self.assertTrue(len(health_high["warnings"]) >= 2)

        # Critical metrics -> CRITICAL
        crit_metrics = {
            "cpu_usage_percent": 96.0,
            "ram_usage_percent": 50.0,
            "disk_usage_percent": 50.0,
        }
        health_crit = check_infrastructure_health(crit_metrics)
        self.assertEqual(health_crit["status"], "CRITICAL")

    def test_parse_ping_output_windows_and_unix(self):
        """Ping output parsing correctly extracts latency and packet loss across platforms."""
        windows_sample = """
        Pinging 1.1.1.1 with 32 bytes of data:
        Reply from 1.1.1.1: bytes=32 time=14ms TTL=57
        Reply from 1.1.1.1: bytes=32 time=16ms TTL=57

        Ping statistics for 1.1.1.1:
            Packets: Sent = 2, Received = 2, Lost = 0 (0% loss),
        Approximate round trip times in milli-seconds:
            Minimum = 14ms, Maximum = 16ms, Average = 15ms
        """
        win_result = parse_ping_output(windows_sample, is_windows=True)
        self.assertEqual(win_result["latency_ms"], 15.0)
        self.assertEqual(win_result["packet_loss_percent"], 0.0)

        unix_sample = """
        PING 1.1.1.1 (1.1.1.1): 56 data bytes
        64 bytes from 1.1.1.1: icmp_seq=0 ttl=57 time=12.432 ms

        --- 1.1.1.1 ping statistics ---
        2 packets transmitted, 2 packets received, 0.0% packet loss
        round-trip min/avg/max/stddev = 11.234/12.432/13.630/1.198 ms
        """
        unix_result = parse_ping_output(unix_sample, is_windows=False)
        self.assertEqual(unix_result["latency_ms"], 12.432)
        self.assertEqual(unix_result["packet_loss_percent"], 0.0)

    def test_measure_network_quality_handles_errors_gracefully(self):
        """Network probe handles unreachable hosts or blocked sockets without crashing."""
        result = measure_network_quality(target="999.999.999.999", count=1, timeout_sec=1)
        self.assertIn("status", result)
        self.assertIn("probe_target", result)

    def test_security_failed_logins_structure(self):
        """Failed logins check returns non-negative count and valid status string."""
        sec = get_failed_login_telemetry()
        self.assertIn("recent_failed_logins_count", sec)
        self.assertIn("audit_status", sec)
        self.assertIsInstance(sec["recent_failed_logins_count"], int)
        self.assertGreaterEqual(sec["recent_failed_logins_count"], 0)

    def test_build_telemetry_payload_full_schema(self):
        """Constructed payload matches versioned schema structure with new modules."""
        collector_id = str(uuid.uuid4())
        sys_info = get_system_info()
        metrics = {
            "cpu_usage_percent": 10.0,
            "ram_total_bytes": 8000000000,
            "ram_used_bytes": 4000000000,
            "ram_available_bytes": 4000000000,
            "ram_usage_percent": 50.0,
            "disk_total_bytes": 100000000000,
            "disk_used_bytes": 50000000000,
            "disk_free_bytes": 50000000000,
            "disk_usage_percent": 50.0,
            "net_bytes_sent": 5000,
            "net_bytes_recv": 10000,
            "net_upload_speed_bps": 250.0,
            "net_download_speed_bps": 500.0,
            "uptime_seconds": 1200.0,
        }
        health = check_infrastructure_health(metrics)
        net_quality = {"probe_target": "1.1.1.1", "latency_ms": 12.0, "packet_loss_percent": 0.0, "status": "CONNECTED"}
        sec = {"recent_failed_logins_count": 0, "audit_status": "ACTIVE"}

        payload = build_telemetry_payload(
            collector_id=collector_id,
            system_info=sys_info,
            metrics=metrics,
            infra_health=health,
            network_quality=net_quality,
            security_telemetry=sec,
        )

        self.assertEqual(payload["schema_version"], SCHEMA_VERSION)
        self.assertEqual(payload["collector_id"], collector_id)
        self.assertIn("infra_health", payload)
        self.assertIn("network_quality", payload)
        self.assertIn("security_telemetry", payload)

    def test_save_telemetry_snapshot(self):
        """Snapshot is correctly written to disk and can be reloaded as valid JSON."""
        output_file = os.path.join(self.temp_dir.name, "snapshot.json")
        payload = {
            "schema_version": "1.1.0",
            "collector_id": str(uuid.uuid4()),
            "collected_at": "2026-11-20T17:00:00Z",
            "system_info": {"os_name": "TestOS"},
            "metrics": {"cpu_usage_percent": 5.0},
        }

        success = save_telemetry_snapshot(payload, file_path=output_file)
        self.assertTrue(success)
        self.assertTrue(os.path.exists(output_file))

        with open(output_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertEqual(data["schema_version"], "1.1.0")


if __name__ == "__main__":
    unittest.main()
