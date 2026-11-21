"""Ingest firewall: the gate between collectors and the SaaS receiver."""
import json
from pathlib import Path

from fastapi.testclient import TestClient

from saas.app import app
from saas.ingest.firewall import IngestFirewall
from transport.signing import sign

SAMPLE = Path(__file__).resolve().parent.parent / "contracts" / "sample_payloads"
AUTH = {"Authorization": "Bearer demo-t_acme"}


def test_selftest_blocks_every_hostile_probe_and_allows_clean():
    with TestClient(app) as client:
        r = client.post("/api/v1/firewall/selftest", headers=AUTH)
        assert r.status_code == 200
        body = r.json()
        assert body["passed"] == body["total"] == 8, body["results"]
        status = client.get("/api/v1/firewall/status", headers=AUTH).json()
        assert status["counters"]["blocked"] >= 7
        assert {r["id"] for r in status["rules"]} >= {"ip_allowlist", "content_scan", "hmac_auth", "schema"}


def test_status_requires_auth():
    with TestClient(app) as client:
        assert client.get("/api/v1/firewall/status").status_code == 401


def test_wrong_content_type_blocked_before_auth():
    raw = (SAMPLE / "01_normal.json").read_bytes()
    with TestClient(app) as client:
        r = client.post("/api/v1/ingest", content=raw, headers={
            "X-Collector-Id": "c_blr01", "Content-Type": "text/plain", **sign("dev-secret-c_blr01", raw)})
        assert r.status_code == 415
        assert r.json()["detail"]["rule"] == "content_type"


def test_repeated_bad_signatures_quarantine_source():
    fw = IngestFirewall()
    for _ in range(5):
        fw.deny("hmac_auth", "10.1.2.3", "c_evil", "ingest", "bad sig")
    try:
        fw.inspect(ip="10.1.2.3", collector_id=None, content_type="application/json", body=b"{}", endpoint="ingest")
        raise AssertionError("expected quarantine")
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403
        assert exc.detail["rule"] == "quarantine"


def test_content_scan_ignores_ids_and_timestamps():
    doc = json.loads((SAMPLE / "01_normal.json").read_text())
    assert IngestFirewall._scan(doc) is None
