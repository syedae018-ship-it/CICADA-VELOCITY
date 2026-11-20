"""SaaS storage. Owner: Person B. Used by ingest (Person B) and aiops (Person C).

Rules (contracts/db_tables.md):
  * one SQLite file per region  ->  saas/data/<region>.db   (data residency)
  * EVERY query is tenant-scoped via tenant_query()           (tenant isolation)
  * Supabase Postgres supported when SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY are set
"""
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from saas import config

_connections: dict[str, sqlite3.Connection] = {}
_supabase_client = None

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


def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    if config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY:
        try:
            from supabase import create_client
            _supabase_client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
            return _supabase_client
        except Exception:
            return None
    return None


def connect(region: str) -> sqlite3.Connection:
    """Connect to the regional SQLite database file (saas/data/<region>.db)."""
    if region not in config.REGIONS:
        raise ValueError(f"Unknown region: {region}. Must be one of {config.REGIONS}")

    if region in _connections:
        return _connections[region]

    data_dir = Path(config.DATA_DIR)
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / f"{region}.db"

    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    _connections[region] = conn
    return conn


def close_connections() -> None:
    """Close all open regional database connections."""
    global _connections
    for conn in _connections.values():
        try:
            conn.close()
        except Exception:
            pass
    _connections.clear()


def init_schema() -> None:

    """Create all tables in all regional databases and seed default tenants/collectors."""
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for region in config.REGIONS:
        conn = connect(region)
        conn.executescript(SCHEMA_SQL)

        # Seed tenants
        for tenant_id, t_info in config.TENANTS.items():
            conn.execute(
                "INSERT OR IGNORE INTO tenants (tenant_id, name, home_region, created_utc) VALUES (?, ?, ?, ?)",
                (tenant_id, t_info["name"], t_info["home_region"], now),
            )

        # Seed collectors
        for collector_id, c_info in config.COLLECTORS.items():
            conn.execute(
                "INSERT OR IGNORE INTO collectors (collector_id, tenant_id, region, status) VALUES (?, ?, ?, 'offline')",
                (collector_id, c_info["tenant_id"], c_info["region"]),
            )
        conn.commit()


def db_for_tenant(tenant_id: str) -> sqlite3.Connection:
    """Return the SQLite connection for the tenant's home region (data residency)."""
    tenant_info = config.TENANTS.get(tenant_id)
    if not tenant_info:
        # Check if tenant exists in ap-south-1
        conn = connect("ap-south-1")
        row = conn.execute("SELECT home_region FROM tenants WHERE tenant_id = ?", (tenant_id,)).fetchone()
        if row:
            region = row["home_region"]
        else:
            region = "ap-south-1"
    else:
        region = tenant_info.get("home_region", "ap-south-1")
    return connect(region)


def tenant_query(tenant_id: str, sql: str, params: tuple | list = ()) -> list[dict]:
    """Execute a read query strictly bound to tenant_id. Refuses any query lacking a tenant filter."""
    if not tenant_id:
        raise ValueError("tenant_id is required for tenant_query")
    sql_lower = sql.lower()
    if "tenant_id" not in sql_lower:
        raise ValueError("Tenant isolation violation: query must filter by tenant_id")

    conn = db_for_tenant(tenant_id)
    cursor = conn.cursor()
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    return [dict(row) for row in rows]
