"use client";

import React, { useState } from "react";
import {
  Shield,
  Lock,
  ShieldCheck,
  Users,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
  Fingerprint,
} from "lucide-react";

interface SecurityLayer {
  level: number;
  name: string;
  boundary: "Customer Perimeter" | "Cryptographic Gateway" | "SaaS Cloud";
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  description: string;
  verifications: string[];
  techAnchor: string;
}

const LAYERS: SecurityLayer[] = [
  {
    level: 1,
    name: "Local Scrubbing & Tokenization",
    boundary: "Customer Perimeter",
    icon: Shield,
    tagline: "Shannon Entropy & Regex Pipeline",
    description:
      "All host telemetry passes through in-memory pattern analyzers and Shannon entropy detectors before entering the egress pipeline. High-entropy strings (passwords, JWTs, AWS secret keys) and RFC1918 IPs are stripped or pseudonymized locally.",
    verifications: [
      "Zero secret leakage verified in 83 automated test suites",
      "Shannon entropy threshold calculated per string token",
      "Pseudonymous source IDs hashed via local machine seed",
    ],
    techAnchor: "collector/scrubber.py",
  },
  {
    level: 2,
    name: "Outbound-Only Architecture",
    boundary: "Customer Perimeter",
    icon: Lock,
    tagline: "Zero Listening Sockets",
    description:
      "The Windows Collector does not bind to external network interfaces and accepts no inbound connections from the internet or local LAN. If the SaaS cloud goes offline, an embedded SQLite buffer spools telemetry locally with atomic transactions.",
    verifications: [
      "0 open inbound network ports on host",
      "Durable SQLite outbox buffer survives host reboot",
      "Windows DPAPI encrypts local enrollment credentials",
    ],
    techAnchor: "collector/windows_service.py",
  },
  {
    level: 3,
    name: "HMAC-SHA256 & Replay Protection",
    boundary: "Cryptographic Gateway",
    icon: ShieldCheck,
    tagline: "Cryptographic Egress Signatures",
    description:
      "Every outbound transmission packet is sealed with an HMAC-SHA256 signature computed over the exact payload hash and a monotonic UTC timestamp nonce. Payloads older than the clock-skew allowance or with previously observed nonces are dropped.",
    verifications: [
      "Constant-time HMAC verification prevents timing attacks",
      "Strict payload_schema.json allow-list enforcement",
      "TLS 1.3 encryption with certificate validation",
    ],
    techAnchor: "transport/sender.py",
  },
  {
    level: 4,
    name: "Cryptographic Tenant Isolation",
    boundary: "SaaS Cloud",
    icon: Users,
    tagline: "Postgres Row Level Security (RLS)",
    description:
      "SaaS telemetry storage is partitioned at the database kernel level via Supabase Postgres Row Level Security. Tenant JWTs enforce that no query, API call, or real-time subscription can inspect metadata outside its authorized organization boundary.",
    verifications: [
      "Hardened Postgres RLS policies active on all telemetry tables",
      "Automated rejection of cross-tenant query payloads",
      "No shared tenant memory or cross-tenant cache keys",
    ],
    techAnchor: "saas/db.py",
  },
  {
    level: 5,
    name: "Immutable Audit & Reversible Rollback",
    boundary: "SaaS Cloud",
    icon: FileCheck2,
    tagline: "Tamper-Evident Ledger",
    description:
      "Every automated remediation proposal, anomaly trigger, and operator intervention generates an immutable audit log entry. High-impact remediation actions require explicit human operator confirmation and provide 1-click rollback commands.",
    verifications: [
      "Every remediation action generates a signed audit trace",
      "Human-in-the-loop approval gate for state-changing operations",
      "Reversible playbooks with rollback state checkpoints",
    ],
    techAnchor: "saas/ingest/routes.py",
  },
];

export function SecurityLayers() {
  const [activeLayer, setActiveLayer] = useState<number>(1);

  const current = LAYERS.find((l) => l.level === activeLayer) || LAYERS[0];

  return (
    <section id="security" className="py-20 sm:py-24 max-w-7xl mx-auto px-5 sm:px-8">
      {/* Section Header */}
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] font-bold text-brand-700">
          <Fingerprint className="w-3.5 h-3.5" />
          DEFENSE IN DEPTH
        </div>
        <h2 className="mt-3 text-[32px] sm:text-[42px] leading-[1.05] font-bold tracking-tight text-ink">
          Five layers between an attacker and your data.
        </h2>
        <p className="mt-4 text-[16px] text-ink-soft leading-relaxed">
          Security is built by construction, not added as an afterthought. Each layer is active in production code,
          provable in test runs, and strictly audited.
        </p>
      </div>

      {/* Layered Architectural Stack (Not generic cards) */}
      <div className="mt-12 grid lg:grid-cols-12 gap-8 items-start">
        {/* Left: The Interactive Vertical Security Stack (5 cols) */}
        <div className="lg:col-span-5 space-y-2">
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            const isActive = layer.level === activeLayer;
            return (
              <button
                key={layer.level}
                type="button"
                onClick={() => setActiveLayer(layer.level)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                  isActive
                    ? "bg-surface border-brand-700 shadow-cardMd ring-1 ring-brand-700/20"
                    : "bg-surface/60 border-hairline hover:bg-surface hover:border-hairline-strong"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-brand-700 text-white"
                        : "bg-brand-chip text-brand-800"
                    }`}
                  >
                    <Icon className="w-4 h-4 icon-sharp" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
                      Layer 0{layer.level} · {layer.boundary}
                    </div>
                    <div className="font-bold text-[14px] text-ink tracking-tight">
                      {layer.name}
                    </div>
                  </div>
                </div>

                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                    isActive ? "bg-brand-chip text-brand-800" : "text-ink-muted"
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Detailed Deep Dive on the Selected Layer (7 cols) */}
        <div className="lg:col-span-7 card p-6 sm:p-8 bg-surface border border-hairline-strong shadow-cardMd">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-hairline">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded text-[11px] font-mono font-bold bg-brand-700 text-white">
                LAYER 0{current.level}
              </span>
              <span className="text-[12px] font-mono text-ink-muted">
                {current.boundary}
              </span>
            </div>
            <div className="text-[11px] font-mono text-brand-800 bg-brand-chip px-2.5 py-1 rounded-md">
              Anchor: <code className="font-bold">{current.techAnchor}</code>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <h3 className="text-[24px] font-bold text-ink tracking-tight">
              {current.tagline}
            </h3>
            <p className="text-[15px] text-ink-soft leading-relaxed">
              {current.description}
            </p>

            <div className="pt-4 border-t border-hairline">
              <div className="text-[11px] font-mono uppercase tracking-wider font-bold text-ink mb-3">
                VERIFIED ARCHITECTURAL GUARANTEES
              </div>
              <ul className="space-y-2.5">
                {current.verifications.map((v, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-ink-soft">
                    <CheckCircle2 className="w-4 h-4 text-brand-700 shrink-0 mt-0.5" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
