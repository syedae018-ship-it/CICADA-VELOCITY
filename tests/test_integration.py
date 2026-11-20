"""Cross-module integration (dev): collector payload → ingest (B) → AIOps (C) → persisted rows the dashboard reads."""
import copy
import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from saas.aiops import STORE
from saas.aiops import engine
from saas.aiops import store as aiops_store
from saas.app import app as saas_app
from saas.db import connect
from transport.signing import sign

SAMPLES = Path("contracts/sample_payloads")


@pytest.fixture(autouse=True)
def fresh_engine(monkeypatch):
    monkeypatch.setattr(aiops_store, "PERSIST_ENABLED", True)
    monkeypatch.setattr(aiops_store, "PERSIST_ASYNC", False)      # write synchronously so assertions see rows
    for attr in ("alerts", "incidents", "recommendations", "health_history", "audit_log", "sources", "services", "collectors"):
        getattr(STORE, attr).clear()
    engine.PROCESSED_PAYLOADS._cache.clear()
    yield


def _send(client, doc):
    raw = json.dumps(doc).encode()
    h = {"X-Collector-Id": doc["collector_id"], "Content-Type": "application/json", **sign(f"dev-secret-{doc['collector_id']}", raw)}
    return client.post("/api/v1/ingest", content=raw, headers=h)


def _payload(name, seq, at):
    d = copy.deepcopy(json.loads((SAMPLES / name).read_text()))
    d["payload_id"], d["seq"] = str(uuid.uuid4()), seq
    ts = at.isoformat().replace("+00:00", "Z")
    d["sent_at_utc"] = ts
    for s in d["sources"]:
        s["event_time_utc"] = ts
    for e in d["events"]:
        e["event_time_utc"], e["event_id"] = ts, str(uuid.uuid4())
    return d


def test_pipeline_persists_explained_alerts_incidents_and_recommendations():
    client = TestClient(saas_app)
    t0 = datetime.now(timezone.utc) - timedelta(minutes=5)
    for i in range(25):                                         # build a normal baseline
        assert _send(client, _payload("01_normal.json", i + 1, t0 + timedelta(seconds=5 * i))).status_code == 202
    assert _send(client, _payload("02_cpu_anomaly.json", 26, t0 + timedelta(seconds=130))).status_code == 202
    assert _send(client, _payload("03_failed_logins.json", 27, t0 + timedelta(seconds=135))).status_code == 202

    db = connect("ap-south-1")
    alerts = db.execute("SELECT * FROM alerts WHERE tenant_id = 't_acme'").fetchall()
    incidents = db.execute("SELECT * FROM incidents WHERE tenant_id = 't_acme'").fetchall()
    recs = db.execute("SELECT * FROM recommendations WHERE tenant_id = 't_acme'").fetchall()
    assert alerts and incidents and recs
    assert all(json.loads(a["explanation"]).get("why") for a in alerts), "every alert must carry an explanation"
    assert all(a["incident_id"] for a in alerts), "alerts must be linked to their incident after correlation"
    assert {a["kind"] for a in alerts} >= {"security"}
    assert all(json.loads(r["reasoning_path"]) for r in recs)

    # Read API (shared auth) returns the same thing, and tenants stay isolated
    acme = client.get("/api/v1/incidents", headers={"Authorization": "Bearer demo-t_acme"}).json()
    assert len(acme) == len(incidents)
    assert client.get("/api/v1/incidents", headers={"Authorization": "Bearer demo-t_globex"}).json() == []
    assert client.get("/api/v1/incidents").status_code == 401

    # Approve → audit → rollback is persisted
    rec_id = recs[0]["rec_id"]
    h = {"Authorization": "Bearer demo-t_acme"}
    assert client.post(f"/api/v1/recommendations/{rec_id}/approve", headers=h).json()["status"] == "executed_simulated"
    assert client.post(f"/api/v1/recommendations/{rec_id}/rollback", headers=h).json()["status"] == "rolled_back"
    assert db.execute("SELECT status FROM recommendations WHERE rec_id = ?", (rec_id,)).fetchone()["status"] == "rolled_back"
    actions = [r["action"] for r in db.execute("SELECT action FROM audit_log WHERE tenant_id='t_acme'").fetchall()]
    assert "approve_recommendation" in actions and "rollback_recommendation" in actions


def test_duplicate_payload_does_not_reach_aiops_twice():
    client = TestClient(saas_app)
    d = _payload("03_failed_logins.json", 1, datetime.now(timezone.utc))
    assert _send(client, d).json()["status"] == "accepted"
    n = len(STORE.alerts.get("t_acme", []))
    assert _send(client, d).json()["status"] == "duplicate"
    assert len(STORE.alerts.get("t_acme", [])) == n
