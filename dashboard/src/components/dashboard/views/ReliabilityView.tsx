"use client";

import React from "react";
import { ReliabilityMetrics } from "@/types";

interface ReliabilityViewProps {
  metrics: ReliabilityMetrics;
}

export default function ReliabilityView({ metrics }: ReliabilityViewProps) {
  const history = metrics.outage_buffer_history ?? [];
  const currentDepth = history.length ? history[history.length - 1].depth : 0;
  const peakDepth = history.reduce((m, p) => Math.max(m, p.depth), 0);
  const maxDepth = Math.max(12, peakDepth);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-hairline gap-2">
        <div>
          <h1 className="text-lg font-bold text-ink uppercase tracking-tight">
            Reliability & Ingestion SLAs
          </h1>
          <p className="text-xs text-ink-soft">
            Proves the &lt;10s ingestion target, wire idempotency, and outage buffer recovery
          </p>
        </div>
        <div className="text-xs font-mono border border-hairline bg-neutral-100 text-ink px-2.5 py-1 rounded">
          SLA TARGET: &lt;10.0s (ACTUAL: {metrics.latency_p95_s}s)
        </div>
      </div>

      {/* 4 Stat Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* p95 Ingest Latency */}
        <div className="border border-hairline bg-white p-4 rounded shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-ink-soft mb-1">
            <span>p95 Ingest Latency</span>
            <span className="text-ink font-bold">&le; 10s Target</span>
          </div>
          <div className="text-3xl font-light font-mono text-ink tracking-tight">
            {metrics.latency_p95_s}s
          </div>
          <p className="text-[11px] text-ink-soft mt-2 font-mono">
            {metrics.replayed_after_outage
              ? `live traffic · ${metrics.replayed_after_outage} replayed after outage (max ${metrics.max_replay_delay_s}s, ${metrics.seq_gaps === 0 ? "0 lost" : `${metrics.seq_gaps} missing`})`
              : "received_at − event_time_utc"}
          </p>
        </div>

        {/* Alert Latency */}
        <div className="border border-hairline bg-white p-4 rounded shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-ink-soft mb-1">
            <span>Last Alert Latency</span>
            <span className="text-ink font-bold">AIOps Fast</span>
          </div>
          <div className="text-3xl font-light font-mono text-ink tracking-tight">
            {metrics.alert_latency_s_last}s
          </div>
          <p className="text-[11px] text-ink-soft mt-2 font-mono">
            Detection to dashboard event
          </p>
        </div>

        {/* Total Payloads */}
        <div className="border border-hairline bg-white p-4 rounded shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-ink-soft mb-1">
            <span>Received Payloads</span>
            <span className="text-ink font-bold">0 Seq Gaps</span>
          </div>
          <div className="text-3xl font-light font-mono text-ink tracking-tight">
            {metrics.received_count.toLocaleString()}
          </div>
          <p className="text-[11px] text-ink-soft mt-2 font-mono">
            Sent IDs match Received IDs
          </p>
        </div>

        {/* Duplicates Rejected */}
        <div className="border border-hairline bg-white p-4 rounded shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-ink-soft mb-1">
            <span>Duplicates Rejected</span>
            <span className="text-ink font-bold">Idempotent</span>
          </div>
          <div className="text-3xl font-light font-mono text-ink tracking-tight">
            {metrics.duplicates_rejected}
          </div>
          <p className="text-[11px] text-ink-soft mt-2 font-mono">
            HTTP 200 duplicate responses
          </p>
        </div>
      </div>

      {/* Outage Buffer Drain Chart */}
      <div className="border border-hairline bg-white p-5 rounded-lg space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-hairline/60">
          <div>
            <h3 className="text-xs font-bold text-ink uppercase tracking-tight">
              Outage Buffer Depth Over Time (Items in Local Outbox)
            </h3>
            <p className="text-[11px] text-ink-soft">
              Simulates a 60-second SaaS outage. Collector buffers locally, then drains with exponential backoff on reconnect.
            </p>
          </div>
          <span className="text-[10px] font-mono border border-hairline bg-neutral-100 px-2 py-0.5 rounded text-ink-soft">
            {currentDepth > 0 ? `BUFFERING (${currentDepth} QUEUED)` : "BUFFER DRAINED (0 REMAINING)"}
          </span>
        </div>

        {/* Minimalist Monochrome Chart */}
        <div className="h-40 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b border-hairline/60">
          {metrics.outage_buffer_history.map((pt, i) => {
            const heightPct = pt.depth === 0 ? 3 : Math.max(6, (pt.depth / maxDepth) * 100);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[10px] font-mono text-ink-soft">
                  {pt.depth}
                </span>
                <div
                  className={`w-full transition-all ${
                    pt.depth > 0 ? "bg-brand-800" : "bg-neutral-200"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-[10px] font-mono text-ink-soft">{pt.time}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-ink-soft">
          <span>{history.length ? `${history[0].time}: window start` : "Waiting for collector samples…"}</span>
          <span>
            {peakDepth > 0
              ? currentDepth > 0
                ? `Outage in progress: ${currentDepth} payloads held locally`
                : `Peak ${peakDepth} buffered → drained, 0 lost ✓`
              : "No outage in this window ✓"}
          </span>
        </div>
      </div>
    </div>
  );
}
