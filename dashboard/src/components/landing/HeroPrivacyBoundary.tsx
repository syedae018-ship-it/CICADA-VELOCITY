"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Shield,
  ShieldCheck,
  Server,
  Lock,
  Sparkles,
  Database,
  Cpu,
  Layers,
  CheckCircle2,
  Activity,
  Terminal,
  Zap,
} from "lucide-react";

export function HeroPrivacyBoundary() {
  const [activeNode, setActiveNode] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24">
      {/* Subtle architectural background accents */}
      <div className="absolute inset-0 -z-10 bg-tech-grid opacity-60" />
      <div
        className="absolute top-1/4 right-5 w-96 h-96 -z-10 rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(191,240,156,0.5) 0%, rgba(16,79,42,0.2) 60%, transparent 80%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Hero Narrative */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider font-semibold bg-brand-chip text-brand-800 border border-[#d5e6b4]">
              <span className="h-2 w-2 rounded-full bg-brand-700 animate-pulse" />
              PRIVACY-FIRST AIOPS INFRASTRUCTURE
            </div>

            <h1 className="text-[44px] sm:text-[56px] xl:text-[64px] font-bold tracking-tight text-ink leading-[1.02]">
              Raw data stays <span className="text-brand-700">home.</span>
              <br />
              Only <span className="text-brand-800">metadata</span> moves.
            </h1>

            <p className="text-[17px] sm:text-[18px] text-ink-soft leading-relaxed max-w-xl">
              Velocity Cicada operates a strict cryptographic boundary. An outbound-only local collector
              scrubs secrets and filters telemetry inside your private perimeter, streaming only allow-listed
              metadata to an explainable AIOps engine in the cloud.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="btn-pill-primary h-12 px-6 text-[15px] font-semibold"
              >
                <span>Open Live Dashboard</span>
                <ArrowRight className="w-4 h-4 icon-sharp" />
              </Link>
              <a
                href="/downloads/CICADA-Local-Collector-Setup-v3.2.exe"
                download
                className="btn-pill h-12 px-5 text-[14px]"
              >
                <Download className="w-4 h-4 icon-sharp" />
                <span>Download for Windows</span>
              </a>
            </div>

            {/* Verified Technical Proof Points */}
            <div className="pt-4 border-t border-hairline/80 grid grid-cols-3 gap-4 text-left">
              <div>
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                  <span>Outbound Only</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">0 listening ports</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                  <span>DPAPI Protected</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">Hardware key vault</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                  <span>18-Field Egress</span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">Strict schema contract</div>
              </div>
            </div>
          </div>

          {/* Right Column: The Signature Visual — The Privacy Boundary */}
          <div className="lg:col-span-6">
            <div className="relative rounded-2xl bg-brand-950 p-5 sm:p-7 text-white shadow-hero border border-brand-800/80 overflow-hidden">
              {/* Subtle grid background on visual */}
              <div className="absolute inset-0 bg-tech-grid-dark opacity-30 pointer-events-none" />

              {/* Header Bar of the Architecture Visual */}
              <div className="relative flex items-center justify-between pb-4 border-b border-white/10 text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-mint animate-pulse" />
                  <span className="text-white/80 font-semibold tracking-wide">
                    PRIVACY DEMARCATION INSTRUMENT
                  </span>
                </div>
                <div className="text-brand-mint/70">
                  SPEC: VC-SPEC-0819 · v1.0
                </div>
              </div>

              {/* The Two-Tier Diagram with Cryptographic Boundary */}
              <div className="relative mt-6 grid grid-cols-11 gap-2 items-stretch min-h-[380px]">
                {/* TIER 1: CUSTOMER ON-PREM ENVIRONMENT (5 cols) */}
                <div className="col-span-5 flex flex-col justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">
                        TIER 1 · ON-PREM / VPC
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                        Zero Egress Secrets
                      </span>
                    </div>

                    {/* Nodes inside Tier 1 */}
                    <div className="space-y-2.5">
                      {/* Host Telemetry Node */}
                      <button
                        type="button"
                        onClick={() => setActiveNode("host")}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          activeNode === "host"
                            ? "bg-white/15 border-brand-mint/80 shadow-glowMint"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Server className="w-3.5 h-3.5 text-brand-mint" />
                            <span className="text-[12px] font-semibold text-white">Host Telemetry</span>
                          </div>
                          <span className="text-[10px] font-mono text-white/40">10s sample</span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono text-white/50 truncate">
                          CPU, RAM, Disk, EventLog
                        </div>
                      </button>

                      {/* Local Collector & Redaction Engine */}
                      <button
                        type="button"
                        onClick={() => setActiveNode("redact")}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          activeNode === "redact"
                            ? "bg-white/15 border-brand-mint/80 shadow-glowMint"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-brand-mint" />
                            <span className="text-[12px] font-semibold text-white">Scrubbing Engine</span>
                          </div>
                          <span className="text-[10px] font-mono text-brand-mint">Active</span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono text-white/50">
                          Regex + Shannon Entropy
                        </div>
                      </button>

                      {/* Allow-list Filter */}
                      <button
                        type="button"
                        onClick={() => setActiveNode("allowlist")}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          activeNode === "allowlist"
                            ? "bg-white/15 border-brand-mint/80 shadow-glowMint"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-brand-mint" />
                            <span className="text-[12px] font-semibold text-white">Allow-List Filter</span>
                          </div>
                          <span className="text-[10px] font-mono text-white/40">18 fields</span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono text-white/50">
                          Drops unauthorized keys
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Local Buffer status */}
                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/60">
                    <span>SQLite Outbox:</span>
                    <span className="text-brand-mint">0 pending / synced</span>
                  </div>
                </div>

                {/* THE DEMARCATION BOUNDARY (1 col) */}
                <div className="col-span-1 flex flex-col items-center justify-center relative my-2">
                  {/* Vertical dashed line */}
                  <div className="absolute inset-y-0 w-px border-r-2 border-dashed border-brand-mint/40" />

                  {/* Illuminated Security Badge */}
                  <div
                    className="relative z-10 p-1.5 rounded-full bg-brand-900 border border-brand-mint text-brand-mint shadow-glowMint"
                    title="Cryptographic Boundary (Outbound-Only TLS 1.3 + HMAC)"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </div>

                  {/* Micro label */}
                  <div className="relative z-10 mt-2 px-1 py-0.5 rounded bg-brand-950 border border-brand-mint/40 text-[8px] font-mono text-brand-mint uppercase tracking-tighter whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
                    HMAC SIGNED
                  </div>
                </div>

                {/* TIER 2: VELOCITY CICADA CLOUD (5 cols) */}
                <div className="col-span-5 flex flex-col justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">
                        TIER 2 · SAAS CLOUD
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-brand-mint/10 text-brand-mint border border-brand-mint/20">
                        Multi-Tenant RLS
                      </span>
                    </div>

                    {/* Nodes inside Tier 2 */}
                    <div className="space-y-2.5">
                      {/* Ingest Gateway */}
                      <button
                        type="button"
                        onClick={() => setActiveNode("ingest")}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          activeNode === "ingest"
                            ? "bg-white/15 border-brand-mint/80 shadow-glowMint"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-brand-mint" />
                            <span className="text-[12px] font-semibold text-white">Ingest Gateway</span>
                          </div>
                          <span className="text-[10px] font-mono text-white/40">~1.2s p95</span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono text-white/50">
                          HMAC Auth + Nonce Verification
                        </div>
                      </button>

                      {/* AIOps Correlation Engine */}
                      <button
                        type="button"
                        onClick={() => setActiveNode("aiops")}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          activeNode === "aiops"
                            ? "bg-white/15 border-brand-mint/80 shadow-glowMint"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-brand-mint" />
                            <span className="text-[12px] font-semibold text-white">AIOps Engine</span>
                          </div>
                          <span className="text-[10px] font-mono text-brand-mint">Learning</span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono text-white/50">
                          15m Baseline + 120s Correlation
                        </div>
                      </button>

                      {/* Realtime Dashboard */}
                      <button
                        type="button"
                        onClick={() => setActiveNode("dashboard")}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          activeNode === "dashboard"
                            ? "bg-white/15 border-brand-mint/80 shadow-glowMint"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-brand-mint" />
                            <span className="text-[12px] font-semibold text-white">Live Dashboard</span>
                          </div>
                          <span className="text-[10px] font-mono text-white/40">Realtime</span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono text-white/50">
                          Egress Proof + Root Cause
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* SaaS Security Status */}
                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/60">
                    <span>Supabase RLS:</span>
                    <span className="text-brand-mint">Tenant Isolated</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Interactive Drawer at bottom of visual */}
              <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/10 text-[12px] font-mono">
                {activeNode === "host" && (
                  <div>
                    <span className="text-brand-mint font-semibold">TIER 1 · HOST TELEMETRY:</span> Samples local CPU, memory, disk, network and OS event logs every 10 seconds. Completely local to the host.
                  </div>
                )}
                {activeNode === "redact" && (
                  <div>
                    <span className="text-brand-mint font-semibold">TIER 1 · LOCAL SCRUBBER:</span> Executes regex patterns for API keys, passwords, and tokens. Shannon entropy analyzer flags high-randomness secrets.
                  </div>
                )}
                {activeNode === "allowlist" && (
                  <div>
                    <span className="text-brand-mint font-semibold">TIER 1 · ALLOW-LIST:</span> Only 18 validated metadata fields are accepted into the egress buffer. Unauthorized payload keys are permanently dropped.
                  </div>
                )}
                {activeNode === "ingest" && (
                  <div>
                    <span className="text-brand-mint font-semibold">TIER 2 · INGEST GATEWAY:</span> Replay protection checks monotonic timestamps and validates HMAC-SHA256 signature against registered collector secret.
                  </div>
                )}
                {activeNode === "aiops" && (
                  <div>
                    <span className="text-brand-mint font-semibold">TIER 2 · AIOPS ENGINE:</span> Evaluates real-time Z-scores against a 15-minute moving baseline. Correlates co-occurring anomalies inside 120s windows into single incidents.
                  </div>
                )}
                {activeNode === "dashboard" && (
                  <div>
                    <span className="text-brand-mint font-semibold">TIER 2 · OPERATOR DASHBOARD:</span> Displays byte-for-byte egress proofs, explainable root-cause narratives, and one-click remediation playbooks.
                  </div>
                )}
                {!activeNode && (
                  <div className="text-white/60 flex items-center justify-between">
                    <span>Click any architecture stage above to inspect its cryptographic guarantees.</span>
                    <span className="text-brand-mint text-[11px]">INTERACTIVE</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
