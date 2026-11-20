"""SaaS storage. Owner: Person B. Used by ingest (Person B) and aiops (Person C).

Rules (contracts/db_tables.md):
  * one SQLite file per region  ->  saas/data/<region>.db   (data residency)
  * EVERY query is tenant-scoped via tenant_query()           (tenant isolation)
"""

# TODO(Person B): connect(region), init_schema(), tenant_query(tenant_id, sql, params)
