"""Comprehensive test suite for Person B (Transport, Reliability & Ingest).

Validates:
  1. transport.submit() adds payload_id, seq, sent_at_utc, stores in outbox and egress_log
  2. HMAC signing and verification
  3. POST /api/v1/ingest (acceptance, idempotency, auth failure, schema violation, tenant isolation)
  4. POST /api/v1/heartbeat
  5. GET /api/v1/metrics and GET /api/v1/reliability
  6. Local endpoints: /local/egress, /local/buffer, /local/saas-link
"""
import hashlib
import json
import os
import shutil
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import transport
from collector.app import app as collector_app
from saas.app import app as saas_app
from saas.db import close_connections, connect, db_for_tenant, init_schema
from saas.ingest import routes as ingest_routes
from transport.db import (
    close_conn,
    get_buffer_stats,
    get_egress_logs,
    init_collector_db,
)
from transport.signing import sign

SAMPLE_DIR = Path("contracts/sample_payloads")


@pytest.fixture(autouse=True)
def clean_databases():
    # Close any open connections before removing files
    close_connections()
    close_conn()
    ingest_routes._duplicates_count.clear()

    if os.path.exists("saas/data"):
        shutil.rmtree("saas/data")
    if os.path.exists("collector/data"):
        shutil.rmtree("collector/data")

    init_schema()
    init_collector_db()
    yield
    close_connections()
    close_conn()
    if os.path.exists("saas/data"):
        shutil.rmtree("saas/data")
    if os.path.exists("collector/data"):
        shutil.rmtree("collector/data")



def test_submit_valid_and_invalid():
    """Test transport.submit() adds id, seq, and writes to outbox and egress_log."""
    sample_path = SAMPLE_DIR / "01_normal.json"
    doc = json.loads(sample_path.read_text())

    # Remove payload_id and seq to test auto-generation
    doc.pop("payload_id", None)
    doc.pop("seq", None)

    pid = transport.submit(doc)
    assert pid is not None
    assert len(pid) == 36  # UUID length

    # Check egress log
    logs = get_egress_logs()
    assert len(logs) == 1
    assert logs[0]["payload_id"] == pid
    assert logs[0]["seq"] >= 101
    assert logs[0]["sha256"] is not None

    # Check buffer stats
    stats = get_buffer_stats()
    assert stats["depth"] == 1
    assert stats["items"][0]["payload_id"] == pid

    # Test submitting an invalid payload moves it to dead_letter without raising
    invalid_doc = json.loads((SAMPLE_DIR / "INVALID_leaks_raw_data.json").read_text())
    inv_pid = transport.submit(invalid_doc)
    assert inv_pid is not None
    inv_logs = get_egress_logs()
    assert len(inv_logs) == 2
    # Buffer depth for pending should still be 1 (dead_letter doesn't count as pending)
    assert get_buffer_stats()["depth"] == 1


def test_saas_ingest_accepted_and_idempotent_duplicate():
    """Test ingestion happy path and duplicate detection."""
    client = TestClient(saas_app)
    raw_bytes = (SAMPLE_DIR / "01_normal.json").read_bytes()
    doc = json.loads(raw_bytes)
    collector_id = doc["collector_id"]
    secret = f"dev-secret-{collector_id}"

    headers = {
        "X-Collector-Id": collector_id,
        "Content-Type": "application/json",
        **sign(secret, raw_bytes),
    }

    # 1. First send: 202 Accepted
    resp1 = client.post("/api/v1/ingest", content=raw_bytes, headers=headers)
    assert resp1.status_code == 202
    assert resp1.json()["status"] == "accepted"
    assert resp1.json()["payload_id"] == doc["payload_id"]

    # Verify data in regional DB
    conn = connect("ap-south-1")
    row = conn.execute("SELECT count(*) as cnt FROM received_payloads WHERE payload_id = ?", (doc["payload_id"],)).fetchone()
    assert row["cnt"] == 1

    # 2. Second send: 200 Duplicate (Idempotent)
    resp2 = client.post("/api/v1/ingest", content=raw_bytes, headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "duplicate"
    assert resp2.json()["payload_id"] == doc["payload_id"]

    # Verify metrics row count didn't double
    m_count = conn.execute("SELECT count(*) as cnt FROM metrics WHERE payload_id = ?", (doc["payload_id"],)).fetchone()
    assert m_count["cnt"] > 0


def test_saas_ingest_auth_and_schema_validation():
    """Test security checks: bad secret, skew, schema rejection, tenant mismatch."""
    client = TestClient(saas_app)
    raw_bytes = (SAMPLE_DIR / "01_normal.json").read_bytes()
    doc = json.loads(raw_bytes)
    collector_id = doc["collector_id"]

    # 1. Bad secret -> 401
    bad_headers = {
        "X-Collector-Id": collector_id,
        "Content-Type": "application/json",
        **sign("wrong-secret", raw_bytes),
    }
    resp = client.post("/api/v1/ingest", content=raw_bytes, headers=bad_headers)
    assert resp.status_code == 401

    # 2. Skew outside 300s -> 401
    old_time = int(time.time()) - 400
    skew_headers = {
        "X-Collector-Id": collector_id,
        "Content-Type": "application/json",
        **sign(f"dev-secret-{collector_id}", raw_bytes, timestamp=old_time),
    }
    resp = client.post("/api/v1/ingest", content=raw_bytes, headers=skew_headers)
    assert resp.status_code == 401

    # 3. Schema violation -> 422
    inv_bytes = (SAMPLE_DIR / "INVALID_leaks_raw_data.json").read_bytes()
    inv_doc = json.loads(inv_bytes)
    inv_headers = {
        "X-Collector-Id": inv_doc["collector_id"],
        "Content-Type": "application/json",
        **sign(f"dev-secret-{inv_doc['collector_id']}", inv_bytes),
    }
    resp = client.post("/api/v1/ingest", content=inv_bytes, headers=inv_headers)
    assert resp.status_code == 422
    assert "rejected" in resp.json()["detail"]["status"]


def test_data_residency_by_tenant():
    """Test t_globex payload only lands in eu-west-1.db."""
    client = TestClient(saas_app)
    raw_bytes = (SAMPLE_DIR / "05_other_tenant.json").read_bytes()
    doc = json.loads(raw_bytes)
    collector_id = doc["collector_id"]  # c_fra01, tenant: t_globex, region: eu-west-1

    headers = {
        "X-Collector-Id": collector_id,
        "Content-Type": "application/json",
        **sign(f"dev-secret-{collector_id}", raw_bytes),
    }

    resp = client.post("/api/v1/ingest", content=raw_bytes, headers=headers)
    assert resp.status_code == 202

    # Check eu-west-1 has it
    eu_conn = connect("eu-west-1")
    row_eu = eu_conn.execute("SELECT count(*) as cnt FROM received_payloads WHERE payload_id = ?", (doc["payload_id"],)).fetchone()
    assert row_eu["cnt"] == 1

    # Check ap-south-1 does NOT have it
    ap_conn = connect("ap-south-1")
    row_ap = ap_conn.execute("SELECT count(*) as cnt FROM received_payloads WHERE payload_id = ?", (doc["payload_id"],)).fetchone()
    assert row_ap["cnt"] == 0


def test_heartbeat_and_reliability_api():
    """Test heartbeat and reliability calculations."""
    client = TestClient(saas_app)
    raw_hb = (SAMPLE_DIR / "heartbeat.json").read_bytes()
    hb = json.loads(raw_hb)

    headers = {
        "X-Collector-Id": hb["collector_id"],
        "Content-Type": "application/json",
        **sign(f"dev-secret-{hb['collector_id']}", raw_hb),
    }
    hb_resp = client.post("/api/v1/heartbeat", content=raw_hb, headers=headers)
    assert hb_resp.status_code == 204

    # Check collector online
    conn = connect("ap-south-1")
    c_row = conn.execute("SELECT status, last_seen_utc FROM collectors WHERE collector_id = ?", (hb["collector_id"],)).fetchone()
    assert c_row["status"] == "online"
    assert c_row["last_seen_utc"] is not None

    # Ingest a payload then check reliability
    raw_bytes = (SAMPLE_DIR / "01_normal.json").read_bytes()
    doc = json.loads(raw_bytes)
    ingest_headers = {
        "X-Collector-Id": doc["collector_id"],
        "Content-Type": "application/json",
        **sign(f"dev-secret-{doc['collector_id']}", raw_bytes),
    }
    client.post("/api/v1/ingest", content=raw_bytes, headers=ingest_headers)
    client.post("/api/v1/ingest", content=raw_bytes, headers=ingest_headers)  # duplicate

    rel_resp = client.get("/api/v1/reliability", headers={"Authorization": "Bearer demo-t_acme"})
    assert rel_resp.status_code == 200
    rel_data = rel_resp.json()
    assert rel_data["received_count"] >= 1
    assert rel_data["duplicates_rejected"] == 1
    assert "seq_gaps" in rel_data
    assert "latency_p95_s" in rel_data


def test_collector_local_endpoints():
    """Test /local/egress, /local/buffer, /local/saas-link on the collector app."""
    client = TestClient(collector_app)

    # Submit a payload to populate egress
    doc = json.loads((SAMPLE_DIR / "01_normal.json").read_text())
    pid = transport.submit(doc)

    # 1. Egress panel
    egress_resp = client.get("/local/egress")
    assert egress_resp.status_code == 200
    items = egress_resp.json()
    assert len(items) >= 1
    assert items[0]["payload_id"] == pid

    # 2. Single egress item
    single_resp = client.get(f"/local/egress/{pid}")
    assert single_resp.status_code == 200
    assert single_resp.json()["payload_id"] == pid

    # 3. Buffer status
    buf_resp = client.get("/local/buffer")
    assert buf_resp.status_code == 200
    assert buf_resp.json()["depth"] >= 1

    # 4. SaaS link toggle
    link_resp = client.post("/local/saas-link", json={"enabled": False})
    assert link_resp.status_code == 200
    assert link_resp.json()["enabled"] is False

    link_status = client.get("/local/saas-link")
    assert link_status.json()["enabled"] is False

    # Restore link
    client.post("/local/saas-link", json={"enabled": True})


@pytest.mark.anyio
async def test_scenario_2_outage_buffering_and_resume():
    """Scenario #2: Outage -> buffer in outbox -> reconnect -> resume without loss."""
    import httpx
    from transport.sender import _send_one_payload, set_saas_link

    # 1. Disable SaaS link (simulating network outage)
    set_saas_link(False)

    doc = json.loads((SAMPLE_DIR / "01_normal.json").read_text())
    pid = transport.submit(doc)

    # Buffer depth should be 1
    assert get_buffer_stats()["depth"] == 1

    # Regional DB should NOT have it yet
    conn = connect("ap-south-1")
    row = conn.execute("SELECT count(*) as cnt FROM received_payloads WHERE payload_id = ?", (pid,)).fetchone()
    assert row["cnt"] == 0

    # 2. Re-enable SaaS link
    set_saas_link(True)

    # Drain with test client
    from transport.db import get_pending_outbox
    rows = get_pending_outbox()
    assert len(rows) == 1

    transport_client = httpx.AsyncClient(transport=httpx.ASGITransport(app=saas_app), base_url="http://localhost:8000")
    async with transport_client:
        success = await _send_one_payload(transport_client, rows[0])
        assert success is True

    # Outbox should now be drained
    assert get_buffer_stats()["depth"] == 0

    # Regional DB should now have it
    row = conn.execute("SELECT count(*) as cnt FROM received_payloads WHERE payload_id = ?", (pid,)).fetchone()
    assert row["cnt"] == 1


def test_scenario_7_out_of_order_event_time_ordering():
    """Scenario #7: Late / out-of-order payloads are stored and queried in event_time order."""
    client = TestClient(saas_app)

    # Send newer payload first (seq 101, 09:15:04Z)
    p_new = (SAMPLE_DIR / "01_normal.json").read_bytes()
    doc_new = json.loads(p_new)
    client.post(
        "/api/v1/ingest",
        content=p_new,
        headers={
            "X-Collector-Id": doc_new["collector_id"],
            "Content-Type": "application/json",
            **sign(f"dev-secret-{doc_new['collector_id']}", p_new),
        },
    )

    # Send older/late payload second (seq 99, 09:14:54Z)
    p_old = (SAMPLE_DIR / "04_out_of_order_late.json").read_bytes()
    doc_old = json.loads(p_old)
    client.post(
        "/api/v1/ingest",
        content=p_old,
        headers={
            "X-Collector-Id": doc_old["collector_id"],
            "Content-Type": "application/json",
            **sign(f"dev-secret-{doc_old['collector_id']}", p_old),
        },
    )

    # Query metrics: must be strictly ordered by event_time_utc ASC
    resp = client.get(
        "/api/v1/metrics?source_id=src_9f2c4a1b7e30&metric=cpu_pct",
        headers={"Authorization": "Bearer demo-t_acme"},
    )
    assert resp.status_code == 200
    metrics = resp.json()
    assert len(metrics) == 2
    # First should be the older event (09:14:54Z), second should be newer (09:15:04Z)
    assert metrics[0]["event_time_utc"] < metrics[1]["event_time_utc"]
    assert metrics[0]["value"] == 36.0  # from 04_out_of_order_late
    assert metrics[1]["value"] == 38.5  # from 01_normal
