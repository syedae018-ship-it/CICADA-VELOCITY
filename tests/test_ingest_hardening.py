"""Review fixes for Person B: auth has no default tenant, rollback on partial failure,
offline/online transitions, exact egress bytes, and the Supabase backend contract."""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import transport
from collector.app import app as collector_app
from saas import config as saas_config
from saas import db as saas_db
from saas.app import app as saas_app
from saas.db import DuplicatePayload, SupabaseStore, connect, get_store
from saas.ingest import routes as ingest_routes
from transport.signing import sign

SAMPLE_DIR = Path("contracts/sample_payloads")


def _signed(path: str):
    raw = (SAMPLE_DIR / path).read_bytes()
    cid = json.loads(raw)["collector_id"]
    return raw, {"X-Collector-Id": cid, "Content-Type": "application/json", **sign(f"dev-secret-{cid}", raw)}


def test_read_api_requires_auth_and_never_defaults_to_a_tenant():
    client = TestClient(saas_app)
    assert client.get("/api/v1/collectors").status_code == 401
    assert client.get("/api/v1/collectors", headers={"Authorization": "Bearer garbage"}).status_code == 401
    assert client.get("/api/v1/collectors", headers={"Authorization": "Basic abc"}).status_code == 401
    assert client.get("/api/v1/collectors", headers={"Authorization": "Bearer demo-t_nobody"}).status_code == 401


def test_demo_tokens_disabled_when_not_dev(monkeypatch):
    monkeypatch.setattr(saas_config, "DEV_INSECURE", False)
    client = TestClient(saas_app)
    assert client.get("/api/v1/collectors", headers={"Authorization": "Bearer demo-t_acme"}).status_code == 401


def test_tenant_isolation_on_read_api():
    client = TestClient(saas_app)
    for f in ("01_normal.json", "05_other_tenant.json"):
        raw, h = _signed(f)
        assert client.post("/api/v1/ingest", content=raw, headers=h).status_code == 202
    acme = client.get("/api/v1/metrics", headers={"Authorization": "Bearer demo-t_acme"}).json()
    globex = client.get("/api/v1/metrics", headers={"Authorization": "Bearer demo-t_globex"}).json()
    assert {m["source_id"] for m in acme}.isdisjoint({m["source_id"] for m in globex})
    assert [c["collector_id"] for c in client.get("/api/v1/collectors", headers={"Authorization": "Bearer demo-t_globex"}).json()] == ["c_fra01"]


def test_partial_failure_rolls_back_so_retry_is_not_a_duplicate(monkeypatch):
    client = TestClient(saas_app)
    raw, h = _signed("01_normal.json")
    store = get_store()
    real = store.insert_metrics

    def boom(*a, **k):
        raise RuntimeError("db hiccup")

    monkeypatch.setattr(store, "insert_metrics", boom)
    assert client.post("/api/v1/ingest", content=raw, headers=h).status_code == 503
    monkeypatch.setattr(store, "insert_metrics", real)
    resp = client.post("/api/v1/ingest", content=raw, headers=h)
    assert resp.status_code == 202 and resp.json()["status"] == "accepted"


def test_wrong_region_is_rejected():
    client = TestClient(saas_app)
    doc = json.loads((SAMPLE_DIR / "01_normal.json").read_text())
    doc["region"] = "eu-west-1"
    raw = json.dumps(doc).encode()
    h = {"X-Collector-Id": "c_blr01", "Content-Type": "application/json", **sign("dev-secret-c_blr01", raw)}
    assert client.post("/api/v1/ingest", content=raw, headers=h).status_code == 403


def test_offline_then_back_online_is_recorded():
    client = TestClient(saas_app)
    raw, h = _signed("heartbeat.json")
    assert client.post("/api/v1/heartbeat", content=raw, headers=h).status_code == 204

    later = datetime.now(timezone.utc) + timedelta(seconds=61)
    assert ingest_routes.check_offline_collectors(now=later) == ["c_blr01"]
    raw, h = _signed("heartbeat.json")
    assert client.post("/api/v1/heartbeat", content=raw, headers=h).status_code == 204

    hist = connect("ap-south-1").execute(
        "SELECT state, reason FROM health_history WHERE entity_id = 'c_blr01' ORDER BY id").fetchall()
    reasons = [(r["state"], r["reason"].split(" for ")[0]) for r in hist]
    assert reasons == [("good", "collector first seen"), ("poor", "no heartbeat"), ("good", "collector reconnected")]


def test_egress_panel_returns_exact_bytes_matching_sha256():
    doc = json.loads((SAMPLE_DIR / "01_normal.json").read_text())
    pid = transport.submit(doc)
    item = TestClient(collector_app).get(f"/local/egress/{pid}").json()
    assert hashlib.sha256(item["body_raw"].encode()).hexdigest() == item["sha256"]
    assert item["body"]["payload_id"] == pid


def test_collector_status_reports_transport_state():
    transport.submit(json.loads((SAMPLE_DIR / "01_normal.json").read_text()))
    st = TestClient(collector_app).get("/local/status").json()
    assert st["buffer_depth"] == 1 and "saas_link_enabled" in st


# ───── Supabase backend contract (fake client, no network) ─────

class _Resp:
    def __init__(self, data=None, count=None):
        self.data, self.count = data or [], count


class _Query:
    def __init__(self, db, table):
        self.db, self.table, self.op, self.payload, self.filters = db, table, "select", None, []

    def insert(self, rows):
        self.op, self.payload = "insert", rows if isinstance(rows, list) else [rows]
        return self

    def upsert(self, rows, **_):
        return self.insert(rows)

    def update(self, fields):
        self.op, self.payload = "update", fields
        return self

    def delete(self):
        self.op = "delete"
        return self

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self.filters.append((col, val))
        return self

    def __getattr__(self, _name):           # order / limit / gte / lte: ignored by the fake
        return lambda *a, **k: self

    def execute(self):
        from postgrest.exceptions import APIError
        rows = self.db.setdefault(self.table, [])
        match = [r for r in rows if all(r.get(c) == v for c, v in self.filters)]
        if self.op == "insert":
            for r in self.payload:
                if self.table == "received_payloads" and any(x["payload_id"] == r["payload_id"] for x in rows):
                    raise APIError({"code": "23505", "message": "duplicate key"})
                if "tenant_id" not in r:
                    raise AssertionError(f"insert into {self.table} without tenant_id")
                rows.append(dict(r))
        elif self.op == "update":
            assert any(c == "tenant_id" for c, _ in self.filters), "update without tenant filter"
            for r in match:
                r.update(self.payload)
        elif self.op == "delete":
            assert any(c == "tenant_id" for c, _ in self.filters), "delete without tenant filter"
            self.db[self.table] = [r for r in rows if r not in match]
        return _Resp(match, len(match))


class _FakeClient:
    def __init__(self):
        self.db = {"tenants": [{"tenant_id": "t_acme"}],
                   "collectors": [{"collector_id": "c_blr01", "tenant_id": "t_acme", "status": "offline"}]}

    def table(self, name):
        return _Query(self.db, name)


def test_supabase_store_ingest_dedupe_and_tenant_filters():
    fake = _FakeClient()
    saas_db.set_store(SupabaseStore(fake))
    try:
        client = TestClient(saas_app)
        raw, h = _signed("01_normal.json")
        assert client.post("/api/v1/ingest", content=raw, headers=h).json()["status"] == "accepted"
        assert client.post("/api/v1/ingest", content=raw, headers=h).json()["status"] == "duplicate"
        assert len(fake.db["received_payloads"]) == 1
        assert len(fake.db["metrics"]) == 9                    # 5 server + 4 network numeric/bool metrics
        assert fake.db["collectors"][0]["status"] == "online"
        with pytest.raises(DuplicatePayload):
            get_store().record_payload(dict(fake.db["received_payloads"][0]))
    finally:
        saas_db.set_store(None)
