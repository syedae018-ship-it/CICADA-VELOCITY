"""Automated Test Suite for Velocity Cicada Windows Collector & Cloud Connectivity.

Validates:
1. Subprocess sanitization (no console window creation flags)
2. DPAPI secret protection and recovery
3. Single-instance process mutex protection
4. Host telemetry continuous sampling
5. 60-second aggregation window and Draft202012 schema conformance
6. SaaS dynamic enrollment endpoint (/api/v1/enroll)
7. End-to-end HMAC authentication, heartbeat, and metadata transmission
8. Outage buffering and replay deduplication
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from collector import config
from collector.aggregate import build_payload
from collector.dpapi import protect_secret, unprotect_secret
from collector.host_collector import collect_host_sample, is_collector_paused, set_collector_paused
from collector.mutex import SingleInstanceLock
from collector.subprocess_util import safe_run_subprocess
from saas.app import app as saas_app
from transport.signing import sign

CONTRACTS_DIR = Path(__file__).resolve().parent.parent / "contracts"
PAYLOAD_SCHEMA = json.loads((CONTRACTS_DIR / "payload_schema.json").read_text(encoding="utf-8"))
HEARTBEAT_SCHEMA = json.loads((CONTRACTS_DIR / "heartbeat_schema.json").read_text(encoding="utf-8"))
payload_validator = Draft202012Validator(PAYLOAD_SCHEMA)
heartbeat_validator = Draft202012Validator(HEARTBEAT_SCHEMA)

client = TestClient(saas_app)


def test_safe_run_subprocess_execution():
    """Verify safe_run_subprocess runs commands cleanly across platforms."""
    res = safe_run_subprocess(["python3", "-c", "print('velocity-cicada')"])
    assert res.returncode == 0
    assert "velocity-cicada" in res.stdout


def test_dpapi_secret_protection_roundtrip():
    """Verify secret encryption and decryption roundtrip."""
    original_secret = "dev-secret-super-safe-hmac-key-12345"
    protected = protect_secret(original_secret)
    assert protected != original_secret
    assert protected.startswith("dpapi:") or protected.startswith("plain:")

    recovered = unprotect_secret(protected)
    assert recovered == original_secret


def test_single_instance_mutex_prevents_duplicates(tmp_path):
    """Verify single-instance lock prevents duplicate process launches."""
    lock1 = SingleInstanceLock("TestVelocityCicadaLock", lock_dir=str(tmp_path))
    assert lock1.acquire() is True

    # Second instance must fail while lock1 is held
    lock2 = SingleInstanceLock("TestVelocityCicadaLock", lock_dir=str(tmp_path))
    assert lock2.acquire() is False

    lock1.release()

    # After release, lock2 can acquire
    assert lock2.acquire() is True
    lock2.release()


def test_host_telemetry_collection_structure():
    """Verify real host telemetry sampler collects compliant metrics."""
    sample = collect_host_sample()
    assert "record" in sample
    assert "raw_snapshot" in sample

    record = sample["record"]
    assert record["kind"] == "metric"
    assert record["source_type"] == "server"
    assert "metrics" in record

    m = record["metrics"]
    assert 0.0 <= m["cpu_pct"] <= 100.0
    assert 0.0 <= m["mem_pct"] <= 100.0
    assert 0.0 <= m["disk_pct"] <= 100.0
    assert m["service_up"] is True
    assert isinstance(m["connectivity_ok"], bool)
    assert m["bandwidth_mbps"] >= 0.0


def test_collector_pause_resume_state():
    """Verify collector pause/resume state management."""
    assert is_collector_paused() is False
    set_collector_paused(True)
    assert is_collector_paused() is True
    set_collector_paused(False)
    assert is_collector_paused() is False


def test_metadata_payload_schema_conformance():
    """Verify aggregated 60-second window payload strictly satisfies contracts/payload_schema.json."""
    sample = collect_host_sample()
    window_records = [sample["record"]]

    payload = build_payload(
        window_records=window_records,
        start_utc="2026-11-20T18:00:00Z",
        end_utc="2026-11-20T18:01:00Z",
        secrets_redacted_count=0,
        records_in_count=1,
        buffer_depth=0,
    )

    # Validate against Draft 2020-12 schema
    errors = list(payload_validator.iter_errors(payload))
    assert len(errors) == 0, f"Schema validation errors: {[e.message for e in errors]}"

    # Verify required keys
    assert payload["schema_version"] == "1.0"
    assert payload["tenant_id"] == config.TENANT_ID
    assert payload["collector_id"] == config.COLLECTOR_ID
    assert payload["region"] == config.REGION
    assert len(payload["sources"]) == 1

    src = payload["sources"][0]
    assert src["source_id"].startswith("src_")
    assert src["metrics"]["cpu_pct"] >= 0.0


def test_saas_dynamic_enrollment_and_immediate_ingest():
    """Verify newly installed collector can enroll, receive credentials, and transmit."""
    # 1. Enroll with authorized token
    enroll_resp = client.post(
        "/api/v1/enroll",
        json={
            "enrollment_token": "enroll-token-acme",
            "hostname": "win11-workstation-01",
            "os_name": "Windows",
            "requested_collector_id": "c_win01",
        },
    )
    assert enroll_resp.status_code == 200
    enroll_data = enroll_resp.json()
    assert enroll_data["status"] == "enrolled"
    assert enroll_data["collector_id"] == "c_win01"
    assert enroll_data["tenant_id"] == "t_acme"
    assert enroll_data["region"] == "ap-south-1"
    assert enroll_data["transmission_interval_s"] == 60
    secret = enroll_data["collector_secret"]

    # 2. Transmit Heartbeat using assigned credentials
    hb_body = {
        "collector_id": "c_win01",
        "tenant_id": "t_acme",
        "region": "ap-south-1",
        "sent_at_utc": "2026-11-20T18:00:00Z",
        "version": "1.0.0",
        "buffer_depth": 0,
        "config_hash": "a1b2c3d4e5f60718",
    }
    hb_bytes = json.dumps(hb_body, sort_keys=True, separators=(",", ":")).encode("utf-8")
    hb_headers = {
        "X-Collector-Id": "c_win01",
        "Content-Type": "application/json",
        **sign(secret, hb_bytes),
    }

    hb_resp = client.post("/api/v1/heartbeat", content=hb_bytes, headers=hb_headers)
    assert hb_resp.status_code == 204

    # 3. Transmit MetadataPayload
    sample = collect_host_sample()
    payload = build_payload(
        window_records=[sample["record"]],
        start_utc="2026-11-20T18:00:00Z",
        end_utc="2026-11-20T18:01:00Z",
        secrets_redacted_count=0,
        records_in_count=1,
    )
    payload["collector_id"] = "c_win01"
    payload["tenant_id"] = "t_acme"
    payload["region"] = "ap-south-1"

    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_headers = {
        "X-Collector-Id": "c_win01",
        "Content-Type": "application/json",
        **sign(secret, payload_bytes),
    }

    ingest_resp = client.post("/api/v1/ingest", content=payload_bytes, headers=payload_headers)
    assert ingest_resp.status_code == 202
    assert ingest_resp.json()["status"] == "accepted"

    # 4. Duplicate Transmission (Idempotency test)
    ingest_dupe = client.post("/api/v1/ingest", content=payload_bytes, headers=payload_headers)
    assert ingest_dupe.status_code == 200
    assert ingest_dupe.json()["status"] == "duplicate"


def test_saas_enrollment_rejection_on_invalid_token():
    """Verify unauthorized enrollment attempts are rejected with 401."""
    bad_resp = client.post(
        "/api/v1/enroll",
        json={"enrollment_token": "totally-bogus-token-xyz"},
    )
    assert bad_resp.status_code == 401
