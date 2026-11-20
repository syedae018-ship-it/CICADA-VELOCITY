-- Velocity Cicada: Supabase (Postgres) schema for Tier 2 SaaS. METADATA ONLY.
-- Run once in Supabase Dashboard → SQL Editor (owner: Person B).
-- Raw logs / collector data NEVER go here. The collector keeps its own local SQLite.
--
-- Access model
--   * FastAPI (ingest + AIOps) uses the SERVICE ROLE key → bypasses RLS. Server-side only, never in the browser.
--   * Dashboard uses the ANON key + Supabase Auth login → RLS limits every row to the user's tenant.
--   * Collectors have NO Supabase keys. They talk only to FastAPI (HMAC-signed).

-- ───────────── Tenancy ─────────────
create table if not exists tenants (
  tenant_id    text primary key,
  name         text not null,
  home_region  text not null,                 -- ap-south-1 | eu-west-1 | us-east-1
  created_utc  timestamptz not null default now()
);

create table if not exists tenant_members (     -- which logged-in user belongs to which tenant
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  text not null references tenants(tenant_id) on delete cascade,
  primary key (user_id, tenant_id)
);

create or replace function my_tenants() returns setof text
  language sql stable security definer set search_path = public as $$
  select tenant_id from tenant_members where user_id = auth.uid()
$$;

-- ───────────── Fleet ─────────────
create table if not exists collectors (
  collector_id   text primary key,
  tenant_id      text not null references tenants(tenant_id),
  region         text not null,
  version        text,
  status         text not null default 'offline',   -- online | offline
  state          text,                               -- excellent | good | fair | poor
  last_seen_utc  timestamptz,
  buffer_depth   int default 0,
  cpu_pct        real,
  mem_pct        real,
  config_hash    text
);

-- ───────────── Ingest (idempotency) ─────────────
create table if not exists received_payloads (
  payload_id       uuid primary key,                 -- duplicate insert → unique violation → "duplicate"
  tenant_id        text not null references tenants(tenant_id),
  collector_id     text not null,
  seq              bigint not null,
  sent_at_utc      timestamptz not null,
  received_at_utc  timestamptz not null default now(),
  body_sha256      text not null
);
create index if not exists rp_tenant_collector_seq on received_payloads (tenant_id, collector_id, seq);

create table if not exists metrics (
  id               bigint generated always as identity primary key,
  tenant_id        text not null references tenants(tenant_id),
  collector_id     text not null,
  source_id        text not null,
  service          text,
  source_type      text,
  metric           text not null,
  value            double precision not null,
  event_time_utc   timestamptz not null,               -- ORDER BY this, never arrival time
  received_at_utc  timestamptz not null default now(),
  payload_id       uuid not null
);
create index if not exists metrics_lookup on metrics (tenant_id, source_id, metric, event_time_utc);

create table if not exists events (
  event_id         uuid primary key,
  tenant_id        text not null references tenants(tenant_id),
  collector_id     text not null,
  source_id        text not null,
  category         text not null,
  severity         text not null,
  type             text not null,
  count            int not null,
  summary          text not null,
  event_time_utc   timestamptz not null,
  received_at_utc  timestamptz not null default now(),
  payload_id       uuid not null
);

-- ───────────── AIOps outputs (Person C) ─────────────
create table if not exists incidents (
  incident_id            text primary key,
  tenant_id              text not null references tenants(tenant_id),
  title                  text not null,
  status                 text not null default 'open',
  severity               text not null,
  started_utc            timestamptz not null,
  updated_utc            timestamptz not null,
  alert_count            int not null default 1,
  suppressed_duplicates  int not null default 0,
  affected_sources       jsonb not null default '[]',
  likely_cause           text,
  correlation_rule       text
);

create table if not exists alerts (
  alert_id        text primary key,
  tenant_id       text not null references tenants(tenant_id),
  source_id       text,
  service         text,
  kind            text not null,     -- anomaly | threshold | security | offline | stale
  metric          text,
  severity        text not null,
  state           text,
  event_time_utc  timestamptz not null,
  created_at_utc  timestamptz not null default now(),
  incident_id     text references incidents(incident_id),
  explanation     jsonb not null,    -- see contracts/aiops_output.md
  status          text not null default 'open'
);
create index if not exists alerts_tenant_time on alerts (tenant_id, created_at_utc desc);

create table if not exists recommendations (
  rec_id                text primary key,
  tenant_id             text not null references tenants(tenant_id),
  incident_id           text references incidents(incident_id),
  action                text not null,
  reasoning_path        jsonb not null,
  contributing_signals  jsonb not null,
  confidence            real not null,
  risk                  text,
  policy_check          jsonb,
  rollback_plan         text,
  requires_approval     boolean not null default true,
  status                text not null default 'proposed',
  approved_by           text,
  updated_utc           timestamptz not null default now()
);

create table if not exists health_history (
  id           bigint generated always as identity primary key,
  tenant_id    text not null references tenants(tenant_id),
  entity_type  text not null,       -- collector | source
  entity_id    text not null,
  prev_state   text,
  state        text not null,
  reason       text not null,
  at_utc       timestamptz not null default now()
);

create table if not exists audit_log (
  id         bigint generated always as identity primary key,
  tenant_id  text not null references tenants(tenant_id),
  actor      text not null,
  action     text not null,
  target     text,
  details    jsonb,
  at_utc     timestamptz not null default now()
);

-- ───────────── Row Level Security: tenant isolation ─────────────
-- Dashboard users can only SELECT their own tenant's rows. All writes go through FastAPI (service role).
do $$
declare t text;
begin
  foreach t in array array['collectors','received_payloads','metrics','events','incidents',
                           'alerts','recommendations','health_history','audit_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tenant_read on %I', t);
    execute format('create policy tenant_read on %I for select to authenticated
                    using (tenant_id in (select my_tenants()))', t);
  end loop;
end $$;

alter table tenants enable row level security;
drop policy if exists tenant_read on tenants;
create policy tenant_read on tenants for select to authenticated using (tenant_id in (select my_tenants()));

alter table tenant_members enable row level security;
drop policy if exists own_membership on tenant_members;
create policy own_membership on tenant_members for select to authenticated using (user_id = auth.uid());

-- ───────────── Realtime (live dashboard, replaces custom SSE) ─────────────
-- RLS also applies to Realtime, so each user only receives their tenant's changes.
alter publication supabase_realtime add table alerts, incidents, recommendations, health_history, collectors, metrics;

-- ───────────── Seed demo tenants & collectors ─────────────
insert into tenants (tenant_id, name, home_region) values
  ('t_acme',   'Acme Corp', 'ap-south-1'),
  ('t_globex', 'Globex',    'eu-west-1')
on conflict do nothing;

insert into collectors (collector_id, tenant_id, region) values
  ('c_blr01', 't_acme',   'ap-south-1'),
  ('c_fra01', 't_globex', 'eu-west-1')
on conflict do nothing;

-- After creating demo users in Authentication → Users, link them:
-- insert into tenant_members (user_id, tenant_id) values ('<acme-user-uuid>', 't_acme'), ('<globex-user-uuid>', 't_globex');
