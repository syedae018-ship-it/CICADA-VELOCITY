"use client";

import React, { useState } from "react";
import {
  Server,
  Terminal,
  ShieldCheck,
  Lock,
  Database,
  Sparkles,
  BarChart3,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface PipelineStage {
  id: number;
  title: string;
  tier: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  headline: string;
  detail: string;
  guarantee: string;
}

const STAGES: PipelineStage[] = [
  {
    id: 1,
    title: "Customer Infra",
    tier: "Tier 1",
    badge: "HOST NODES",
    icon: Server,
    headline: "Zero Agent Infiltration",
    detail: "Non-intrusive sampling of CPU, RAM, disk I/O, network sockets and Windows Event logs.",
    guarantee: "Read-only system APIs",
  },
  {
    id: 2,
    title: "Local Collector",
    tier: "Tier 1",
    badge: "BACKGROUND SERVICE",
    icon: Terminal,
    headline: "Native Windows Service",
    detail: "Runs under LocalSystem/user daemon with single-instance mutex and crash recovery.",
    guarantee: "Zero inbound listening ports",
  },
  {
    id: 3,
    title: "Privacy & Policy",
    tier: "Tier 1",
    badge: "LOCAL REDACTION",
    icon: ShieldCheck,
    headline: "Pre-Egress Sanitization",
    detail: "Regex + Shannon entropy tokenization strips database passwords, API keys, and internal IPs.",
    guarantee: "Deterministic 18-field schema",
  },
  {
    id: 4,
    title: "Authenticated Transport",
    tier: "Boundary",
    badge: "TLS 1.3 + HMAC",
    icon: Lock,
    headline: "Replay-Protected Egress",
    detail: "Payloads signed with HMAC-SHA256 over monotonic timestamp nonce and body hash.",
    guarantee: "Tamper-evident in transit",
  },
  {
    id: 5,
    title: "SaaS Ingestion",
    tier: "Tier 2",
    badge: "GATEWAY VERIFY",
    icon: Database,
    headline: "Sub-Second Ingestion",
    detail: "Validates HMAC signature and tenant token against Postgres Row Level Security registry.",
    guarantee: "~1.2s p95 ingest SLA",
  },
  {
    id: 6,
    title: "AIOps Engine",
    tier: "Tier 2",
    badge: "CORRELATION",
    icon: Sparkles,
    headline: "Signal Clustering",
    detail: "Learns 15-minute moving baselines; co-occurring anomalies inside 120s become 1 incident.",
    guarantee: "Explainable Z-score reasoning",
  },
  {
    id: 7,
    title: "Live Dashboard",
    tier: "Tier 2",
    badge: "OPERATOR UI",
    icon: BarChart3,
    headline: "Egress Proof & Triage",
    detail: "Visualizes exact metadata sent alongside AI-synthesized root-cause diagnoses and actions.",
    guarantee: "Zero customer secret exposure",
  },
];

export function ArchitecturePipeline() {
  const [selectedStage, setSelectedStage] = useState<number>(3); // Default to Privacy & Policy

  const current = STAGES.find((s) => s.id === selectedStage) || STAGES[2];

  return (
    <section id="architecture" className="py-20 sm:py-24 max-w-7xl mx-auto px-5 sm:px-8">
      {/* Section Header */}
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] font-bold text-brand-700">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-700" />
          END-TO-END PIPELINE
        </div>
        <h2 className="mt-3 text-[32px] sm:text-[42px] leading-[1.05] font-bold tracking-tight text-ink">
          One local boundary. One intelligent cloud.
        </h2>
        <p className="mt-4 text-[16px] text-ink-soft leading-relaxed">
          Every hop in the pipeline is strictly verifiable. The operator dashboard proves byte-for-byte what
          left your host environment, matching exact rows in Supabase.
        </p>
      </div>

      {/* Horizontal Pipeline on Desktop / Stacked on Mobile */}
      <div className="mt-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {STAGES.map((s) => {
            const Icon = s.icon;
            const isSelected = s.id === selectedStage;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStage(s.id)}
                className={`text-left p-4 rounded-xl border transition-all relative ${
                  isSelected
                    ? "bg-surface border-brand-700 shadow-cardMd ring-1 ring-brand-700/20"
                    : "bg-surface/60 border-hairline hover:bg-surface hover:border-hairline-strong"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-brand-700 text-white"
                        : "bg-brand-chip text-brand-800"
                    }`}
                  >
                    <Icon className="w-4 h-4 icon-sharp" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-ink-muted">
                    0{s.id}
                  </span>
                </div>

                <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
                  {s.tier}
                </div>
                <div className="mt-1 font-bold text-[13px] text-ink leading-tight">
                  {s.title}
                </div>

                {/* Connecting arrow indicator for active state */}
                {isSelected && (
                  <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-brand-700" />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Stage Detail Showcase */}
        <div className="mt-6 card p-6 sm:p-8 bg-surface border border-hairline-strong">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-hairline">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded text-[11px] font-mono font-bold bg-brand-700 text-white">
                STAGE 0{current.id}
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
                {current.badge}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-mono text-brand-800">
              <CheckCircle2 className="w-4 h-4 text-brand-700" />
              <span>GUARANTEE: {current.guarantee}</span>
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 space-y-3">
              <h3 className="text-[24px] font-bold text-ink tracking-tight">
                {current.headline}
              </h3>
              <p className="text-[15px] text-ink-soft leading-relaxed">
                {current.detail}
              </p>
            </div>
            <div className="md:col-span-5 bg-canvas-deep/60 p-4 rounded-xl border border-hairline text-[12px] font-mono space-y-2">
              <div className="text-ink-muted uppercase text-[10px] tracking-wider font-semibold">
                ACTIVE PROTOCOL SPECIFICATION
              </div>
              <div className="flex justify-between py-1 border-b border-hairline">
                <span className="text-ink-soft">Target Layer:</span>
                <span className="font-bold text-ink">{current.tier}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-hairline">
                <span className="text-ink-soft">Verification:</span>
                <span className="font-bold text-brand-800">100% Deterministic</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-ink-soft">Contract Anchor:</span>
                <span className="font-bold text-ink">contracts/payload_schema.json</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
