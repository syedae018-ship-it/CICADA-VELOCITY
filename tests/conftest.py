"""Shared test setup: every test runs against throwaway temp databases."""
import pytest

from saas.db import close_connections, init_schema
from saas.ingest import routes as ingest_routes
from transport.db import close_conn, init_collector_db


@pytest.fixture(autouse=True)
def clean_databases(tmp_path, monkeypatch):
    """Point both tiers at throwaway temp folders. NEVER delete the real saas/data or
    collector/data: tests may be run while the demo is live, and the outbox is real data."""
    import transport.db as tdb
    from saas import config as saas_config
    from saas import db as saas_db

    close_connections()
    close_conn()
    monkeypatch.setattr(saas_config, "DATA_DIR", str(tmp_path / "saas_data"))
    monkeypatch.setattr(saas_config, "DEV_INSECURE", True)
    monkeypatch.setattr(saas_config, "SUPABASE_URL", "")            # tests use the SQLite backend
    monkeypatch.setattr(tdb, "_DB_PATH", tmp_path / "collector.db")
    saas_db.set_store(None)
    ingest_routes._duplicates_count.clear()

    init_schema()
    init_collector_db()
    yield
    close_connections()
    close_conn()
