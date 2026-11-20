"""SaaS storage. Owner: M2. Used by ingest (M2) and aiops (M3).

Rules (contracts/db_tables.md):
  * one SQLite file per region  ->  saas/data/<region>.db   (data residency)
  * EVERY query is tenant-scoped via tenant_query()           (tenant isolation)
"""

# TODO(M2): connect(region), init_schema(), tenant_query(tenant_id, sql, params)
