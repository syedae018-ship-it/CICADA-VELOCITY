"use client";

/**
 * Velocity Cicada landing page.
 *
 * Cinematic dark hero with a live-telemetry mock, then three cards on how it
 * works, two visual proof sections (privacy and explainable AI), a stats strip
 * and a final dark CTA. Nothing animates after the first fold except small
 * accents that help the page feel alive. Nav and footer are intentionally minimal.
 */
import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  Code2 as Github,
  Lock,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
} from "lucide-react";

// ───────────────────────── Nav ─────────────────────────

const NAV_LINKS = [
  { href: "#why", label: "Why" },
  { href: "#how", label: "How it works" },
  { href: "#proof", label: "Proof" },
  { href: "#demo", label: "Demo" },
];

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 mt-4">
        <div className="flex items-center justify-between h-14 px-4 sm:px-5 rounded-full border border-white/10 bg-[#0B1F14]/70 backdrop-blur-xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.45)]">
          <Link href="/" className="flex items-center gap-2.5 group">
            <LogoMark />
            <span className="text-white font-semibold tracking-[-0.02em] text-[15px] font-[family-name:var(--font-poppins)]">Velocity Cicada</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-[13px]">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#BFF09C] text-[#062715] font-semibold text-[13px] hover:brightness-110 transition"
          >
            Open dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <span className="relative h-8 w-8 rounded-full bg-[#143222] flex items-center justify-center overflow-hidden">
      <span className="absolute inset-0 landing-pulse" style={{
        background: "radial-gradient(circle at 50% 50%, rgba(191,240,156,0.65) 0%, transparent 60%)",
      }} />
      <span className="relative h-2.5 w-2.5 rounded-full bg-[#BFF09C]" />
    </span>
  );
}

// ───────────────────────── Hero ─────────────────────────

function Hero() {
  return (
    <section className="relative min-h-screen pt-32 pb-24 overflow-hidden text-white isolate"
      style={{ background: "radial-gradient(130% 110% at 10% 0%, #176534 0%, #0a3a1e 45%, #062715 100%)" }}
    >
      {/* Background atmosphere */}
      <div className="absolute inset-0 landing-grid pointer-events-none" aria-hidden />
      <div className="absolute inset-0 landing-noise opacity-60 pointer-events-none" aria-hidden />
      {/* Animated rings behind the mock */}
      <div className="absolute right-[-120px] top-[18%] w-[640px] h-[640px] pointer-events-none" aria-hidden>
        {[0, 1.4, 2.8].map((d, i) => (
          <span key={i}
            className="absolute inset-0 rounded-full border border-[#BFF09C]/40 landing-ring"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-full bg-[#BFF09C] blur-3xl opacity-40" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
        {/* Left: headline */}
        <div className="max-w-2xl">
          <p className="landing-rise inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[12px] font-medium text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-[#BFF09C] animate-pulse" />
            CICADA 2026 · Secure AIOps Observability
          </p>
          <h1 className="landing-rise mt-6 font-[family-name:var(--font-poppins)] text-[56px] sm:text-[76px] lg:text-[96px] leading-[0.96] tracking-[-0.045em] font-bold"
            style={{ animationDelay: "80ms", color: "#fff" }}
          >
            Watch everything.
            <br />
            <span className="text-[#BFF09C]">Leak</span>{" "}
            <span className="text-[#BFF09C] font-[family-name:var(--font-instrument)] italic font-normal tracking-[-0.02em]">nothing.</span>
          </h1>
          <p className="landing-rise mt-7 max-w-xl text-[19px] leading-[1.55] text-white/75"
            style={{ animationDelay: "180ms" }}
          >
            A local collector scrubs every secret before it leaves the building.
            A cloud brain learns, explains and recommends — without ever seeing
            your raw logs.
          </p>
          <div className="landing-rise mt-10 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "260ms" }}
          >
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#BFF09C] text-[#062715] font-semibold text-[15px] hover:brightness-110 transition shadow-[0_12px_32px_-12px_rgba(191,240,156,0.6)]"
            >
              See it live
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/15 text-white/90 font-medium text-[15px] hover:bg-white/5 transition"
            >
              How it works
            </a>
          </div>

          {/* Trust bar */}
          <div className="landing-fade mt-14 flex flex-wrap items-center gap-6 text-white/55 text-[13px]"
            style={{ animationDelay: "420ms" }}
          >
            {["HMAC-SHA256", "Row-level security", "Egress-proof panel", "Gemini on-device prompts"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#BFF09C]/80" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right: live mock */}
        <div className="landing-rise relative"
          style={{ animationDelay: "320ms" }}
        >
          <HeroMock />
          <div aria-hidden className="absolute inset-0 pointer-events-none landing-float" />
        </div>
      </div>

      {/* Marquee of metric chips */}
      <div className="relative mt-24 overflow-hidden border-y border-white/10 bg-black/20 py-5">
        <div className="landing-ticker flex gap-10 w-max">
          {[...MARQUEE, ...MARQUEE].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-white/60 text-[13px] font-mono whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-[#BFF09C]/70" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const MARQUEE = [
  "cpu_pct 42.1",
  "p95_ingest 1.3s",
  "alerts_open 0",
  "egress_sha256 ✓",
  "collector c_blr01 online",
  "firewall blocked 7",
  "prometheus live",
  "tenant t_acme",
  "mem_pct 68.4",
  "replay_after_outage 0 loss",
  "incidents correlated 1/3",
  "gemini streaming",
];

// ───────────────────────── Hero live mock ─────────────────────────

function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#0A1D12]/90 backdrop-blur-xl shadow-[0_60px_120px_-40px_rgba(0,0,0,0.6)] overflow-hidden">
      {/* chrome */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <span className="text-[11px] font-mono text-white/40">cicada · t_acme · live</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 p-5 pb-3">
        {[
          { k: "16", l: "sources" },
          { k: "3", l: "incidents" },
          { k: "0", l: "secrets" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[32px] font-bold text-white leading-none font-[family-name:var(--font-poppins)] tracking-[-0.03em]">{s.k}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/40">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="px-5 pb-4">
        <div className="flex items-end justify-between h-20 gap-1.5">
          {[0.5, 0.7, 0.4, 0.9, 0.6, 1, 0.75, 0.55, 0.85, 0.65, 0.95, 0.5, 0.8, 0.6, 0.45, 0.7].map((v, i) => (
            <span key={i}
              className="flex-1 rounded-t bg-[#BFF09C] landing-bar"
              style={{ height: `${v * 100}%`, animationDelay: `${i * 90}ms`, opacity: 0.35 + v * 0.65 }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-white/35">
          <span>cpu_pct · last 15m</span>
          <span className="text-[#BFF09C]">p95 42%</span>
        </div>
      </div>

      {/* Live incident card */}
      <div className="mx-4 mb-4 rounded-2xl border border-[#BFF09C]/20 bg-[#BFF09C]/5 p-4">
        <div className="flex items-start gap-3">
          <span className="relative h-9 w-9 rounded-full bg-[#BFF09C]/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#BFF09C]" />
            <span className="absolute inset-0 rounded-full border border-[#BFF09C]/40 landing-ring" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-white">CPU anomaly · payments-api</div>
            <div className="mt-0.5 text-[11.5px] text-white/60 leading-snug">
              +3.4σ above the 15-min baseline on <span className="font-mono">src_a4cc1a34</span>. Suggested action: scale pod to 3 replicas.
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#BFF09C] text-[#062715] text-[10px] font-bold">Approve</span>
              <span className="px-2 py-0.5 rounded-full border border-white/15 text-white/60 text-[10px]">Rollback</span>
              <span className="ml-auto text-[10px] font-mono text-white/40">conf 92%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Firewall ticker */}
      <div className="border-t border-white/8 px-5 py-3 flex items-center gap-2 text-[11px] text-white/55 font-mono">
        <ShieldCheck className="w-3.5 h-3.5 text-[#BFF09C]" />
        <span className="truncate">firewall · 542 allowed · 7 blocked · 0 quarantined</span>
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#BFF09C] landing-pulse" />
      </div>
    </div>
  );
}

// ───────────────────────── Why ─────────────────────────

function Why() {
  return (
    <section id="why" className="relative py-28 bg-canvas">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 text-center">
        <SectionLabel>Why we built it</SectionLabel>
        <h2 className="mt-5 font-[family-name:var(--font-poppins)] text-[44px] sm:text-[60px] leading-[1.02] tracking-[-0.04em] font-bold text-ink">
          Observability shouldn&apos;t cost you your <span className="text-brand-700 font-[family-name:var(--font-instrument)] italic font-normal tracking-[-0.015em]">privacy</span>.
        </h2>
        <p className="mt-6 text-[18px] leading-[1.6] text-ink-soft max-w-2xl mx-auto">
          Every monitoring vendor wants your raw logs. We don&apos;t.
          Secrets, emails, IPs, usernames — none of it ever leaves the host.
          Only the numbers you&apos;d publish on a status page do.
        </p>
      </div>
    </section>
  );
}

// ───────────────────────── How it works ─────────────────────────

function How() {
  const steps = [
    {
      icon: Lock,
      k: "01",
      t: "Collect, then clean",
      b: "A small agent sits inside the customer site. It strips secrets and keeps every raw log local.",
      line: "collector/redact.py",
    },
    {
      icon: Workflow,
      k: "02",
      t: "Correlate, don't overwhelm",
      b: "Learn a 15-minute baseline per metric. Group related alerts into one incident with a likely cause.",
      line: "saas/aiops/correlate.py",
    },
    {
      icon: Brain,
      k: "03",
      t: "Explain, then ask",
      b: "Every recommendation shows its reasoning, signals and confidence. A human approves. A human can roll back.",
      line: "saas/aiops/recommend.py",
    },
  ];
  return (
    <section id="how" className="relative py-28 bg-canvas-deep">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-5 font-[family-name:var(--font-poppins)] text-[44px] sm:text-[60px] leading-[1.02] tracking-[-0.04em] font-bold text-ink">
            Three stages.<br />
            <span className="font-[family-name:var(--font-instrument)] italic font-normal text-brand-700 tracking-[-0.02em]">One</span> trust boundary.
          </h2>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.k} className="group relative rounded-[28px] bg-surface border border-hairline p-7 hover:shadow-cardMd transition-shadow">
                <div className="flex items-start justify-between">
                  <span className="h-12 w-12 rounded-2xl bg-brand-chip flex items-center justify-center text-brand-800 group-hover:bg-brand-700 group-hover:text-brand-mint transition-colors">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-[13px] font-mono text-ink-muted">{s.k}</span>
                </div>
                <h3 className="mt-6 text-[22px] font-semibold text-ink leading-tight font-[family-name:var(--font-poppins)]">{s.t}</h3>
                <p className="mt-3 text-[14.5px] text-ink-soft leading-[1.55]">{s.b}</p>
                <div className="mt-7 pt-4 border-t border-hairline flex items-center justify-between text-[11.5px] font-mono text-ink-muted">
                  <span className="truncate">{s.line}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Proof: Privacy + Explainable ─────────────────────────

function Proof() {
  return (
    <section id="proof" className="relative py-28 bg-canvas">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 space-y-20">
        {/* Row 1: privacy */}
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <SectionLabel>Privacy, visible</SectionLabel>
            <h3 className="mt-5 font-[family-name:var(--font-poppins)] text-[40px] sm:text-[52px] leading-[1.02] tracking-[-0.04em] font-bold text-ink">
              See exactly what leaves.
              <br /><span className="font-[family-name:var(--font-instrument)] italic font-normal text-brand-700 tracking-[-0.02em]">Byte</span> for byte.
            </h3>
            <p className="mt-6 text-[17px] leading-[1.6] text-ink-soft max-w-lg">
              Every payload is logged with its SHA-256 before it crosses the wire.
              Open the Egress Proof panel and read it yourself.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["password", "api_key", "jwt", "email", "ipv4", "aws_key"].map((r) => (
                <span key={r} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline bg-surface text-[12px] font-mono text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  {r}
                </span>
              ))}
            </div>
          </div>
          <PrivacySplit />
        </div>

        {/* Row 2: explainable */}
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-center">
          <ExplainCard />
          <div>
            <SectionLabel>Explainable AIOps</SectionLabel>
            <h3 className="mt-5 font-[family-name:var(--font-poppins)] text-[40px] sm:text-[52px] leading-[1.02] tracking-[-0.04em] font-bold text-ink">
              Not a black box.
              <br />A <span className="font-[family-name:var(--font-instrument)] italic font-normal text-brand-700 tracking-[-0.02em]">trained</span> engineer.
            </h3>
            <p className="mt-6 text-[17px] leading-[1.6] text-ink-soft max-w-lg">
              Every anomaly comes with its baseline, its z-score, and the
              signals that contributed. Every recommendation shows its
              reasoning path. You approve the fix. You own the rollback.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PrivacySplit() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-danger-100 bg-[#fff8f5] p-5 min-h-[260px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-danger-700 font-bold">Raw · stays local</span>
          <span className="text-[10px] text-danger-700 font-bold">6 leaks</span>
        </div>
        <pre className="text-[11px] font-mono text-danger-700/90 leading-snug whitespace-pre-wrap break-words">
{`auth: user admin@acme.com
password=hunter2 from
192.168.4.21 token=
eyJhbGciOi... key=AKIA
IOSFODNN7EXAMPLE`}
        </pre>
      </div>
      <div className="rounded-2xl border border-brand-100 bg-brand-chip/40 p-5 min-h-[260px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-brand-800 font-bold">Sent · allow-listed</span>
          <span className="text-[10px] text-brand-800 font-bold">0 leaks</span>
        </div>
        <pre className="text-[11px] font-mono text-brand-900 leading-snug">
{`{
  "src_id": "src_a4cc1a34",
  "metric": "auth_fail",
  "count": 3,
  "severity": "high",
  "t_utc": "2026-11-21T09:14Z"
}`}
        </pre>
      </div>
    </div>
  );
}

function ExplainCard() {
  return (
    <div className="relative rounded-[28px] border border-hairline bg-surface p-6 shadow-cardMd">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-9 w-9 rounded-xl bg-brand-chip flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-brand-800" />
          </span>
          <div>
            <div className="text-[13px] font-semibold text-ink">AI Insights</div>
            <div className="text-[11px] text-ink-muted">payments-api · src_a4cc1a34</div>
          </div>
        </div>
        <span className="text-[11px] font-mono text-brand-800 bg-brand-chip px-2 py-0.5 rounded-full">conf 92%</span>
      </div>

      <div className="mt-5 text-[13px] text-ink leading-[1.55]">
        CPU is <b>+3.4σ</b> above the 15-min baseline (avg 38%, std 7.2).
        Memory and latency are co-elevated on the same pod.
      </div>

      <div className="mt-5 space-y-2">
        {[
          "15-min baseline exceeded by 3.4σ",
          "Memory +1.8σ, latency +2.1σ on same pod",
          "Deploy at 14:02 matches start of anomaly",
        ].map((t, i) => (
          <div key={i} className="flex items-start gap-2 text-[12.5px] text-ink-soft">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
            <span>{t}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-5 border-t border-hairline flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">Scale pod to 3 replicas</span>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-full border border-hairline text-[12px] font-semibold text-ink-soft">Rollback</button>
          <button className="px-3 py-1.5 rounded-full bg-brand-700 text-white text-[12px] font-semibold">Approve</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Stats strip ─────────────────────────

function StatsStrip() {
  const stats = [
    { k: "0", l: "secrets reached the SaaS" },
    { k: "1.3s", l: "p95 ingest latency" },
    { k: "7 / 7", l: "attacks blocked in firewall test" },
    { k: "0", l: "lost payloads after an outage" },
  ];
  return (
    <section className="relative py-16 bg-[#BFF09C] text-[#062715]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-10">
        {stats.map((s) => (
          <div key={s.l}>
            <div className="text-[56px] sm:text-[80px] leading-none font-bold font-[family-name:var(--font-poppins)] tracking-[-0.055em]">
              {s.k}
            </div>
            <div className="mt-3 text-[13px] font-medium text-[#0a3a1e]/80 max-w-[200px] leading-snug">
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── Final CTA ─────────────────────────

function FinalCTA() {
  return (
    <section id="demo" className="relative overflow-hidden text-white isolate"
      style={{ background: "radial-gradient(130% 110% at 85% 20%, #176534 0%, #0a3a1e 45%, #062715 100%)" }}
    >
      <div className="absolute inset-0 landing-grid pointer-events-none" aria-hidden />
      <div className="absolute -left-40 top-1/2 -translate-y-1/2 w-[540px] h-[540px]" aria-hidden>
        {[0, 1.6].map((d, i) => (
          <span key={i} className="absolute inset-0 rounded-full border border-[#BFF09C]/30 landing-ring" style={{ animationDelay: `${d}s` }} />
        ))}
      </div>
      <div className="relative mx-auto max-w-5xl px-5 sm:px-8 py-32 text-center">
        <SectionLabel tone="mint">Ready in 3 minutes</SectionLabel>
        <h2 className="mt-5 font-[family-name:var(--font-poppins)] text-[52px] sm:text-[80px] leading-[0.96] tracking-[-0.045em] font-bold" style={{ color: "#fff" }}>
          See it break.<br />
          <span className="font-[family-name:var(--font-instrument)] italic font-normal text-[#BFF09C] tracking-[-0.02em]">Watch</span> it heal.
        </h2>
        <p className="mt-7 text-[18px] leading-[1.6] text-white/70 max-w-xl mx-auto">
          Open the dashboard, trigger one of eight failure scenarios, and watch
          the pipeline detect, explain and recover — live.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className="group inline-flex items-center gap-2 px-7 py-4 rounded-full bg-[#BFF09C] text-[#062715] font-semibold text-[15px] hover:brightness-110 transition shadow-[0_18px_40px_-16px_rgba(191,240,156,0.7)]">
            Open the dashboard
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 px-7 py-4 rounded-full border border-white/15 font-medium text-[15px] hover:bg-white/5 transition">
            Sign in as tenant
          </Link>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Footer ─────────────────────────

function Footer() {
  return (
    <footer className="bg-[#062715] text-white/70 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-16 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-white font-semibold tracking-[-0.02em] text-[15px] font-[family-name:var(--font-poppins)]">Velocity Cicada</span>
          </div>
          <p className="mt-5 text-[13.5px] leading-[1.6] text-white/55 max-w-xs">
            Two-tier, privacy-first AIOps built in 24 hours for CICADA 2026.
          </p>
        </div>
        <FooterCol title="Product" links={[
          { label: "Overview", href: "/dashboard?view=overview" },
          { label: "Judge Mode", href: "/dashboard?view=judge" },
          { label: "Egress Proof", href: "/dashboard?view=egress" },
          { label: "Firewall", href: "/dashboard?view=firewall" },
        ]} />
        <FooterCol title="Resources" links={[
          { label: "How it works", href: "#how" },
          { label: "Privacy", href: "/dashboard?view=privacy" },
          { label: "Reliability", href: "/dashboard?view=reliability" },
        ]} />
        <FooterCol title="Build" links={[
          { label: "GitHub", href: "https://github.com", external: true, icon: Github },
          { label: "CLI", href: "/dashboard?view=reports", icon: TerminalSquare },
        ]} />
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-white/40">
          <span>© 2026 Velocity Cicada · CICADA 2026 · TechForcz × Atria</span>
          <span className="font-mono">Built privacy-first, 24h, zero leaks.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title, links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean; icon?: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{title}</div>
      <ul className="mt-5 space-y-3 text-[13.5px]">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <li key={l.label}>
              <Link
                href={l.href}
                target={l.external ? "_blank" : undefined}
                rel={l.external ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ───────────────────────── Helpers ─────────────────────────

function SectionLabel({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "mint" }) {
  const cls = tone === "mint"
    ? "text-[#BFF09C]/90"
    : "text-brand-700";
  return (
    <p className={`inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.22em] ${cls}`}>
      <span className="h-px w-8 bg-current opacity-50" />
      {children}
    </p>
  );
}

// ───────────────────────── Page ─────────────────────────

export default function LandingPage() {
  return (
    <main className="bg-canvas text-ink">
      <Nav />
      <Hero />
      <Why />
      <How />
      <Proof />
      <StatsStrip />
      <FinalCTA />
      <Footer />
    </main>
  );
}
