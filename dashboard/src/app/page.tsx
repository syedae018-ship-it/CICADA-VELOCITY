"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Lock,
  ShieldCheck,
  Users,
  FileCheck2,
  Server,
  Sparkles,
  Download,
  Monitor,
  Code2,
  CheckCircle2,
  Activity,
  Layers,
  Zap,
  EyeOff,
  Wifi,
  Database,
  BarChart3,
  MessageSquare,
} from "lucide-react";

const LAYERS = [
  { id: 1, name: "Local Scrubbing", icon: Shield, tier: "Tier 1", blurb: "Regex + Shannon entropy + NER redaction." },
  { id: 2, name: "Outbound-Only", icon: Lock, tier: "Tier 1", blurb: "Zero inbound ports. SQLite buffer." },
  { id: 3, name: "HMAC + TLS", icon: ShieldCheck, tier: "Boundary", blurb: "Signed, replay-safe, schema-checked." },
  { id: 4, name: "Tenant Isolation", icon: Users, tier: "Tier 2", blurb: "JWT + Postgres RLS. No cross-tenant reads." },
  { id: 5, name: "Audit & Rollback", icon: FileCheck2, tier: "Tier 2", blurb: "Policy-checked, reversible, immutable log." },
];

const FEATURES = [
  { icon: EyeOff, title: "Privacy by construction", blurb: "Raw logs, passwords and IPs stay on the customer host. Only allow-listed metadata crosses the boundary." },
  { icon: Sparkles, title: "Explainable AIOps", blurb: "Every anomaly shows its 15-minute baseline, z-score and contributing signals. Every recommendation shows its reasoning path." },
  { icon: Zap, title: "Correlation, not noise", blurb: "Multiple signals from the same service inside 120 seconds become one incident with a likely cause." },
  { icon: MessageSquare, title: "Natural-language co-pilot", blurb: "Ask the AIOps engine about alerts, baselines, CPU, audit entries — plain English in, cards out." },
  { icon: Wifi, title: "Survives network drops", blurb: "Collector buffers locally, retries with backoff and replays with payload-id idempotency. Zero loss, zero duplicates." },
  { icon: Database, title: "Supabase + RLS", holder: true, blurb: "Multi-tenant Postgres with Row Level Security, Auth and Realtime. One source of truth across every view." },
];

const STATS = [
  { k: "0", label: "secrets leaked to SaaS", mono: true },
  { k: "1.2s", label: "p95 ingest latency", mono: true },
  { k: "9", label: "live demo scenarios", mono: true },
  { k: "100%", label: "schema-validated payloads", mono: true },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-canvas/80 backdrop-blur border-b border-hairline">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <div className="font-bold text-ink text-[16px] tracking-tight">Velocity Cicada</div>
            <span className="hidden sm:inline-flex ml-2 text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full bg-brand-chip text-brand-800 border border-[#d5e6b4] font-semibold">
              CICADA 2026
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <a
              href="https://github.com/syedae018-ship-it/CICADA-VELOCITY"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex btn-pill h-10 px-4 items-center gap-2"
            >
              <Code2 className="w-4 h-4 icon-sharp" /> GitHub
            </a>
            <Link href="/dashboard" className="btn-pill-primary h-10 px-5 inline-flex items-center gap-2">
              Open dashboard <ArrowRight className="w-4 h-4 icon-sharp" />
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 70% 30%, rgba(191,240,156,0.18) 0%, rgba(244,245,239,0) 60%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-14 pb-20 grid lg:grid-cols-5 gap-10 items-center">
          <div className="lg:col-span-3 space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.18em] font-semibold bg-brand-chip text-brand-800 border border-[#d5e6b4]">
              <Sparkles className="w-3.5 h-3.5" /> Privacy-first AIOps · defense-in-depth
            </span>
            <h1 className="text-[44px] sm:text-[58px] lg:text-[68px] leading-[0.98] font-bold tracking-[-0.038em] text-ink">
              Raw data stays <span className="text-brand-700">home.</span><br />
              Only <span className="text-brand-800">metadata</span> moves.
            </h1>
            <p className="max-w-2xl text-[17px] leading-relaxed text-ink-soft">
              Velocity Cicada is a two-tier observability platform. A local collector sits inside each
              customer environment, scrubs secrets, and sends only allow-listed metadata to a multi-tenant
              SaaS that learns baselines, correlates signals and proposes explainable, human-approved
              remediation — proving byte-for-byte what left the site.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/dashboard" className="btn-pill-primary h-12 px-6 inline-flex items-center gap-2">
                Open live dashboard <ArrowRight className="w-4 h-4 icon-sharp" />
              </Link>
              <a
                href="/downloads/CICADA-Local-Collector-Setup-v3.2.exe"
                download
                className="btn-pill h-12 px-6 inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4 icon-sharp" /> Download for Windows
              </a>
            </div>
            <div className="flex flex-wrap gap-5 pt-4 text-[13px] text-ink-muted">
              <Bullet>End-to-end live Supabase</Bullet>
              <Bullet>HMAC + Row-Level Security</Bullet>
              <Bullet>9 injectable scenarios</Bullet>
            </div>
          </div>

          {/* Right: 5-layer visual */}
          <div className="lg:col-span-2">
            <HeroShield />
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-hairline bg-canvas-deep/40">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className={`text-[36px] font-bold text-brand-800 leading-none ${s.mono ? "font-mono" : ""}`}>
                {s.k}
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-ink-muted">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture flow */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-20">
        <SectionHead
          eyebrow="How it works"
          title="Two tiers. One source of truth."
          sub="Every hop is verifiable. The dashboard shows the exact JSON that crossed the boundary — and the matching row in Supabase."
        />
        <div className="mt-10 grid md:grid-cols-4 gap-4">
          <FlowStep icon={Server} title="Tier 1 · Collector" sub="Per customer. Raw logs, SNMP, flows, agents. Redacts, aggregates, buffers." />
          <FlowStep icon={ShieldCheck} title="Transport" sub="HMAC-SHA256 over timestamp+body. HTTPS only. Replay-safe, outbound-only." />
          <FlowStep icon={Database} title="Tier 2 · SaaS" sub="Postgres + RLS. AIOps engine learns baselines, correlates alerts into incidents." />
          <FlowStep icon={BarChart3} title="Dashboard" sub="Realtime. Egress proof, side-by-side privacy view, explainable AIOps co-pilot." last />
        </div>
      </section>

      {/* 5 layers */}
      <section className="bg-canvas-deep/40 border-y border-hairline">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20">
          <SectionHead
            eyebrow="Defense in depth"
            title="Five layers between an attacker and your data."
            sub="Each layer is active in code, verifiable in the dashboard, and summarized in the Security view."
          />
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {LAYERS.map((l) => {
              const Icon = l.icon;
              return (
                <div key={l.id} className="card card-hover p-5">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
                      style={{
                        background:
                          "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 70%, #062715 100%)",
                      }}
                    >
                      <Icon className="w-5 h-5 icon-sharp" />
                    </div>
                    <span className="text-[10px] font-bold text-brand-800 bg-brand-chip rounded-full px-2 py-0.5">
                      {l.id}
                    </span>
                  </div>
                  <div className="mt-3 text-[10px] uppercase tracking-[0.18em] font-semibold text-ink-muted">
                    {l.tier}
                  </div>
                  <div className="mt-1 text-[15px] font-bold text-ink tracking-tight">{l.name}</div>
                  <p className="mt-2 text-[12px] text-ink-soft">{l.blurb}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-20">
        <SectionHead
          eyebrow="What you get"
          title="Observability that respects the customer."
          sub="Live scenarios, explainable incidents, and a co-pilot that speaks plain English."
        />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card card-hover p-6">
                <div className="h-11 w-11 rounded-xl bg-brand-chip flex items-center justify-center">
                  <Icon className="w-5 h-5 text-brand-800 icon-sharp" />
                </div>
                <div className="mt-4 text-[16px] font-bold text-ink tracking-tight">{f.title}</div>
                <p className="mt-2 text-[13px] text-ink-soft leading-relaxed">{f.blurb}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Download section */}
      <section id="download" className="max-w-7xl mx-auto px-5 sm:px-8 pb-24">
        <div
          className="card relative overflow-hidden p-8 sm:p-12 text-white"
          style={{
            background:
              "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 55%, #062715 100%)",
            boxShadow: "var(--shadow-hero)",
          }}
        >
          <div className="ring-deco -right-10 -top-10 h-48 w-48" />
          <div className="ring-deco -right-24 -bottom-24 h-72 w-72" />
          <div className="relative grid lg:grid-cols-5 gap-10 items-center">
            <div className="lg:col-span-3">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-brand-mint/90">
                <Monitor className="w-3.5 h-3.5" /> For Windows 10 & 11
              </div>
              <h2 className="mt-3 text-[36px] sm:text-[44px] leading-[1.02] font-bold tracking-[-0.03em]">
                Install the <span className="text-brand-mint">local collector</span>
              </h2>
              <p className="mt-4 text-white/85 text-[15px] max-w-xl">
                Tkinter desktop app. One installer, zero inbound ports. Collects CPU, memory, disk and
                network locally, redacts anything sensitive, and uploads only 18 allow-listed fields to Supabase.
                Only runtime dependency: <code className="font-mono text-brand-mint">psutil</code>.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/downloads/CICADA-Local-Collector-Setup-v3.2.exe"
                  download
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-full font-semibold bg-brand-mint text-brand-900 hover:brightness-95 transition shadow-cardLg"
                >
                  <Download className="w-4 h-4" /> Download installer (11 MB)
                </a>
                <a
                  href="https://github.com/syedae018-ship-it/CICADA-VELOCITY/blob/dev/cicada-local-collector/README_WINDOWS.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-full font-semibold border border-white/30 text-white hover:bg-white/10 transition"
                >
                  Install guide
                </a>
              </div>
              <ol className="mt-7 space-y-2.5 text-[13px] text-white/85">
                <InstallStep n={1}>Download <code className="font-mono">CICADA-Local-Collector-Setup-v3.2.exe</code></InstallStep>
                <InstallStep n={2}>Run the installer (no admin required — installs per-user)</InstallStep>
                <InstallStep n={3}>Open the app and paste your Supabase URL + device token</InstallStep>
                <InstallStep n={4}>Watch telemetry stream into the dashboard</InstallStep>
              </ol>
            </div>
            <div className="lg:col-span-2">
              <InstallerMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <LogoMark small />
            <div>
              <div className="font-bold text-ink text-[14px]">Velocity Cicada</div>
              <div className="text-[11px] text-ink-muted">CICADA 2026 · TechForcz × Atria</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-ink-muted">
            {["Next.js 16", "FastAPI", "Supabase", "Tailwind 4"].map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-surface-soft border border-hairline">
                {t}
              </span>
            ))}
          </div>
          <a
            href="https://github.com/syedae018-ship-it/CICADA-VELOCITY"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[13px] text-ink-soft hover:text-brand-700"
          >
            <Code2 className="w-4 h-4 icon-sharp" /> github.com/syedae018-ship-it/CICADA-VELOCITY
          </a>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-brand-700">{eyebrow}</div>
      <h2 className="mt-3 text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-[-0.03em] text-ink">
        {title}
      </h2>
      <p className="mt-4 text-[15px] text-ink-soft leading-relaxed">{sub}</p>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CheckCircle2 className="w-4 h-4 text-brand-700 icon-sharp" /> {children}
    </span>
  );
}

function FlowStep({
  icon: Icon,
  title,
  sub,
  last,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  last?: boolean;
}) {
  return (
    <div className="card p-5 relative">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand-chip flex items-center justify-center">
          <Icon className="w-5 h-5 text-brand-800 icon-sharp" />
        </div>
        <div className="font-bold text-ink text-[14px] tracking-tight">{title}</div>
      </div>
      <p className="mt-3 text-[12px] text-ink-soft">{sub}</p>
      {!last && (
        <div className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2 z-10">
          <div className="h-8 w-6 rounded-r-full bg-canvas flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-brand-700 icon-sharp" />
          </div>
        </div>
      )}
    </div>
  );
}

function InstallStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="h-6 w-6 shrink-0 rounded-full bg-brand-mint text-brand-900 text-[12px] font-bold flex items-center justify-center">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function LogoMark({ small }: { small?: boolean }) {
  const size = small ? 28 : 32;
  return (
    <div
      className="rounded-xl flex items-center justify-center shadow-cardMd"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 70%, #062715 100%)",
      }}
    >
      <Layers className="w-4 h-4 text-brand-mint icon-sharp" />
    </div>
  );
}

function HeroShield() {
  return (
    <div className="relative aspect-square max-w-[460px] mx-auto">
      <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="g1" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#176534" />
            <stop offset="55%" stopColor="#0a3a1e" />
            <stop offset="100%" stopColor="#062715" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* outer rings */}
        {[180, 150, 120, 90, 60].map((r, i) => (
          <circle
            key={r}
            cx="200"
            cy="200"
            r={r}
            fill="none"
            stroke={i === 0 ? "#bff09c" : "#176534"}
            strokeOpacity={0.9 - i * 0.14}
            strokeWidth={i === 0 ? 2 : 1}
          >
            <animate
              attributeName="r"
              values={`${r};${r + 4};${r}`}
              dur={`${3 + i * 0.4}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        {/* center shield */}
        <circle cx="200" cy="200" r="48" fill="url(#g1)" filter="url(#glow)" />
        <text
          x="200"
          y="208"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontWeight="700"
          fontSize="20"
          fill="#bff09c"
        >
          CORE
        </text>
        {/* layer labels */}
        {[
          { x: 200, y: 20, label: "L1 Redact" },
          { x: 380, y: 200, label: "L2 Outbound" },
          { x: 200, y: 380, label: "L3 HMAC" },
          { x: 20, y: 200, label: "L4 Tenant" },
          { x: 310, y: 60, label: "L5 Audit" },
        ].map((n) => (
          <g key={n.label}>
            <circle cx={n.x} cy={n.y} r="6" fill="#bff09c">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <text
              x={n.x}
              y={n.y - 12}
              textAnchor="middle"
              fontFamily="Inter, sans-serif"
              fontWeight="600"
              fontSize="11"
              fill="#104f2a"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function InstallerMockup() {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/15 p-4 backdrop-blur">
      <div className="rounded-xl bg-[#0b1210]/80 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          <span className="ml-2 text-[11px] text-white/60 font-mono">CICADA-Collector.exe</span>
        </div>
        <div className="p-5 space-y-3 text-[12px] font-mono">
          <Row label="Status" value="● ONLINE" valueClass="text-brand-mint" />
          <Row label="CPU" value="42.1 %" />
          <Row label="Memory" value="68.3 %" />
          <Row label="Network ↑" value="3.2 MB/s" />
          <Row label="Redacted" value="12 secrets" valueClass="text-brand-mint" />
          <div className="pt-3 mt-3 border-t border-white/10">
            <Row label="→ Supabase" value="202 Accepted" valueClass="text-brand-mint" />
            <Row label="Buffer" value="0 queued" />
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-[72%] bg-brand-mint">
              <div className="h-full w-full animate-pulse" />
            </div>
          </div>
          <div className="text-[10px] text-white/50 text-center">
            Health score · 72 / 100
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/60">{label}</span>
      <span className={`font-bold ${valueClass ?? "text-white"}`}>{value}</span>
    </div>
  );
}
