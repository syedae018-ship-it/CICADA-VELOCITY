"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Download, Code2, ShieldCheck, Sparkles } from "lucide-react";

export function FinalCta() {
  return (
    <section className="py-20 sm:py-28 relative overflow-hidden bg-surface">
      <div className="absolute inset-0 bg-tech-grid opacity-40 pointer-events-none" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] -z-10 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(191,240,156,0.6) 0%, rgba(16,79,42,0.3) 70%, transparent 100%)",
        }}
      />

      <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center relative z-10 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono tracking-wider font-semibold bg-brand-chip text-brand-800 border border-[#d5e6b4]">
          <Sparkles className="w-3.5 h-3.5 text-brand-700" />
          <span>PROVABLE INTEGRITY · ZERO RAW EXPOSURE</span>
        </div>

        <h2 className="text-[36px] sm:text-[48px] lg:text-[56px] font-bold tracking-tight text-ink leading-[1.05]">
          See your infrastructure clearly.
          <br />
          <span className="text-brand-700">Without exposing what matters.</span>
        </h2>

        <p className="text-[17px] text-ink-soft max-w-2xl mx-auto leading-relaxed">
          Deploy our outbound-only Windows collector or test live scenarios in the SaaS sandbox.
          Experience how explainable AIOps operates when customer privacy is mathematically guaranteed.
        </p>

        {/* Action Group */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            href="/dashboard"
            className="btn-pill-primary h-12 px-7 text-[15px] font-semibold"
          >
            <span>Open Live Dashboard</span>
            <ArrowRight className="w-4 h-4 icon-sharp" />
          </Link>
          <a
            href="/downloads/CICADA-Local-Collector-Setup-v3.2.exe"
            download
            className="btn-pill h-12 px-6 text-[15px]"
          >
            <Download className="w-4 h-4 icon-sharp" />
            <span>Download for Windows</span>
          </a>
          <a
            href="https://github.com/syedae018-ship-it/CICADA-VELOCITY"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-pill h-12 px-5 text-[15px]"
            title="Inspect Source Code on GitHub"
          >
            <Code2 className="w-4 h-4 icon-sharp" />
            <span>Inspect Source</span>
          </a>
        </div>

        {/* Footnote Proof Points */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-[12px] font-mono text-ink-muted">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand-700" />
            Zero Inbound Sockets
          </span>
          <span>·</span>
          <span>100% Deterministic Egress</span>
          <span>·</span>
          <span>Supabase Postgres RLS</span>
        </div>
      </div>
    </section>
  );
}
