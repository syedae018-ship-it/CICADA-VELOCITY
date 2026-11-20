"""Wipe demo telemetry so the dashboard starts clean before judging.

    .venv/bin/python scripts/reset_demo_data.py            # dry run: shows what would be deleted
    .venv/bin/python scripts/reset_demo_data.py --yes      # actually delete

Deletes, for the demo tenants only (t_acme, t_globex):
  * SaaS data: received_payloads, metrics, events, alerts, incidents, recommendations, health_history, audit_log
    (Supabase when SUPABASE_URL is set, otherwise the local SQLite files in saas/data/)
  * collector-local data: collector/data*/  (raw records, outbox, egress log)
Keeps tenants, collectors (reset to offline), tenant_members and auth users. Stop the stack first.
"""
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)


def load_env() -> None:
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


TENANTS = ["t_acme", "t_globex"]
# children before parents (foreign keys: alerts → incidents, recommendations → incidents)
TABLES = ["alerts", "recommendations", "incidents", "metrics", "events", "received_payloads", "health_history", "audit_log"]


def main() -> None:
    load_env()
    apply = "--yes" in sys.argv
    from saas import config
    config.SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    config.SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    from saas.db import get_store, get_supabase_client, connect

    store = get_store()
    print(f"SaaS storage: {store.name}")
    for table in TABLES:
        for tenant in TENANTS:
            if store.name == "supabase":
                c = get_supabase_client()
                n = c.table(table).select("tenant_id", count="exact").eq("tenant_id", tenant).limit(1).execute().count or 0
                if apply and n:
                    c.table(table).delete().eq("tenant_id", tenant).execute()
            else:
                conn = connect(config.TENANTS[tenant]["home_region"])
                n = conn.execute(f"SELECT count(*) FROM {table} WHERE tenant_id = ?", (tenant,)).fetchone()[0]
                if apply and n:
                    with conn:
                        conn.execute(f"DELETE FROM {table} WHERE tenant_id = ?", (tenant,))
            print(f"  {table:18} {tenant:9} {n:6} rows {'deleted' if apply and n else ''}")
    for tenant in TENANTS:
        if apply:
            for cid, c in config.COLLECTORS.items():
                if c["tenant_id"] == tenant:
                    store.update_collector(tenant, cid, {"status": "offline", "state": None, "buffer_depth": 0})
    for d in sorted(ROOT.glob("collector/data*")):
        print(f"  collector-local    {d.relative_to(ROOT)}  {'deleted' if apply else '(would delete)'}")
        if apply:
            shutil.rmtree(d)
    if not apply:
        print("\nDry run only. Re-run with --yes to delete.")


if __name__ == "__main__":
    main()
