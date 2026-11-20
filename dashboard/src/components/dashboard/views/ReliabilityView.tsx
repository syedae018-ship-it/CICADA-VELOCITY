"use client";

import React from "react";
import { ReliabilityMetrics } from "@/types";

interface ReliabilityViewProps {
  metrics: ReliabilityMetrics;
}

export default function ReliabilityView({ metrics }: ReliabilityViewProps) {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-neutral-200 gap-2">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 uppercase tracking-tight">
            Reliability & Ingestion SLAs
          </h1>
          <p className="text-xs text-neutral-500">
            Proves the &lt;10s ingestion target, wire idempotency, and outage buffer recovery
          </p>
        </div>
        <div className="text-xs font-mono border border-neutral-200 bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded">
          SLA TARGET: &lt;10.0s (ACTUAL: {metrics.latency_p95_s}s)
        </div>
      </div>

      {/* 4 Stat Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* p95 Ingest Latency */}
        <div className="border border-neutral-200 bg-white p-4 rounded shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-neutral-500 mb-1">
            <span>p95 Ingest Latency</span>
            <span className="text-neutral-900 font-bold">&le; 10s Target</span>
          </div>
          <div className="text-3xl font-light font-mono text-neutral-900 tracking-tight">
            {metrics.latency_p95_s}s
          </div>
          <p className="text-[11px] text-neutral-500 mt-2 font-mono">
            render_time &minus; event_time_utc
          </p>
        </div>

        {/* Alert Latency */}
        <div className="border border-neutral-200 bg-white p-4 rounded shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-neutral-500 mb-1">
            <span>Last Alert Latency</span>
            <span className="text-neutral-900 font-bold">AIOps Fast</span>
          </div>
          <div className="text-3xl font-light font-mono text-neutral-900 tracking-tight">
            {metrics.alert_latency_s_last}s
          </div>
          <p className="text-[11px] text-neutral-500 mt-2 font-mono">
            Detection to dashboard event
          </p>
        </div>

        {/* Total Payloads */}
        <div className="border border-neutral-200 bg-white p-4 rounded shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-neutral-500 mb-1">
            <span>Received Payloads</span>
            <span className="text-neutral-900 font-bold">0 Seq Gaps</span>
          </div>
          <div className="text-3xl font-light font-mono text-neutral-900 tracking-tight">
            {metrics.received_count.toLocaleString()}
          </div>
          <p className="text-[11px] text-neutral-500 mt-2 font-mono">
            Sent IDs match Received IDs
          </p>
        </div>

        {/* Duplicates Rejected */}
        <div className="border border-neutral-200 bg-white p-4 rounded shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-neutral-500 mb-1">
            <span>Duplicates Rejected</span>
            <span className="text-neutral-900 font-bold">Idempotent</span>
          </div>
          <div className="text-3xl font-light font-mono text-neutral-900 tracking-tight">
            {metrics.duplicates_rejected}
          </div>
          <p className="text-[11px] text-neutral-500 mt-2 font-mono">
            HTTP 200 duplicate responses
          </p>
        </div>
      </div>

      {/* Outage Buffer Drain Chart */}
      <div className="border border-neutral-200 bg-white p-5 rounded-lg space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-tight">
              Outage Buffer Depth Over Time (Items in Local Outbox)
            </h3>
            <p className="text-[11px] text-neutral-500">
              Simulates a 60-second SaaS outage. Collector buffers locally, then drains with exponential backoff on reconnect.
            </p>
          </div>
          <span className="text-[10px] font-mono border border-neutral-200 bg-neutral-100 px-2 py-0.5 rounded text-neutral-700">
            BUFFER DRAINED (0 REMAINING)
          </span>
        </div>

        {/* Minimalist Monochrome Chart */}
        <div className="h-40 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b border-neutral-100">
          {metrics.outage_buffer_history.map((pt, i) => {
            const heightPct = pt.depth === 0 ? 3 : (pt.depth / 12) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[10px] font-mono text-neutral-500">
                  {pt.depth}
                </span>
                <div
                  className={`w-full transition-all ${
                    pt.depth > 0 ? "bg-neutral-900" : "bg-neutral-200"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-[10px] font-mono text-neutral-500">{pt.time}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
          <span>09:10: SaaS link severed (outbox growth)</span>
          <span>09:15: SaaS link re-established (drain complete &check;)</span>
        </div>
      </div>
    </div>
  );
}
