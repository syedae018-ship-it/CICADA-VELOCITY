"use client";

import React, { useState } from "react";
import { Sparkles, BrainCircuit, Activity, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

export function AIOpsIntelligence() {
  const [selectedSignal, setSelectedSignal] = useState<"all" | "cpu" | "latency" | "errors">("all");

  return (
    <section id="aiops" className="py-20 sm:py-24 bg-canvas-deep/40 border-y border-hairline">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Section Header */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] font-bold text-brand-700">
            <BrainCircuit className="w-3.5 h-3.5" />
            EXPLAINABLE AIOPS REASONING
          </div>
          <h2 className="mt-3 text-[32px] sm:text-[42px] leading-[1.05] font-bold tracking-tight text-ink">
            From noisy signals to meaningful incidents.
          </h2>
          <p className="mt-4 text-[16px] text-ink-soft leading-relaxed">
            Raw alarms overwhelm operations teams. Velocity Cicada calculates dynamic 15-minute moving baselines
            and correlates co-occurring anomaly bursts into a single, explainable incident with actionable root cause.
          </p>
        </div>

        {/* Visual Demonstration: Signal Stream -> Anomaly -> Correlation -> Incident */}
        <div className="mt-12 card p-6 sm:p-8 bg-surface border border-hairline-strong shadow-cardMd">
          {/* Controls / Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-hairline">
            <div className="flex items-center gap-2 text-[12px] font-mono text-ink-muted">
              <span className="h-2 w-2 rounded-full bg-brand-700 animate-pulse" />
              <span>LIVE INCIDENT CORRELATION (ILLUSTRATIVE SYNTHESIS)</span>
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-canvas-deep border border-hairline text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setSelectedSignal("all")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  selectedSignal === "all" ? "bg-surface font-bold text-brand-800 shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                All 3 Signals
              </button>
              <button
                type="button"
                onClick={() => setSelectedSignal("cpu")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  selectedSignal === "cpu" ? "bg-surface font-bold text-brand-800 shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                CPU Spike
              </button>
              <button
                type="button"
                onClick={() => setSelectedSignal("latency")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  selectedSignal === "latency" ? "bg-surface font-bold text-brand-800 shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                Latency Surge
              </button>
              <button
                type="button"
                onClick={() => setSelectedSignal("errors")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  selectedSignal === "errors" ? "bg-surface font-bold text-brand-800 shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                5xx Sockets
              </button>
            </div>
          </div>

          {/* Custom SVG Time-Series Chart */}
          <div className="mt-6 relative">
            <div className="h-64 sm:h-72 w-full">
              <svg viewBox="0 0 900 280" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  {/* Shaded Normal Baseline Area */}
                  <linearGradient id="baselineArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bff09c" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#bff09c" stopOpacity="0.02" />
                  </linearGradient>

                  {/* Correlation Window Zone */}
                  <linearGradient id="corrZone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#104f2a" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#104f2a" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="40" y1="40" x2="880" y2="40" stroke="#e2e5de" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="100" x2="880" y2="100" stroke="#e2e5de" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="160" x2="880" y2="160" stroke="#e2e5de" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="220" x2="880" y2="220" stroke="#e2e5de" strokeWidth="1" />

                {/* Normal Baseline Envelope (±2σ) */}
                <path
                  d="M 40 180 Q 250 175 460 178 T 880 180 L 880 220 L 40 220 Z"
                  fill="url(#baselineArea)"
                />
                <text x="50" y="195" fill="#176534" fontSize="10" fontFamily="monospace" fontWeight="600">
                  NORMAL BASELINE BAND (15-min Moving Window)
                </text>

                {/* 120-Second Correlation Window Shading */}
                <rect x="490" y="20" width="260" height="200" fill="url(#corrZone)" rx="8" />
                <rect x="490" y="20" width="260" height="200" fill="none" stroke="#104f2a" strokeWidth="1" strokeDasharray="4 4" rx="8" />
                <text x="505" y="38" fill="#0a3a1e" fontSize="10" fontFamily="monospace" fontWeight="700">
                  120s CORRELATION CLUSTER · 3 SIGNALS BOUND
                </text>

                {/* Signal 1: CPU Spike (Dark Green) */}
                {(selectedSignal === "all" || selectedSignal === "cpu") && (
                  <path
                    d="M 40 200 Q 200 195 380 190 T 510 140 T 560 55 T 640 65 T 720 150 T 880 190"
                    fill="none"
                    stroke="#104f2a"
                    strokeWidth="2.5"
                  />
                )}

                {/* Signal 2: Latency Surge (Mint / Accent) */}
                {(selectedSignal === "all" || selectedSignal === "latency") && (
                  <path
                    d="M 40 210 Q 220 205 400 200 T 530 160 T 590 70 T 670 85 T 740 170 T 880 200"
                    fill="none"
                    stroke="#207a3d"
                    strokeWidth="2"
                    strokeDasharray="2 1"
                  />
                )}

                {/* Signal 3: 5xx Sockets (Amber / Warn) */}
                {(selectedSignal === "all" || selectedSignal === "errors") && (
                  <path
                    d="M 40 215 Q 240 212 440 210 T 550 180 T 610 90 T 690 110 T 760 185 T 880 210"
                    fill="none"
                    stroke="#8a5a07"
                    strokeWidth="2"
                  />
                )}

                {/* Anomaly Detection Marker */}
                <circle cx="560" cy="55" r="5" fill="#104f2a" stroke="#ffffff" strokeWidth="2" />
                <text x="575" y="58" fill="#104f2a" fontSize="11" fontFamily="monospace" fontWeight="700">
                  ANOMALY DETECTED (Z = +3.82)
                </text>
              </svg>
            </div>
          </div>

          {/* Bottom Analysis Cards: Progressive Synthesis Pipeline */}
          <div className="mt-8 grid md:grid-cols-3 gap-4 pt-6 border-t border-hairline">
            <div className="p-4 rounded-xl bg-surface-soft border border-hairline">
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
                STAGE 1 · BASELINE DRIFT
              </div>
              <div className="mt-1 font-bold text-[14px] text-ink">
                Threshold Exceeded
              </div>
              <p className="mt-1 text-[12px] text-ink-soft">
                Host CPU jumped from 18% to 89% in under 30s. Dynamic Z-score calculated at +3.82 against historical window.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-soft border border-hairline">
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
                STAGE 2 · TEMPORAL CORRELATION
              </div>
              <div className="mt-1 font-bold text-[14px] text-ink">
                3 Co-Occurring Anomalies
              </div>
              <p className="mt-1 text-[12px] text-ink-soft">
                Engine detected concurrent latency spike (420ms) and database connection backpressure inside the 120s clustering window.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-brand-chip/60 border border-[#d5e6b4]">
              <div className="text-[10px] font-mono uppercase tracking-wider text-brand-800 font-bold">
                STAGE 3 · UNIFIED INCIDENT
              </div>
              <div className="mt-1 font-bold text-[14px] text-brand-900">
                1 Consolidated Incident
              </div>
              <p className="mt-1 text-[12px] text-brand-800">
                Instead of 3 alert pager screams, creates Incident #0819 with root cause: "Postgres Connection Pool Saturation."
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
