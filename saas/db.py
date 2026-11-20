"""SaaS storage on Supabase (Postgres). Owner: Person B. Used by ingest (Person B) and aiops (Person C).

Schema: contracts/supabase/001_init.sql
  * FastAPI uses the SERVICE ROLE key (bypasses RLS), so EVERY query here must still filter by tenant_id.
  * The dashboard uses the anon key + Supabase Auth; RLS enforces the tenant there.
  * Collector data / raw logs never come here.
"""

# TODO(Person B): client() -> supabase.create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
#                 tenant_table(tenant_id, table) -> query builder pre-filtered with .eq("tenant_id", tenant_id)
