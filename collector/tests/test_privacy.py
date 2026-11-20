import json
import pytest
from pathlib import Path
from jsonschema import Draft202012Validator

from collector.redact import redact, redact_obj
from collector.pseudo import source_id
from collector.aggregate import build_payload
from collector.detect import detect_events_in_window
from collector.config import settings

ROOT = Path(__file__).resolve().parent.parent.parent
PAYLOAD_SCHEMA = json.loads((ROOT / "contracts" / "payload_schema.json").read_text(encoding="utf-8"))

def test_redaction_engine_all_secret_types():
    raw_texts = [
        ("Private Key", "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Y1m\n-----END RSA PRIVATE KEY-----", "[REDACTED:private_key]"),
        ("JWT Token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c", "[REDACTED:jwt]"),
        ("Bearer Token", "Authorization: Bearer mySecretToken123456789", "[REDACTED:bearer_token]"),
        ("AWS Key", "Found key AKIAIOSFODNN7EXAMPLE in config", "[REDACTED:aws_access_key]"),
        ("Password KV", "connect user=root password=hunter2 timeout=30", "[REDACTED:password_kv]"),
        ("API Key KV", "export api_key=sk_live_998877665544332211", "[REDACTED:api_key_kv]"),
        ("Email", "alert sent to admin@acme.com and sec@company.org", "[REDACTED:email]"),
        ("IPv4", "failed connection from 10.0.4.17 to 192.168.1.100", "[REDACTED:ipv4]")
    ]

    for label, raw, expected_token in raw_texts:
        redacted, count = redact(raw)
        assert count > 0, f"Failed to detect secret in {label}"
        assert expected_token in redacted, f"Expected {expected_token} in redacted output for {label}"

def test_pseudonymous_source_ids():
    host1 = "db-prod-01.acme.local"
    host2 = "db-prod-02.acme.local"
    sid1 = source_id(host1)
    sid2 = source_id(host2)
    
    assert sid1.startswith("src_")
    assert len(sid1) == 16  # src_ (4) + 12 hex chars = 16
    assert sid1 == source_id(host1), "Source ID must be deterministic"
    assert sid1 != sid2, "Different hosts must produce different source IDs"

def test_payload_builder_zero_leakage_and_schema():
    dirty_records = [
        {
            "kind": "metric",
            "ts": "2026-11-20T09:15:00Z",
            "host": "db-prod-01.acme.local",
            "ip": "10.0.4.17",
            "service": "payments-api",
            "source_type": "server",
            "user": "admin@acme.com",
            "metrics": {
                "cpu_pct": 74.5,
                "mem_pct": 61.2,
                "disk_pct": 80.0,
                "latency_ms": 22.1,
                "packet_loss_pct": 0.0,
                "bandwidth_mbps": 150.0,
                "service_up": True,
                "connectivity_ok": True,
                "illegal_metric": 999.9  # Should be dropped
            }
        },
        {
            "kind": "log",
            "ts": "2026-11-20T09:15:01Z",
            "host": "db-prod-01.acme.local",
            "ip": "10.0.4.17",
            "service": "payments-api",
            "source_type": "app",
            "level": "ERROR",
            "message": "DB connect failed user=admin password=hunter2 Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.abcdefghijk"
        }
    ]

    redacted_records = []
    total_redacted = 0
    for r in dirty_records:
        red, c = redact_obj(r)
        redacted_records.append(red)
        total_redacted += c

    payload = build_payload(
        window_records=redacted_records,
        start_utc="2026-11-20T09:15:00Z",
        end_utc="2026-11-20T09:15:05Z",
        secrets_redacted_count=total_redacted,
        records_in_count=len(dirty_records),
        buffer_depth=0
    )

    # 1. Validate strictly against payload_schema.json
    validator = Draft202012Validator(PAYLOAD_SCHEMA)
    errors = list(validator.iter_errors(payload))
    assert not errors, f"Payload schema validation failed: {[e.message for e in errors]}"

    # 2. Assert stats accounting
    assert payload["redaction_stats"]["records_in"] == 2
    assert payload["redaction_stats"]["secrets_redacted"] > 0
    assert payload["redaction_stats"]["fields_dropped"] > 0

    # 3. Assert zero leakage in entire JSON serialization
    serialized = json.dumps(payload)
    for forbidden in ["hunter2", "eyJ", "AKIA", "@acme", "10.0.4.17", "illegal_metric"]:
        assert forbidden not in serialized, f"Leakage detected: {forbidden} found in payload!"

def test_failed_login_detection_templated_summary():
    sid = "src_1234567890ab"
    auth_records = [
        {
            "kind": "auth",
            "source_id": sid,
            "ts": f"2026-11-20T09:15:0{i}Z",
            "outcome": "failure",
            "user": f"user_{i}@target.com",
            "src_ip": f"198.51.100.{10+i}"
        }
        for i in range(6)
    ]

    events = detect_events_in_window(auth_records)
    burst_events = [e for e in events if e.get("source_id") == sid and e.get("type") == "failed_login_burst"]
    assert len(burst_events) == 1
    ev = burst_events[0]
    assert ev["type"] == "failed_login_burst"
    assert ev["category"] == "auth"
    assert ev["severity"] == "high"
    assert ev["count"] == 6
    # Check that summary is purely templated and contains NO raw IPs or usernames
    assert "user_" not in ev["summary"]
    assert "198.51.100" not in ev["summary"]
    assert "target.com" not in ev["summary"]
    assert "6 failed logins in 60s" in ev["summary"]
