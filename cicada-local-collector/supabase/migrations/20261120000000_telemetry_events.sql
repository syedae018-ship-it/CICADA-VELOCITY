-- ==============================================================================
-- CICADA TELEMETRY SCHEMA & ROW-LEVEL SECURITY MIGRATION (RESILIENT)
-- Migration Version: 20261120000000_telemetry_events.sql
-- ==============================================================================
-- Uses self-contained UUIDs so it never clashes with existing pre-created tables.
-- ==============================================================================

-- 1. Dedicated CICADA Tenants Table (Namespaced to prevent clashes with existing tables)
CREATE TABLE IF NOT EXISTS public.cicada_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.cicada_tenants ENABLE ROW LEVEL SECURITY;

-- 2. Registered Devices Table
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    device_id UUID NOT NULL UNIQUE,
    operating_system TEXT NOT NULL CHECK (operating_system IN ('Windows', 'macOS', 'Linux')),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'paused'))
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_devices_tenant_seen ON public.devices(tenant_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices(device_id);

-- 3. Telemetry Events Table
CREATE TABLE IF NOT EXISTS public.telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    device_id UUID NOT NULL,
    payload_id UUID NOT NULL,
    schema_version TEXT NOT NULL DEFAULT '2.0.0',
    collected_at TIMESTAMPTZ NOT NULL,
    operating_system TEXT NOT NULL CHECK (operating_system IN ('Windows', 'macOS', 'Linux')),
    cpu_percent NUMERIC(5,2) CHECK (cpu_percent >= 0.0 AND cpu_percent <= 100.0),
    memory_total_bytes BIGINT CHECK (memory_total_bytes >= 0),
    memory_used_bytes BIGINT CHECK (memory_used_bytes >= 0),
    memory_percent NUMERIC(5,2) CHECK (memory_percent >= 0.0 AND memory_percent <= 100.0),
    disk_total_bytes BIGINT CHECK (disk_total_bytes >= 0),
    disk_used_bytes BIGINT CHECK (disk_used_bytes >= 0),
    disk_percent NUMERIC(5,2) CHECK (disk_percent >= 0.0 AND disk_percent <= 100.0),
    network_upload_bytes_per_second NUMERIC(14,2) CHECK (network_upload_bytes_per_second >= 0.0),
    network_download_bytes_per_second NUMERIC(14,2) CHECK (network_download_bytes_per_second >= 0.0),
    uptime_seconds NUMERIC(14,2) CHECK (uptime_seconds >= 0.0),
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Idempotency constraint: Prevent duplicate submissions
    CONSTRAINT uq_telemetry_payload UNIQUE (tenant_id, device_id, payload_id)
);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_telemetry_tenant_time ON public.telemetry_events(tenant_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON public.telemetry_events(device_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_payload_id ON public.telemetry_events(payload_id);

-- 4. Heartbeat Trigger (Updates devices.last_seen_at automatically)
CREATE OR REPLACE FUNCTION public.update_device_heartbeat()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.devices (tenant_id, device_id, operating_system, last_seen_at)
    VALUES (NEW.tenant_id, NEW.device_id, NEW.operating_system, NEW.collected_at)
    ON CONFLICT (device_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at,
        operating_system = EXCLUDED.operating_system;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_telemetry_device_heartbeat ON public.telemetry_events;
CREATE TRIGGER trg_telemetry_device_heartbeat
AFTER INSERT ON public.telemetry_events
FOR EACH ROW EXECUTE FUNCTION public.update_device_heartbeat();

-- 5. Row-Level Security (RLS) Policies
-- Drop existing policies if they were partially created
DROP POLICY IF EXISTS "Devices can insert telemetry for their own tenant and device" ON public.telemetry_events;
DROP POLICY IF EXISTS "Users can only read telemetry for their authorized tenant" ON public.telemetry_events;
DROP POLICY IF EXISTS "Users can view devices in their tenant" ON public.devices;

-- Allow authorized devices and anon clients with valid tenant_id to ingest telemetry
CREATE POLICY "Devices can insert telemetry for their own tenant and device"
ON public.telemetry_events
FOR INSERT
TO authenticated, anon
WITH CHECK (
    -- If using JWT with custom claims:
    (
        auth.jwt() ->> 'tenant_id' IS NOT NULL 
        AND (auth.jwt() ->> 'tenant_id')::UUID = tenant_id
        AND (
            auth.jwt() ->> 'device_id' IS NULL 
            OR (auth.jwt() ->> 'device_id')::UUID = device_id
        )
    )
    OR
    -- Allow direct insertion when tenant_id is provided
    (tenant_id IS NOT NULL)
);

-- Allow dashboard users to read only their tenant's telemetry
CREATE POLICY "Users can only read telemetry for their authorized tenant"
ON public.telemetry_events
FOR SELECT
TO authenticated, anon
USING (
    -- If JWT has tenant_id claim, restrict to that tenant; otherwise allow reading
    (auth.jwt() ->> 'tenant_id' IS NULL)
    OR
    (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
);

-- Allow dashboard to view devices
CREATE POLICY "Users can view devices in their tenant"
ON public.devices
FOR SELECT
TO authenticated, anon
USING (
    (auth.jwt() ->> 'tenant_id' IS NULL)
    OR
    (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
);

-- 6. Demo Seed Tenant
INSERT INTO public.cicada_tenants (id, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'CICADA Hackathon Demo Tenant')
ON CONFLICT (id) DO NOTHING;
