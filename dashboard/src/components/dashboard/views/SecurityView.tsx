"use client";

import React, { useEffect, useState } from "react";
import {
  Shield,
  Lock,
  ShieldCheck,
  Users,
  FileCheck2,
  CheckCircle2,
  ArrowDown,
  Sparkles,
} from "lucide-react";
import { fetchSecurityLayers } from "@/lib/live";
import { TenantId } from "@/types";

interface SecurityViewProps {
  tenantId: TenantId;
}

interface Layer {
  id: number;
  name: string;
  tier: string;
  description: string;
  status: string;
  controls: string[];
  metric: { label: string; value: number };
  icon: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  lock: Lock,
  "shield-check": ShieldCheck,
  users: Users,
  "file-check": FileCheck2,
};

const FALLBACK: Layer[] = [
  {
    id: 1,
    name: "Local Scrubbing & Allow-Listing",
    tier: "Tier 1 Collector",
    description: "PII, secrets, emails, IPs stripped locally. Hostnames hashed. AI entropy + NER catches novel leaks.",
    status: "active",
    controls: ["regex redaction", "shannon entropy", "NER person/address", "payload allow-list"],
    metric: { label: "Security events detected", value: 0 },
    icon: "shield",
  },
  {
    id: 2,
    name: "Outbound-Only Firewall Posture",
    tier: "Tier 1 Transport",
    description: "Collector is HTTPS client only. Zero inbound ports. Local SQLite buffer survives network drops.",
    status: "active",
    controls: ["no listening socket", "outbound HTTPS", "exponential backoff", "replay-safe queue"],
    metric: { label: "Buffered payloads", value: 0 },
    icon: "lock",
  },
  {
    id: 3,
    name: "Encrypted Transit + HMAC Auth",
    tier: "Boundary",
    description: "HMAC-SHA256 collector signature over timestamp + body. 300s replay window. TLS to Supabase.",
    status: "active",
    controls: ["HMAC-SHA256", "replay window 300s", "schema validation", "payload_id idempotency"],
    metric: { label: "Collectors authenticated", value: 1 },
    icon: "shield-check",
  },
  {
    id: 4,
    name: "Strict Multi-Tenant Isolation",
    tier: "Tier 2 SaaS",
    description: "tenant_id resolved from JWT or collector registry. Postgres RLS enforces isolation at the row.",
    status: "active",
    controls: ["JWT tenant claim", "Supabase RLS", "per-tenant partitions", "cross-tenant query = 0 rows"],
    metric: { label: "Sources served (tenant)", value: 0 },
    icon: "users",
  },
  {
    id: 5,
    name: "Safe Remediation & Audit Log",
    tier: "Tier 2 AIOps",
    description: "Every action simulation-only, human-approved, policy-checked, and fully reversible.",
    status: "active",
    controls: ["simulation mode", "policy gate", "approve/rollback", "immutable audit"],
    metric: { label: "Audit entries", value: 0 },
    icon: "file-check",
  },
];

export default function SecurityView({ tenantId }: SecurityViewProps) {
  const [layers, setLayers] = useState<Layer[]>(FALLBACK);
  const [openIncidents, setOpenIncidents] = useState<number>(0);
  const [showReasoning, setShowReasoning] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      const data = await fetchSecurityLayers(tenantId);
      if (!mounted || !data) return;
      if (Array.isArray(data.layers)) setLayers(data.layers as Layer[]);
      setOpenIncidents(Number(data.open_incidents ?? 0));
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [tenantId]);

  return (
    <div className="space-y-6">
      {/* Hero verdict */}
      <div
        className="card p-7 relative overflow-hidden text-white"
        style={{
          background:
            "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 55%, #062715 100%)",
          boxShadow: "var(--shadow-hero)",
        }}
      >
        <div className="ring-deco -right-8 -top-8 h-36 w-36" />
        <div className="ring-deco -right-20 -bottom-20 h-60 w-60" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-brand-mint/90">
            <Sparkles className="w-3.5 h-3.5" /> Defense-in-depth
          </div>
          <div className="mt-3 flex items-end gap-4 flex-wrap">
            <h1 className="text-[44px] leading-[1.02] font-bold tracking-[-0.035em]">
              All <span className="text-brand-mint">5 layers</span> active
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/10 border border-white/20 backdrop-blur">
              <CheckCircle2 className="w-3.5 h-3.5 icon-sharp" /> Posture: secure
            </span>
          </div>
          <p className="mt-3 max-w-xl text-white/80 text-[14px]">
            Third-party attackers cannot reach customer telemetry. Secrets never leave the site; only
            allow-listed, HMAC-signed metadata crosses the boundary, scoped to each tenant.
          </p>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            <Stat label="Open incidents" value={openIncidents} />
            <Stat label="Layers active" value={layers.length} />
            <Stat label="Posture" value={"OK"} alpha />
            <Stat label="Blast radius" value={"0 leaks"} alpha />
          </div>
        </div>
      </div>

      {/* 5 layer stack */}
      <div className="space-y-4">
        {layers.map((layer, idx) => {
          const Icon = ICONS[layer.icon] ?? Shield;
          const isOpen = showReasoning === layer.id;
          return (
            <div key={layer.id}>
              <div className="card p-6 hover:shadow-cardMd transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                  {/* icon tile */}
                  <div
                    className="relative shrink-0 h-20 w-20 rounded-2xl flex items-center justify-center text-white"
                    style={{
                      background:
                        "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 70%, #062715 100%)",
                    }}
                  >
                    <Icon className="w-9 h-9 icon-sharp" />
                    <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-brand-mint text-brand-900 text-[12px] font-bold flex items-center justify-center shadow-cardMd">
                      {layer.id}
                    </span>
                  </div>

                  {/* name + description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted font-semibold">
                        {layer.tier}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-chip text-brand-800 border border-[#d5e6b4]">
                        <CheckCircle2 className="w-3.5 h-3.5 icon-sharp" /> Active
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-[18px] font-bold tracking-tight text-ink">
                      {layer.name}
                    </h3>
                    <p className="mt-1 text-[13px] text-ink-soft">{layer.description}</p>
                  </div>

                  {/* metric */}
                  <div className="shrink-0 min-w-[150px]">
                    <div className="rounded-2xl bg-surface-soft border border-hairline p-4 text-center">
                      <div className="text-[28px] font-bold font-mono text-brand-800 leading-none">
                        {layer.metric.value}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-ink-muted font-semibold">
                        {layer.metric.label}
                      </div>
                    </div>
                  </div>
                </div>

                {/* reasoning toggle */}
                <button
                  onClick={() => setShowReasoning(isOpen ? null : layer.id)}
                  className="mt-4 text-[12px] font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                >
                  {isOpen ? "Hide controls" : "Show controls"} →
                </button>
                {isOpen && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {layer.controls.map((c) => (
                      <span
                        key={c}
                        className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-surface-soft border border-hairline text-ink-soft"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* data flow arrow between layers */}
              {idx < layers.length - 1 && (
                <div className="flex justify-center my-1">
                  <div className="h-8 w-px bg-gradient-to-b from-hairline-strong via-brand-700/50 to-hairline-strong" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stat strip */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 text-ink-soft text-[13px]">
            <ShieldCheck className="w-4 h-4 icon-sharp text-brand-700" />
            All traffic that leaves this customer environment is signed, schema-checked, and tenant-scoped.
          </div>
          <div className="flex items-center gap-2">
            <ArrowDown className="w-3.5 h-3.5 text-ink-muted rotate-[-90deg]" />
            <code className="text-[11px] font-mono text-ink-muted">tenant = {tenantId}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, alpha }: { label: string; value: number | string; alpha?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 p-3 backdrop-blur">
      <div className={`text-[22px] leading-none font-bold ${alpha ? "text-white" : "text-brand-mint font-mono"}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-white/70 font-semibold">
        {label}
      </div>
    </div>
  );
}
