"use client";

import React from "react";
import { ShieldCheck, Clock, Zap, CheckCircle2 } from "lucide-react";

interface ProofMetric {
  value: string;
  unit?: string;
  label: string;
  sub: string;
  status: string;
  icon: React.ComponentType<{ className?: string }>;
}

const METRICS: ProofMetric[] = [
  {
    value: "0",
    label: "Secrets Leaked to SaaS",
    sub: "Regex + Shannon entropy verified",
    status: "Verified in 83 tests",
    icon: ShieldCheck,
  },
  {
    value: "~1.2",
    unit: "s",
    label: "Ingest p95 Latency",
    sub: "Local outbox to Supabase ingest",
    status: "Production benchmark",
    icon: Clock,
  },
  {
    value: "9",
    label: "Live Demo Scenarios",
    sub: "Injectable fault & leak simulations",
    status: "Realtime test suite",
    icon: Zap,
  },
  {
    value: "100",
    unit: "%",
    label: "Schema-Validated Payloads",
    sub: "Deterministic 18-field JSON contract",
    status: "Cryptographically signed",
    icon: CheckCircle2,
  },
];

export function ProofStrip() {
  return (
    <section className="relative border-y border-hairline bg-surface/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 divide-y lg:divide-y-0 lg:divide-x divide-hairline">
          {METRICS.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className={`flex flex-col justify-between ${
                  idx > 0 ? "pt-6 lg:pt-0 lg:pl-8" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-brand-700 bg-brand-chip/80 px-2 py-0.5 rounded">
                      <Icon className="w-3 h-3 text-brand-700" />
                      {m.status}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-mono text-[40px] sm:text-[46px] font-bold text-ink tracking-tight leading-none tabular-nums">
                      {m.value}
                    </span>
                    {m.unit && (
                      <span className="font-mono text-[22px] font-semibold text-brand-700">
                        {m.unit}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-[14px] font-semibold text-ink tracking-tight">
                    {m.label}
                  </div>
                </div>
                <div className="mt-1 text-[12px] text-ink-soft leading-snug">
                  {m.sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
