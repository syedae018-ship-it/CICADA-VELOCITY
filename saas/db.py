"""SaaS storage. Owner: Person B. Used by ingest (Person B) and aiops (Person C).

Two interchangeable backends behind one interface, chosen at startup:
  * SupabaseStore: when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set (team decision, the default for the demo).
                   Schema: contracts/supabase/001_init.sql. The service role bypasses RLS, so EVERY
                   query here filters by tenant_id explicitly.
  * SqliteStore:   offline fallback, one file per region -> saas/data/<region>.db (data residency demo).

Routes and AIOps must call get_store() and never talk to sqlite3 / supabase directly.
"""
import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from saas import config

_connections: dict[str, sqlite3.Connection] = {}
_lock = threading.RLock()          # sqlite3 connections are shared between the event loop and the threadpool
_supabase_client = None
_store: Optional["BaseStore"] = None


class DuplicatePayload(Exception):
    """Raised by record_payload() when payload_id was already received (idempotent retry)."""


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


SCHEMA_SQL = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id    TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  home_region  TEXT NOT NULL,
  created_utc  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_members (
  user_id    TEXT NOT NULL,
  tenant_id  TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS collectors (
  collector_id   TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(tenant_id),
  region         TEXT NOT NULL,
  version        TEXT,
  status         TEXT NOT NULL DEFAULT 'offline',
  state          TEXT,
  last_seen_utc  TEXT,
  buffer_depth   INTEGER DEFAULT 0,
  cpu_pct        REAL,
  mem_pct        REAL,
  config_hash    TEXT
);

CREATE TABLE IF NOT EXISTS received_payloads (
  payload_id       TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL REFERENCES tenants(tenant_id),
  collector_id     TEXT NOT NULL,
  seq              INTEGER NOT NULL,
  sent_at_utc      TEXT NOT NULL,
  received_at_utc  TEXT NOT NULL,
  body_sha256      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rp_tenant_collector_seq ON received_payloads (tenant_id, collector_id, seq);

CREATE TABLE IF NOT EXISTS metrics (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id        TEXT NOT NULL REFERENCES tenants(tenant_id),
  collector_id     TEXT NOT NULL,
  source_id        TEXT NOT NULL,
  service          TEXT,
  source_type      TEXT,
  metric           TEXT NOT NULL,
  value            REAL NOT NULL,
  event_time_utc   TEXT NOT NULL,
  received_at_utc  TEXT NOT NULL,
  payload_id       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS metrics_lookup ON metrics (tenant_id, source_id, metric, event_time_utc);

CREATE TABLE IF NOT EXISTS events (
  event_id         TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL REFERENCES tenants(tenant_id),
  collector_id     TEXT NOT NULL,
  source_id        TEXT NOT NULL,
  category         TEXT NOT NULL,
  severity         TEXT NOT NULL,
  type             TEXT NOT NULL,
  count            INTEGER NOT NULL,
  summary          TEXT NOT NULL,
  event_time_utc   TEXT NOT NULL,
  received_at_utc  TEXT NOT NULL,
  payload_id       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  incident_id            TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL REFERENCES tenants(tenant_id),
  title                  TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'open',
  severity               TEXT NOT NULL,
  started_utc            TEXT NOT NULL,
  updated_utc            TEXT NOT NULL,
  alert_count            INTEGER NOT NULL DEFAULT 1,
  suppressed_duplicates  INTEGER NOT NULL DEFAULT 0,
  affected_sources       TEXT NOT NULL DEFAULT '[]',
  likely_cause           TEXT,
  correlation_rule       TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id        TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(tenant_id),
  source_id       TEXT,
  service         TEXT,
  kind            TEXT NOT NULL,
  metric          TEXT,
  severity        TEXT NOT NULL,
  state           TEXT,
  event_time_utc  TEXT NOT NULL,
  created_at_utc  TEXT NOT NULL,
  incident_id     TEXT REFERENCES incidents(incident_id),
  explanation     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS alerts_tenant_time ON alerts (tenant_id, created_at_utc DESC);

CREATE TABLE IF NOT EXISTS recommendations (
  rec_id                TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL REFERENCES tenants(tenant_id),
  incident_id           TEXT REFERENCES incidents(incident_id),
  action                TEXT NOT NULL,
  reasoning_path        TEXT NOT NULL,
  contributing_signals  TEXT NOT NULL,
  confidence            REAL NOT NULL,
  risk                  TEXT,
  policy_check          TEXT,
  rollback_plan         TEXT,
  requires_approval     INTEGER NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'proposed',
  approved_by           TEXT,
  updated_utc           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS health_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id    TEXT NOT NULL REFERENCES tenants(tenant_id),
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  prev_state   TEXT,
  state        TEXT NOT NULL,
  reason       TEXT NOT NULL,
  at_utc       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id  TEXT NOT NULL REFERENCES tenants(tenant_id),
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT,
  details    TEXT,
  at_utc     TEXT NOT NULL
);
"""


# ───────────────────────────── SQLite plumbing (also used by the fallback store) ─────────────────────────────

def get_supabase_client():
    global _supabase_client
    if _supabase_client is None and config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY:
        from supabase import create_client
        _supabase_client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
    return _supabase_client


def connect(region: str) -> sqlite3.Connection:
    """Connect to the regional SQLite database file (saas/data/<region>.db)."""
    if region not in config.REGIONS:
        raise ValueError(f"Unknown region: {region}. Must be one of {config.REGIONS}")
    with _lock:
        if region not in _connections:
            data_dir = Path(config.DATA_DIR)
            data_dir.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(str(data_dir / f"{region}.db"), check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA foreign_keys=ON;")
            _connections[region] = conn
        return _connections[region]


def close_connections() -> None:
    global _store
    with _lock:
        for conn in _connections.values():
            try:
                conn.close()
            except Exception:
                pass
        _connections.clear()
        _store = None


def init_schema() -> None:
    """Create all tables in all regional SQLite databases and seed default tenants/collectors."""
    now = now_utc()
    with _lock:
        for region in config.REGIONS:
            conn = connect(region)
            conn.executescript(SCHEMA_SQL)
            for tenant_id, t in config.TENANTS.items():
                conn.execute(
                    "INSERT OR IGNORE INTO tenants (tenant_id, name, home_region, created_utc) VALUES (?, ?, ?, ?)",
                    (tenant_id, t["name"], t["home_region"], now),
                )
            for collector_id, c in config.COLLECTORS.items():
                conn.execute(
                    "INSERT OR IGNORE INTO collectors (collector_id, tenant_id, region, status) VALUES (?, ?, ?, 'offline')",
                    (collector_id, c["tenant_id"], c["region"]),
                )
            conn.commit()


def region_for_tenant(tenant_id: str) -> str:
    t = config.TENANTS.get(tenant_id)
    return t["home_region"] if t else "ap-south-1"


def db_for_tenant(tenant_id: str) -> sqlite3.Connection:
    """SQLite connection for the tenant's home region (data residency). SQLite backend only."""
    return connect(region_for_tenant(tenant_id))


def tenant_query(tenant_id: str, sql: str, params: tuple | list = ()) -> list[dict]:
    """SQLite read strictly bound to tenant_id. Refuses SQL without a tenant filter."""
    if not tenant_id:
        raise ValueError("tenant_id is required for tenant_query")
    if "tenant_id" not in sql.lower():
        raise ValueError("Tenant isolation violation: query must filter by tenant_id")
    with _lock:
        return [dict(r) for r in db_for_tenant(tenant_id).execute(sql, params).fetchall()]


# ───────────────────────────── AIOps tables (written by Person C via upsert_row) ─────────────────────────────

AIOPS_TABLES: dict[str, tuple[str, tuple[str, ...]]] = {   # table -> (primary key, columns)
    "alerts": ("alert_id", ("alert_id", "tenant_id", "source_id", "service", "kind", "metric", "severity", "state",
                            "event_time_utc", "created_at_utc", "incident_id", "explanation", "status")),
    "incidents": ("incident_id", ("incident_id", "tenant_id", "title", "status", "severity", "started_utc", "updated_utc",
                                  "alert_count", "suppressed_duplicates", "affected_sources", "likely_cause",
                                  "correlation_rule")),
    "recommendations": ("rec_id", ("rec_id", "tenant_id", "incident_id", "action", "reasoning_path", "contributing_signals",
                                   "confidence", "risk", "policy_check", "rollback_plan", "requires_approval", "status",
                                   "approved_by", "updated_utc")),
}
_JSON_COLUMNS = {"explanation", "affected_sources", "reasoning_path", "contributing_signals", "policy_check", "details"}


def project_row(table: str, row: dict) -> dict:
    """Keep only the columns the table has (engine objects carry extra UI fields) and fill required defaults."""
    _, cols = AIOPS_TABLES[table]
    out = {c: row.get(c) for c in cols if c in row}
    now = now_utc()
    if table == "alerts":
        out.setdefault("created_at_utc", now)
        out.setdefault("status", "open")
        out["explanation"] = out.get("explanation") or {}
    elif table == "incidents":
        out.setdefault("started_utc", now)
        out["updated_utc"] = out.get("updated_utc") or now
        out["affected_sources"] = out.get("affected_sources") or []
    elif table == "recommendations":
        out["updated_utc"] = out.get("updated_utc") or now
        out["reasoning_path"] = out.get("reasoning_path") or []
        out["contributing_signals"] = out.get("contributing_signals") or []
        out.setdefault("confidence", 0.0)
    return out


# ───────────────────────────── Store interface ─────────────────────────────

class BaseStore:
    name = "base"

    def init(self) -> None: ...
    def record_payload(self, row: dict) -> None: ...              # raises DuplicatePayload
    def delete_payload(self, tenant_id: str, payload_id: str) -> None: ...
    def insert_metrics(self, tenant_id: str, rows: list[dict]) -> None: ...
    def insert_events(self, tenant_id: str, rows: list[dict]) -> None: ...
    def update_collector(self, tenant_id: str, collector_id: str, fields: dict) -> None: ...
    def get_collector(self, tenant_id: str, collector_id: str) -> Optional[dict]: ...
    def list_collectors(self, tenant_id: str) -> list[dict]: ...
    def online_collectors(self) -> list[dict]: ...                # cross-tenant: system task only
    def query_metrics(self, tenant_id: str, source_id=None, metric=None, from_time=None, to_time=None) -> list[dict]: ...
    def received_seqs(self, tenant_id: str, collector_id: str) -> list[int]: ...
    def received_count(self, tenant_id: str) -> int: ...
    def recent_metric_times(self, tenant_id: str, limit: int = 500) -> list[dict]: ...
    def last_alert_times(self, tenant_id: str) -> Optional[dict]: ...
    def insert_health(self, tenant_id: str, row: dict) -> None: ...
    def insert_audit(self, tenant_id: str, row: dict) -> None: ...
    def tenant_for_user(self, user_id: str) -> Optional[str]: ...
    def upsert_row(self, table: str, row: dict) -> None: ...      # alerts / incidents / recommendations


class SqliteStore(BaseStore):
    name = "sqlite"

    def init(self) -> None:
        init_schema()

    def _exec(self, tenant_id: str, sql: str, params=()) -> None:
        with _lock:
            conn = db_for_tenant(tenant_id)
            with conn:
                conn.execute(sql, params)

    def _many(self, tenant_id: str, sql: str, seq: list[tuple]) -> None:
        if not seq:
            return
        with _lock:
            conn = db_for_tenant(tenant_id)
            with conn:
                conn.executemany(sql, seq)

    def record_payload(self, row: dict) -> None:
        try:
            self._exec(row["tenant_id"],
                       """INSERT INTO received_payloads (payload_id, tenant_id, collector_id, seq, sent_at_utc, received_at_utc, body_sha256)
                          VALUES (:payload_id, :tenant_id, :collector_id, :seq, :sent_at_utc, :received_at_utc, :body_sha256)""", row)
        except sqlite3.IntegrityError as exc:
            if "received_payloads.payload_id" in str(exc) or "UNIQUE" in str(exc):
                raise DuplicatePayload(row["payload_id"]) from exc
            raise

    def delete_payload(self, tenant_id, payload_id):
        self._exec(tenant_id, "DELETE FROM received_payloads WHERE tenant_id = ? AND payload_id = ?", (tenant_id, payload_id))

    def insert_metrics(self, tenant_id, rows):
        self._many(tenant_id, """INSERT INTO metrics (tenant_id, collector_id, source_id, service, source_type, metric, value,
                                 event_time_utc, received_at_utc, payload_id)
                                 VALUES (:tenant_id, :collector_id, :source_id, :service, :source_type, :metric, :value,
                                 :event_time_utc, :received_at_utc, :payload_id)""", rows)

    def insert_events(self, tenant_id, rows):
        self._many(tenant_id, """INSERT OR IGNORE INTO events (event_id, tenant_id, collector_id, source_id, category, severity, type,
                                 count, summary, event_time_utc, received_at_utc, payload_id)
                                 VALUES (:event_id, :tenant_id, :collector_id, :source_id, :category, :severity, :type,
                                 :count, :summary, :event_time_utc, :received_at_utc, :payload_id)""", rows)

    def update_collector(self, tenant_id, collector_id, fields):
        if not fields:
            return
        cols = ", ".join(f"{k} = ?" for k in fields)
        self._exec(tenant_id, f"UPDATE collectors SET {cols} WHERE tenant_id = ? AND collector_id = ?",
                   (*fields.values(), tenant_id, collector_id))

    def get_collector(self, tenant_id, collector_id):
        rows = tenant_query(tenant_id, "SELECT * FROM collectors WHERE tenant_id = ? AND collector_id = ?", (tenant_id, collector_id))
        return rows[0] if rows else None

    def list_collectors(self, tenant_id):
        return tenant_query(tenant_id, """SELECT collector_id, region, version, status, state, last_seen_utc, buffer_depth,
                                          cpu_pct, mem_pct, config_hash FROM collectors WHERE tenant_id = ? ORDER BY collector_id""",
                            (tenant_id,))

    def online_collectors(self):
        out: dict[str, dict] = {}
        with _lock:
            for region in config.REGIONS:
                for r in connect(region).execute(
                        "SELECT collector_id, tenant_id, last_seen_utc, state FROM collectors WHERE status = 'online'").fetchall():
                    # each collector is only authoritative in its tenant's home-region DB
                    if region_for_tenant(r["tenant_id"]) == region:
                        out[r["collector_id"]] = dict(r)
        return list(out.values())

    def query_metrics(self, tenant_id, source_id=None, metric=None, from_time=None, to_time=None):
        clauses, params = ["tenant_id = ?"], [tenant_id]
        for col, op, val in (("source_id", "=", source_id), ("metric", "=", metric),
                             ("event_time_utc", ">=", from_time), ("event_time_utc", "<=", to_time)):
            if val:
                clauses.append(f"{col} {op} ?")
                params.append(val)
        return tenant_query(tenant_id, f"""SELECT event_time_utc, value, metric, source_id FROM metrics
                                           WHERE {' AND '.join(clauses)} ORDER BY event_time_utc ASC LIMIT 5000""", params)

    def received_seqs(self, tenant_id, collector_id):
        return [r["seq"] for r in tenant_query(
            tenant_id, "SELECT seq FROM received_payloads WHERE tenant_id = ? AND collector_id = ? ORDER BY seq",
            (tenant_id, collector_id))]

    def received_count(self, tenant_id):
        return tenant_query(tenant_id, "SELECT count(*) AS n FROM received_payloads WHERE tenant_id = ?", (tenant_id,))[0]["n"]

    def recent_metric_times(self, tenant_id, limit=500):
        return tenant_query(tenant_id, """SELECT received_at_utc, event_time_utc FROM metrics WHERE tenant_id = ?
                                          ORDER BY id DESC LIMIT ?""", (tenant_id, limit))

    def last_alert_times(self, tenant_id):
        rows = tenant_query(tenant_id, """SELECT created_at_utc, event_time_utc FROM alerts WHERE tenant_id = ?
                                          ORDER BY created_at_utc DESC LIMIT 1""", (tenant_id,))
        return rows[0] if rows else None

    def insert_health(self, tenant_id, row):
        self._exec(tenant_id, """INSERT INTO health_history (tenant_id, entity_type, entity_id, prev_state, state, reason, at_utc)
                                 VALUES (:tenant_id, :entity_type, :entity_id, :prev_state, :state, :reason, :at_utc)""",
                   {"tenant_id": tenant_id, **row})

    def insert_audit(self, tenant_id, row):
        self._exec(tenant_id, """INSERT INTO audit_log (tenant_id, actor, action, target, details, at_utc)
                                 VALUES (:tenant_id, :actor, :action, :target, :details, :at_utc)""",
                   {"tenant_id": tenant_id, **row, "details": json.dumps(row.get("details"))})

    def upsert_row(self, table, row):
        pk, _ = AIOPS_TABLES[table]
        data = project_row(table, row)
        data = {k: (json.dumps(v) if k in _JSON_COLUMNS and not isinstance(v, str) else v) for k, v in data.items()}
        if isinstance(data.get("requires_approval"), bool):
            data["requires_approval"] = int(data["requires_approval"])
        cols = ", ".join(data)
        marks = ", ".join(f":{k}" for k in data)
        updates = ", ".join(f"{k} = excluded.{k}" for k in data if k != pk)
        self._exec(data["tenant_id"], f"INSERT INTO {table} ({cols}) VALUES ({marks}) "
                                      f"ON CONFLICT({pk}) DO UPDATE SET {updates}", data)

    def tenant_for_user(self, user_id):
        with _lock:
            for region in config.REGIONS:
                r = connect(region).execute("SELECT tenant_id FROM tenant_members WHERE user_id = ?", (user_id,)).fetchone()
                if r:
                    return r["tenant_id"]
        return None


class SupabaseStore(BaseStore):
    """Writes with the service role (bypasses RLS), so every call filters by tenant_id explicitly."""
    name = "supabase"

    def __init__(self, client) -> None:
        self.c = client

    def t(self, table: str):
        return self.c.table(table)

    def init(self) -> None:
        # Schema is created once by contracts/supabase/001_init.sql. Fail fast if it is missing.
        self.t("tenants").select("tenant_id").limit(1).execute()

    def record_payload(self, row):
        from postgrest.exceptions import APIError
        try:
            self.t("received_payloads").insert(row).execute()
        except APIError as exc:
            if exc.code == "23505":          # unique_violation on payload_id
                raise DuplicatePayload(row["payload_id"]) from exc
            raise

    def delete_payload(self, tenant_id, payload_id):
        self.t("received_payloads").delete().eq("tenant_id", tenant_id).eq("payload_id", payload_id).execute()

    def insert_metrics(self, tenant_id, rows):
        if rows:
            self.t("metrics").insert(rows).execute()          # one batched request per payload

    def insert_events(self, tenant_id, rows):
        if rows:
            self.t("events").upsert(rows, on_conflict="event_id", ignore_duplicates=True).execute()

    def update_collector(self, tenant_id, collector_id, fields):
        if fields:
            self.t("collectors").update(fields).eq("tenant_id", tenant_id).eq("collector_id", collector_id).execute()

    def get_collector(self, tenant_id, collector_id):
        d = self.t("collectors").select("*").eq("tenant_id", tenant_id).eq("collector_id", collector_id).limit(1).execute().data
        return d[0] if d else None

    def list_collectors(self, tenant_id):
        return self.t("collectors").select("collector_id,region,version,status,state,last_seen_utc,buffer_depth,"
                                           "cpu_pct,mem_pct,config_hash").eq("tenant_id", tenant_id).order("collector_id").execute().data

    def online_collectors(self):
        return self.t("collectors").select("collector_id,tenant_id,last_seen_utc,state").eq("status", "online").execute().data

    def query_metrics(self, tenant_id, source_id=None, metric=None, from_time=None, to_time=None):
        q = self.t("metrics").select("event_time_utc,value,metric,source_id").eq("tenant_id", tenant_id)
        if source_id:
            q = q.eq("source_id", source_id)
        if metric:
            q = q.eq("metric", metric)
        if from_time:
            q = q.gte("event_time_utc", from_time)
        if to_time:
            q = q.lte("event_time_utc", to_time)
        return q.order("event_time_utc").limit(5000).execute().data

    def received_seqs(self, tenant_id, collector_id):
        d = (self.t("received_payloads").select("seq").eq("tenant_id", tenant_id).eq("collector_id", collector_id)
             .order("seq").limit(10000).execute().data)
        return [r["seq"] for r in d]

    def received_count(self, tenant_id):
        return self.t("received_payloads").select("payload_id", count="exact").eq("tenant_id", tenant_id).limit(1).execute().count or 0

    def recent_metric_times(self, tenant_id, limit=500):
        return (self.t("metrics").select("received_at_utc,event_time_utc").eq("tenant_id", tenant_id)
                .order("id", desc=True).limit(limit).execute().data)

    def last_alert_times(self, tenant_id):
        d = (self.t("alerts").select("created_at_utc,event_time_utc").eq("tenant_id", tenant_id)
             .order("created_at_utc", desc=True).limit(1).execute().data)
        return d[0] if d else None

    def insert_health(self, tenant_id, row):
        self.t("health_history").insert({"tenant_id": tenant_id, **row}).execute()

    def insert_audit(self, tenant_id, row):
        self.t("audit_log").insert({"tenant_id": tenant_id, **row}).execute()

    def upsert_row(self, table, row):
        pk, _ = AIOPS_TABLES[table]
        self.t(table).upsert(project_row(table, row), on_conflict=pk).execute()

    def tenant_for_user(self, user_id):
        d = self.t("tenant_members").select("tenant_id").eq("user_id", user_id).limit(1).execute().data
        return d[0]["tenant_id"] if d else None


def get_store() -> BaseStore:
    """The active backend: Supabase when configured, otherwise SQLite."""
    global _store
    if _store is None:
        client = get_supabase_client()
        _store = SupabaseStore(client) if client is not None else SqliteStore()
    return _store


def set_store(store: Optional[BaseStore]) -> None:
    """Tests only: inject a backend."""
    global _store
    _store = store
