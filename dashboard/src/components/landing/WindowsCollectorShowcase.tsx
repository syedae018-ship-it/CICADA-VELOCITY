"use client";

import React from "react";
import {
  Download,
  ShieldCheck,
  Server,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Lock,
  ArrowUpRight,
  CheckCircle2,
  Terminal,
} from "lucide-react";

export function WindowsCollectorShowcase() {
  return (
    <section id="download" className="py-20 sm:py-24 bg-canvas-deep/40 border-y border-hairline">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left: Product Information & 3 Installation Steps (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] font-bold text-brand-700">
              <Server className="w-3.5 h-3.5" />
              NATIVE WINDOWS COLLECTOR
            </div>

            <h2 className="text-[32px] sm:text-[44px] leading-[1.05] font-bold tracking-tight text-ink">
              Enterprise monitoring.
              <br />
              <span className="text-brand-700">Native Windows execution.</span>
            </h2>

            <p className="text-[16px] text-ink-soft leading-relaxed">
              No Python shells or intrusive background command windows. Velocity Cicada installs as a native
              Windows Service with a companion status tray interface, hardware DPAPI protection, and single-instance
              mutex controls.
            </p>

            {/* 3 Step Deployment Flow */}
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3.5">
                <span className="h-7 w-7 rounded-full bg-brand-700 text-white text-[12px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <div className="font-bold text-[14px] text-ink">
                    Install via Inno Setup
                  </div>
                  <div className="text-[13px] text-ink-soft mt-0.5">
                    Self-contained Windows installer (11 MB). Installs the background service and tray companion with zero external dependencies.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <span className="h-7 w-7 rounded-full bg-brand-700 text-white text-[12px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <div className="font-bold text-[14px] text-ink">
                    Configure DPAPI Vault
                  </div>
                  <div className="text-[13px] text-ink-soft mt-0.5">
                    Collector credentials and tenant secret are encrypted using Windows CryptProtectData. No plaintext keys stored on disk.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <span className="h-7 w-7 rounded-full bg-brand-700 text-white text-[12px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <div className="font-bold text-[14px] text-ink">
                    Stream Sanitized Metadata
                  </div>
                  <div className="text-[13px] text-ink-soft mt-0.5">
                    Telemetry is sampled every 10s and periodic allow-listed payloads are dispatched every 60s via outbound-only HTTPS.
                  </div>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <a
                href="/downloads/CICADA-Local-Collector-Setup-v3.2.exe"
                download
                className="btn-pill-primary h-12 px-6 text-[14px] font-semibold"
              >
                <Download className="w-4 h-4 icon-sharp" />
                <span>Download for Windows (11 MB)</span>
              </a>
              <a
                href="https://github.com/syedae018-ship-it/CICADA-VELOCITY/blob/dev/cicada-local-collector/README_WINDOWS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-pill h-12 px-5 text-[14px]"
              >
                <span>Installation Guide</span>
                <ArrowUpRight className="w-3.5 h-3.5 icon-sharp" />
              </a>
            </div>

            <div className="flex items-center gap-4 text-[12px] font-mono text-ink-muted pt-2">
              <span>Compatibility: Windows 10, 11 & Windows Server</span>
              <span>·</span>
              <span>SHA-256 Verified</span>
            </div>
          </div>

          {/* Right: Realistic Application Mockup (6 cols) */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl bg-brand-950 p-5 text-white border border-brand-800 shadow-hero">
              {/* Window Title Bar */}
              <div className="flex items-center justify-between pb-3.5 border-b border-white/10 text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-white/80 font-bold ml-2">
                    Velocity Cicada Collector v3.2.0
                  </span>
                </div>
                <span className="text-brand-mint text-[10px] px-2 py-0.5 rounded bg-brand-mint/10 border border-brand-mint/20">
                  BACKGROUND SERVICE
                </span>
              </div>

              {/* Collector Dashboard Content */}
              <div className="mt-5 space-y-4 font-mono text-[12px]">
                {/* Status Hero Card */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-brand-mint animate-pulse" />
                    <div>
                      <div className="text-[13px] font-bold text-white">
                        ACTIVE · PERIODIC METADATA EGRESS
                      </div>
                      <div className="text-[11px] text-white/50 mt-0.5">
                        Target: https://api.velocitycicada.io/v1/ingest
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-brand-mint font-bold">202 ACCEPTED</div>
                    <div className="text-[10px] text-white/40">Last send: 4s ago</div>
                  </div>
                </div>

                {/* 4 Metric Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] text-white/40 flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-brand-mint" />
                      <span>CPU LOAD</span>
                    </div>
                    <div className="text-[16px] font-bold text-white mt-1">18.4%</div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] text-white/40 flex items-center gap-1">
                      <Activity className="w-3 h-3 text-brand-mint" />
                      <span>MEMORY</span>
                    </div>
                    <div className="text-[16px] font-bold text-white mt-1">42.1%</div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] text-white/40 flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-brand-mint" />
                      <span>DISK USAGE</span>
                    </div>
                    <div className="text-[16px] font-bold text-white mt-1">54.0%</div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] text-white/40 flex items-center gap-1">
                      <Wifi className="w-3 h-3 text-brand-mint" />
                      <span>LATENCY</span>
                    </div>
                    <div className="text-[16px] font-bold text-white mt-1">24ms</div>
                  </div>
                </div>

                {/* Deep Technical Rows */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/60">Service Mutex:</span>
                    <span className="text-white font-bold">Global\VelocityCicadaCollector_Service_Mutex</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/60">Local SQLite Outbox:</span>
                    <span className="text-brand-mint font-bold">0 spooled (Buffer clean)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/60">Local Redaction Engine:</span>
                    <span className="text-brand-mint font-bold">14 sensitive tokens isolated</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/60">Credential Storage:</span>
                    <span className="text-white font-bold">Windows DPAPI Protected</span>
                  </div>
                </div>

                {/* Footer bar */}
                <div className="pt-2 flex items-center justify-between text-[10px] text-white/40">
                  <span>Process: CicadaService.exe (PID: 4182)</span>
                  <span>Health: 100% Operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
