"use client";

import React, { useState } from "react";
import { Shield, ArrowRight, EyeOff, Check, AlertCircle } from "lucide-react";

interface ScenarioData {
  id: string;
  name: string;
  category: string;
  redactedCount: number;
  rawPayload: {
    hostname: string;
    internal_ip: string;
    auth_bearer: string;
    db_connection: string;
    cpu_percent: number;
    memory_percent: number;
    error_log: string;
  };
  cleanPayload: {
    source_id: string;
    cpu_percent: number;
    memory_percent: number;
    anomaly_flag: boolean;
    redaction_count: number;
    timestamp: string;
    signature: string;
  };
}

const SCENARIOS: ScenarioData[] = [
  {
    id: "db-spike",
    name: "Database Cascade",
    category: "Postgres Cluster",
    redactedCount: 4,
    rawPayload: {
      hostname: "prod-db-primary.internal.corp",
      internal_ip: "10.240.12.84",
      auth_bearer: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      db_connection: "postgres://admin:SuperSecretPass99!@10.240.12.84:5432/orders",
      cpu_percent: 89.4,
      memory_percent: 74.2,
      error_log: "Connection pool exhausted for user 'finance_app_v2' password failed",
    },
    cleanPayload: {
      source_id: "host_8f29d10e82c1",
      cpu_percent: 89.4,
      memory_percent: 74.2,
      anomaly_flag: true,
      redaction_count: 4,
      timestamp: "2026-11-21T03:30:14Z",
      signature: "hmac-sha256:d82f718a29...",
    },
  },
  {
    id: "auth-leak",
    name: "API Gateway Breach Attempt",
    category: "Edge Router",
    redactedCount: 6,
    rawPayload: {
      hostname: "edge-gw-01.dmz.internal",
      internal_ip: "192.168.1.105",
      auth_bearer: "Bearer sec_live_9a7bc0183204918230192830",
      db_connection: "redis://:master_auth_token_secret@10.10.0.4:6379",
      cpu_percent: 42.1,
      memory_percent: 51.0,
      error_log: "Failed auth probe from IP 198.51.100.41 targeting admin endpoint",
    },
    cleanPayload: {
      source_id: "host_017bca891e44",
      cpu_percent: 42.1,
      memory_percent: 51.0,
      anomaly_flag: false,
      redaction_count: 6,
      timestamp: "2026-11-21T03:31:02Z",
      signature: "hmac-sha256:3a19e8c47b...",
    },
  },
  {
    id: "k8s-crash",
    name: "Kubernetes Worker OOM",
    category: "Container Fabric",
    redactedCount: 3,
    rawPayload: {
      hostname: "k8s-worker-node-14a.c.gcp-internal",
      internal_ip: "172.16.44.12",
      auth_bearer: "k8s-service-account-token-sensitive-hash",
      db_connection: "none",
      cpu_percent: 98.7,
      memory_percent: 99.2,
      error_log: "OOMKiller invoked on pod payment-worker-7b98f2 uid: 4421-998a",
    },
    cleanPayload: {
      source_id: "host_c44b9182e091",
      cpu_percent: 98.7,
      memory_percent: 99.2,
      anomaly_flag: true,
      redaction_count: 3,
      timestamp: "2026-11-21T03:31:45Z",
      signature: "hmac-sha256:f10928e41a...",
    },
  },
];

export function PrivacyComparison() {
  const [activeTab, setActiveTab] = useState<string>("db-spike");

  const current = SCENARIOS.find((s) => s.id === activeTab) || SCENARIOS[0];

  return (
    <section id="boundary" className="py-20 sm:py-24 bg-canvas-deep/40 border-y border-hairline">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] font-bold text-brand-700">
              <EyeOff className="w-3.5 h-3.5" />
              THE PRIVACY BOUNDARY IN CODE
            </div>
            <h2 className="mt-3 text-[32px] sm:text-[42px] leading-[1.05] font-bold tracking-tight text-ink">
              Your data stays yours.
            </h2>
            <p className="mt-3 text-[16px] text-ink-soft leading-relaxed">
              Compare the local raw telemetry against the exact allow-listed metadata emitted to our SaaS.
              Sensitive credentials and host IPs are permanently sanitized inside your network.
            </p>
          </div>

          {/* Scenario Selector Pills */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-surface border border-hairline">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveTab(s.id)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  activeTab === s.id
                    ? "bg-brand-700 text-white shadow-card"
                    : "text-ink-soft hover:text-ink hover:bg-canvas"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Side-by-Side Payload Comparison Grid */}
        <div className="mt-12 grid lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Side: Local Raw Telemetry */}
          <div className="lg:col-span-5 rounded-2xl bg-brand-950 p-6 text-white border border-brand-800 shadow-hero flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="text-[12px] font-mono font-bold text-white tracking-wide">
                    RAW LOCAL STREAM (STAYS ON HOST)
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                  NEVER TRANSMITTED
                </span>
              </div>

              {/* Raw JSON Code Block with Redaction Callouts */}
              <div className="mt-4 font-mono text-[12px] leading-relaxed space-y-2 text-white/80">
                <div className="p-2 rounded bg-red-950/40 border border-red-500/20">
                  <span className="text-red-400">"hostname":</span>{" "}
                  <span className="text-red-200">"{current.rawPayload.hostname}"</span>
                  <div className="text-[10px] text-red-400/80 mt-0.5">↳ Stripped: Internal topology leak</div>
                </div>

                <div className="p-2 rounded bg-red-950/40 border border-red-500/20">
                  <span className="text-red-400">"internal_ip":</span>{" "}
                  <span className="text-red-200">"{current.rawPayload.internal_ip}"</span>
                  <div className="text-[10px] text-red-400/80 mt-0.5">↳ Stripped: Private RFC1918 address</div>
                </div>

                <div className="p-2 rounded bg-red-950/40 border border-red-500/20">
                  <span className="text-red-400">"auth_bearer":</span>{" "}
                  <span className="text-red-200">"{current.rawPayload.auth_bearer}"</span>
                  <div className="text-[10px] text-red-400/80 mt-0.5">↳ Stripped: High-entropy secret token</div>
                </div>

                <div className="p-2 rounded bg-red-950/40 border border-red-500/20">
                  <span className="text-red-400">"connection_uri":</span>{" "}
                  <span className="text-red-200">"{current.rawPayload.db_connection}"</span>
                  <div className="text-[10px] text-red-400/80 mt-0.5">↳ Stripped: Embedded DB password</div>
                </div>

                <div className="p-2 rounded bg-white/5 border border-white/10 text-white/70">
                  <span className="text-white/60">"cpu_percent":</span>{" "}
                  <span className="text-brand-mint">{current.rawPayload.cpu_percent}%</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50">
              <span>Entropy Scrubber: Active</span>
              <span className="text-red-400">{current.redactedCount} sensitive fields isolated</span>
            </div>
          </div>

          {/* Center Column: The Scrubber Transformation Indicator */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center p-4">
            <div className="h-14 w-14 rounded-2xl bg-brand-700 text-brand-mint flex items-center justify-center shadow-cardMd border border-brand-mint/30">
              <Shield className="w-7 h-7 icon-sharp animate-pulse" />
            </div>
            <div className="mt-3 text-center">
              <div className="text-[12px] font-bold text-ink">Scrubbing Pass</div>
              <div className="text-[11px] font-mono text-brand-700 font-semibold mt-0.5">
                0 Leaked Secrets
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-1 mt-4 text-ink-muted">
              <span className="h-1 w-6 bg-brand-700/40 rounded-full" />
              <ArrowRight className="w-4 h-4 text-brand-700" />
            </div>
          </div>

          {/* Right Side: Approved Transmitted Metadata */}
          <div className="lg:col-span-5 rounded-2xl bg-surface p-6 text-ink border border-brand-700/30 shadow-cardMd flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-hairline">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-700" />
                  <span className="text-[12px] font-mono font-bold text-ink tracking-wide">
                    APPROVED METADATA (TRANSMITTED)
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-brand-chip text-brand-800 border border-[#d5e6b4]">
                  CONTRACT v1.0
                </span>
              </div>

              {/* Clean Allow-Listed JSON Block */}
              <div className="mt-4 font-mono text-[12px] leading-relaxed space-y-2 text-ink-soft">
                <div className="p-2 rounded bg-surface-soft border border-hairline">
                  <span className="text-ink-muted">"source_id":</span>{" "}
                  <span className="text-brand-800 font-bold">"{current.cleanPayload.source_id}"</span>
                  <div className="text-[10px] text-brand-700 mt-0.5">✓ HMAC-SHA256 pseudonymous identifier</div>
                </div>

                <div className="p-2 rounded bg-surface-soft border border-hairline">
                  <span className="text-ink-muted">"cpu_percent":</span>{" "}
                  <span className="text-ink font-bold">{current.cleanPayload.cpu_percent}</span>
                </div>

                <div className="p-2 rounded bg-surface-soft border border-hairline">
                  <span className="text-ink-muted">"memory_percent":</span>{" "}
                  <span className="text-ink font-bold">{current.cleanPayload.memory_percent}</span>
                </div>

                <div className="p-2 rounded bg-surface-soft border border-hairline">
                  <span className="text-ink-muted">"redaction_count":</span>{" "}
                  <span className="text-brand-800 font-bold">{current.cleanPayload.redaction_count}</span>
                  <div className="text-[10px] text-ink-muted mt-0.5">✓ Verified redaction proof metric</div>
                </div>

                <div className="p-2 rounded bg-surface-soft border border-hairline">
                  <span className="text-ink-muted">"signature":</span>{" "}
                  <span className="text-brand-700 text-[11px] truncate block">
                    "{current.cleanPayload.signature}"
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-hairline flex items-center justify-between text-[11px] font-mono text-ink-muted">
              <span>Egress Contract: 18 Allowed Fields</span>
              <span className="text-brand-700 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> 100% Schema Validated
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
