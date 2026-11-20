"use client";

import React from "react";
import Link from "next/link";
import { Layers, Code2, ArrowUpRight, ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-surface py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-hairline">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div
                className="h-8 w-8 rounded-xl flex items-center justify-center shadow-card"
                style={{
                  background:
                    "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 70%, #062715 100%)",
                }}
              >
                <Layers className="w-4 h-4 text-brand-mint icon-sharp" />
              </div>
              <span className="font-bold text-ink text-[16px] tracking-tight">
                Velocity Cicada
              </span>
            </div>
            <p className="text-[13px] text-ink-soft max-w-sm leading-relaxed">
              Two-tier, privacy-preserving infrastructure observability and explainable AIOps.
              Raw customer telemetry never leaves the private host; only verified metadata moves.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-[11px] font-mono text-brand-800 bg-brand-chip px-2.5 py-1 rounded-md border border-[#d5e6b4]">
                CICADA 2026 · TechForcz × Atria
              </span>
            </div>
          </div>

          {/* Links: Platform */}
          <div className="space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
              Platform
            </div>
            <ul className="space-y-2 text-[13px] text-ink-soft">
              <li>
                <Link href="/dashboard" className="hover:text-brand-700 transition-colors">
                  Live Dashboard
                </Link>
              </li>
              <li>
                <a href="#boundary" className="hover:text-brand-700 transition-colors">
                  Privacy Boundary
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-brand-700 transition-colors">
                  Architecture Pipeline
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-brand-700 transition-colors">
                  Five-Layer Security
                </a>
              </li>
              <li>
                <a href="#aiops" className="hover:text-brand-700 transition-colors">
                  AIOps Engine
                </a>
              </li>
            </ul>
          </div>

          {/* Links: Collector */}
          <div className="space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
              Collector & Client
            </div>
            <ul className="space-y-2 text-[13px] text-ink-soft">
              <li>
                <a
                  href="/downloads/CICADA-Local-Collector-Setup-v3.2.exe"
                  download
                  className="hover:text-brand-700 transition-colors flex items-center gap-1"
                >
                  <span>Windows Installer (v3.2)</span>
                  <ArrowUpRight className="w-3 h-3 text-ink-muted" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/syedae018-ship-it/CICADA-VELOCITY/blob/dev/cicada-local-collector/README_WINDOWS.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-700 transition-colors flex items-center gap-1"
                >
                  <span>Installation Guide</span>
                  <ArrowUpRight className="w-3 h-3 text-ink-muted" />
                </a>
              </li>
              <li>
                <a href="#resilience" className="hover:text-brand-700 transition-colors">
                  SQLite Durable Buffer
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/syedae018-ship-it/CICADA-VELOCITY/blob/dev/contracts/payload_schema.json"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-700 transition-colors flex items-center gap-1"
                >
                  <span>Payload Contract v1.0</span>
                  <ArrowUpRight className="w-3 h-3 text-ink-muted" />
                </a>
              </li>
            </ul>
          </div>

          {/* Links: Verified Stack */}
          <div className="space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
              Verified Stack
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Next.js 16",
                "FastAPI",
                "Supabase RLS",
                "HMAC-SHA256",
                "Windows DPAPI",
                "SQLite Outbox",
                "PyInstaller",
              ].map((tech) => (
                <span
                  key={tech}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-canvas border border-hairline text-ink-soft"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-ink-muted">
          <div>
            © 2026 Velocity Cicada. All rights reserved. Zero raw customer data leaves the host.
          </div>
          <a
            href="https://github.com/syedae018-ship-it/CICADA-VELOCITY"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-ink-soft hover:text-brand-700 font-mono transition-colors"
          >
            <Code2 className="w-4 h-4 icon-sharp" />
            <span>github.com/syedae018-ship-it/CICADA-VELOCITY</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
