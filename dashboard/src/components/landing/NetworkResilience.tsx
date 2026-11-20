"use client";

import React, { useState } from "react";
import { WifiOff, Database, RotateCcw, CheckCircle2, ShieldAlert, Wifi } from "lucide-react";

export function NetworkResilience() {
  const [simulatedOutage, setSimulatedOutage] = useState<boolean>(false);

  return (
    <section id="resilience" className="py-20 sm:py-24 max-w-7xl mx-auto px-5 sm:px-8">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] font-bold text-brand-700">
            <WifiOff className="w-3.5 h-3.5" />
            RESILIENCE & REPLAY SAFETY
          </div>
          <h2 className="mt-3 text-[32px] sm:text-[42px] leading-[1.05] font-bold tracking-tight text-ink">
            Built for the moments your network isn't.
          </h2>
          <p className="mt-4 text-[16px] text-ink-soft leading-relaxed">
            Internet uplinks drop. Edge firewalls reset. Velocity Cicada guarantees zero data loss and zero
            duplicate metrics through atomic SQLite queue spooling and idempotent payload ingestion.
          </p>
        </div>

        {/* Interactive Simulation Switch */}
        <div className="flex items-center gap-3 p-2 rounded-xl bg-surface border border-hairline shadow-sm">
          <span className="text-[12px] font-mono text-ink-soft">Simulate Outage:</span>
          <button
            type="button"
            onClick={() => setSimulatedOutage(!simulatedOutage)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 ${
              simulatedOutage
                ? "bg-red-600 text-white shadow-sm"
                : "bg-brand-chip text-brand-800 border border-[#d5e6b4]"
            }`}
          >
            {simulatedOutage ? (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>UPLINK DOWN (ACTIVE)</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>NORMAL EGRESS (HEALTHY)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5-Step Resilience Pipeline Grid */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Step 1 */}
        <div className="card p-5 bg-surface border border-hairline flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold text-ink-muted">STEP 01</span>
              <span className="h-2 w-2 rounded-full bg-brand-700" />
            </div>
            <div className="font-bold text-[14px] text-ink">Connection Lost</div>
            <p className="mt-2 text-[12px] text-ink-soft leading-relaxed">
              Collector sender loop detects HTTP failure or socket timeout.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-hairline text-[11px] font-mono text-ink-muted">
            Status: {simulatedOutage ? <span className="text-red-500 font-bold">Triggered</span> : "Idle"}
          </div>
        </div>

        {/* Step 2 */}
        <div
          className={`card p-5 border transition-all flex flex-col justify-between ${
            simulatedOutage ? "bg-warn-50 border-warn-700/40 ring-1 ring-warn-700/20" : "bg-surface border-hairline"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold text-ink-muted">STEP 02</span>
              <Database className="w-4 h-4 text-brand-800" />
            </div>
            <div className="font-bold text-[14px] text-ink">Local SQLite Buffer</div>
            <p className="mt-2 text-[12px] text-ink-soft leading-relaxed">
              Egress payloads write to disk locally with ACID transactions. Zero RAM inflation.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-hairline text-[11px] font-mono text-ink-muted">
            Queue: {simulatedOutage ? <span className="text-warn-700 font-bold">14 Spooled</span> : "0 queued"}
          </div>
        </div>

        {/* Step 3 */}
        <div className="card p-5 bg-surface border border-hairline flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold text-ink-muted">STEP 03</span>
              <RotateCcw className="w-4 h-4 text-brand-800" />
            </div>
            <div className="font-bold text-[14px] text-ink">Exponential Backoff</div>
            <p className="mt-2 text-[12px] text-ink-soft leading-relaxed">
              Health check polls backend with jitter (1s, 2s, 4s... max 60s) to prevent thunderous herds.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-hairline text-[11px] font-mono text-ink-muted">
            Jitter: Bounded backoff
          </div>
        </div>

        {/* Step 4 */}
        <div className="card p-5 bg-surface border border-hairline flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold text-ink-muted">STEP 04</span>
              <CheckCircle2 className="w-4 h-4 text-brand-700" />
            </div>
            <div className="font-bold text-[14px] text-ink">Connection Restored</div>
            <p className="mt-2 text-[12px] text-ink-soft leading-relaxed">
              Heartbeat succeeds; collector initiates sequential drainage of stored outbox payloads.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-hairline text-[11px] font-mono text-ink-muted">
            Recovery: Automatic
          </div>
        </div>

        {/* Step 5 */}
        <div className="card p-5 bg-brand-chip/50 border border-[#d5e6b4] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold text-brand-800">STEP 05</span>
              <span className="text-[10px] font-mono font-bold text-brand-700 bg-white/80 px-1.5 py-0.5 rounded">
                DEDUPLICATED
              </span>
            </div>
            <div className="font-bold text-[14px] text-brand-900">Zero Duplicates</div>
            <p className="mt-2 text-[12px] text-brand-800 leading-relaxed">
              SaaS verifies unique payload IDs. Re-sent frames are safely deduplicated without alert re-firing.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#d5e6b4] text-[11px] font-mono text-brand-800 font-bold">
            Data Loss: 0 bytes
          </div>
        </div>
      </div>
    </section>
  );
}
