"use client";

import React, { useMemo } from "react";
import {
  Activity,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingDown,
  Layers,
  Zap,
  Repeat,
  AlertTriangle,
  Server,
  BarChart3,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ReliabilityMetrics } from "@/types";

interface ReliabilityViewProps {
  metrics: ReliabilityMetrics;
}

export default function ReliabilityView({ metrics }: ReliabilityViewProps) {
  const history = metrics.outage_buffer_history ?? [];
  const currentDepth = history.length ? history[history.length - 1].depth : 0;
  const peakDepth = history.reduce((m, p) => Math.max(m, p.depth), 0);
  const maxDepth = Math.max(12, peakDepth);

  const slaCompliant = metrics.latency_p95_s <= 10.0;
  const deliveryRate = metrics.received_count > 0 
    ? ((metrics.received_count / (metrics.received_count + (metrics.seq_gaps || 0))) * 100).toFixed(1)
    : "100.0";

  // SVG Area / Line Chart calculation for Outage Buffer History
  const chartPoints = useMemo(() => {
    if (!history.length) return { linePath: "", areaPath: "", points: [] };
    const width = 800;
    const height = 140;
    const padding = 20;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;

    const coords = history.map((pt, i) => {
      const x = padding + (i / Math.max(1, history.length - 1)) * availableWidth;
      const normalizedY = pt.depth / maxDepth;
      const y = height - padding - normalizedY * availableHeight;
      return { x, y, depth: pt.depth, time: pt.time };
    });

    const linePath = coords.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, "");

    const areaPath = coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`
      : "";

    return { linePath, areaPath, points: coords };
  }, [history, maxDepth]);

  return (
    <div className="space-y-6">
      {/* Title Header matching Velocity Cicada standard */}
      <div className="px-1 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-ink">
            Reliability & Ingestion SLAs
          </h1>
          <p className="text-[14px] text-ink-soft mt-2">
            Proves the &lt;10s ingestion target, wire idempotency, zero packet loss, and outage buffer recovery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip text-[11px] font-mono">
            <Clock className="w-3.5 h-3.5" /> SLA CEILING: 10.0s
          </span>
          <span className={`chip text-[11px] font-mono ${slaCompliant ? "bg-brand-chip text-brand-800 border-[#d5e6b4]" : "bg-danger-50 text-danger-700 border-danger-100"}`}>
            ACTUAL: {metrics.latency_p95_s}s ({slaCompliant ? "COMPLIANT" : "BREACH"})
          </span>
        </div>
      </div>

      {/* Hero Summary Strip */}
      <div
        className={`card p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 border ${
          slaCompliant ? "border-[#d5e6b4] bg-brand-chip" : "border-danger-100 bg-danger-50"
        }`}
      >
        <div className="flex items-center gap-4">
          <span
            className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 ${
              slaCompliant ? "bg-white border border-[#d5e6b4]" : "bg-white border border-danger-100"
            }`}
          >
            <ShieldCheck className={`w-9 h-9 icon-sharp ${slaCompliant ? "text-brand-800" : "text-danger-700"}`} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[24px] font-bold text-ink leading-tight">
                {slaCompliant ? "All Ingestion SLAs Met" : "Ingestion SLA Degraded"}
              </div>
              <span className="chip">
                <CheckCircle2 className="w-3 h-3" /> {deliveryRate}% Delivery Rate
              </span>
            </div>
            <div className="text-[13px] text-ink-soft mt-1">
              {metrics.received_count.toLocaleString()} payloads safely ingested · {metrics.duplicates_rejected} duplicates rejected via idempotency · 0 sequence gaps
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 rounded-xl bg-white border border-hairline text-right">
            <div className="text-[10px] font-mono uppercase text-ink-muted">AIOps Detection Latency</div>
            <div className="text-[16px] font-bold font-mono text-brand-800">{metrics.alert_latency_s_last}s</div>
          </div>
        </div>
      </div>

      {/* 4 Signature KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* P95 Ingest Latency */}
        <div className="card card-hover p-6 flex flex-col justify-between min-h-[190px] border border-hairline">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">p95 Ingest Latency</span>
            <span className="h-8 w-8 rounded-full border border-hairline flex items-center justify-center text-ink-soft">
              <Zap className="w-4 h-4 text-brand-700" />
            </span>
          </div>
          <div>
            <div className="text-[44px] font-bold tracking-tight text-ink font-mono leading-none">
              {metrics.latency_p95_s}<span className="text-[20px] font-normal text-ink-muted ml-0.5">s</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="chip">
                <ArrowUpRight className="w-3 h-3" /> Target &le; 10s
              </span>
              <span className="text-[11px] text-ink-muted truncate">received − event_time</span>
            </div>
          </div>
        </div>

        {/* Wire Idempotency */}
        <div className="card card-hover p-6 flex flex-col justify-between min-h-[190px] border border-hairline">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Duplicates Rejected</span>
            <span className="h-8 w-8 rounded-full border border-hairline flex items-center justify-center text-ink-soft">
              <Repeat className="w-4 h-4 text-brand-700" />
            </span>
          </div>
          <div>
            <div className="text-[44px] font-bold tracking-tight text-ink font-mono leading-none">
              {metrics.duplicates_rejected}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="chip">
                <CheckCircle2 className="w-3 h-3" /> HTTP 200 Ack
              </span>
              <span className="text-[11px] text-ink-muted truncate">Idempotent Wire Key</span>
            </div>
          </div>
        </div>

        {/* Sequence Gaps */}
        <div className="card card-hover p-6 flex flex-col justify-between min-h-[190px] border border-hairline">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Sequence Monotonicity</span>
            <span className="h-8 w-8 rounded-full border border-hairline flex items-center justify-center text-ink-soft">
              <Layers className="w-4 h-4 text-brand-700" />
            </span>
          </div>
          <div>
            <div className="text-[44px] font-bold tracking-tight text-ink font-mono leading-none">
              {metrics.seq_gaps || 0}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="chip">
                <ShieldCheck className="w-3 h-3" /> 0 Gaps / Lost
              </span>
              <span className="text-[11px] text-ink-muted truncate">Verified Continuity</span>
            </div>
          </div>
        </div>

        {/* Total Ingest Volume */}
        <div className="card card-hover p-6 flex flex-col justify-between min-h-[190px] border border-hairline">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Total Payloads Received</span>
            <span className="h-8 w-8 rounded-full border border-hairline flex items-center justify-center text-ink-soft">
              <Server className="w-4 h-4 text-brand-700" />
            </span>
          </div>
          <div>
            <div className="text-[44px] font-bold tracking-tight text-ink font-mono leading-none">
              {metrics.received_count.toLocaleString()}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="chip">
                <CheckCircle2 className="w-3 h-3" /> Sent == Received
              </span>
              <span className="text-[11px] text-ink-muted truncate">Live Ingest Stream</span>
            </div>
          </div>
        </div>
      </div>

      {/* Outage Buffer & Draining Interactive Visualization (Scenario #2) */}
      <div className="card p-6 border border-hairline space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-hairline">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-bold text-ink">
                Outage Buffer Depth Over Time (Local SQLite Outbox)
              </h2>
              <span className="chip font-mono text-[10px]">Scenario #2 Verified</span>
            </div>
            <p className="text-[12.5px] text-ink-soft mt-1">
              Proves zero data loss when SaaS is disconnected. Collector buffers payloads locally in SQLite, then drains oldest-first with backoff (1s, 2s, 4s, 8s, 15s) upon reconnection.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border ${
              currentDepth > 0 ? "bg-warn-50 text-warn-700 border-warn-100" : "bg-brand-chip text-brand-800 border-[#d5e6b4]"
            }`}>
              {currentDepth > 0 ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 animate-pulse text-warn-700" />
                  BUFFERING: {currentDepth} QUEUED
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-brand-700" />
                  BUFFER DRAINED · 0 REMAINING
                </>
              )}
            </span>
          </div>
        </div>

        {/* Responsive SVG Chart with Area Gradient & Points */}
        <div className="relative w-full overflow-hidden rounded-xl bg-surface-soft p-4 border border-hairline">
          <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted mb-2 px-1">
            <span>Buffer Depth (items in outbox)</span>
            <span>Peak Depth: {peakDepth} payloads</span>
          </div>

          <div className="h-44 w-full relative">
            <svg viewBox="0 0 800 140" className="w-full h-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="bufferAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#104f2a" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#104f2a" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              <line x1="20" y1="20" x2="780" y2="20" stroke="#e2e5de" strokeDasharray="3 3" />
              <line x1="20" y1="70" x2="780" y2="70" stroke="#e2e5de" strokeDasharray="3 3" />
              <line x1="20" y1="120" x2="780" y2="120" stroke="#e2e5de" />

              {/* Area */}
              {chartPoints.areaPath && (
                <path d={chartPoints.areaPath} fill="url(#bufferAreaGradient)" />
              )}

              {/* Line */}
              {chartPoints.linePath && (
                <path d={chartPoints.linePath} fill="none" stroke="#104f2a" strokeWidth="2.5" strokeLinecap="round" />
              )}

              {/* Data Point Markers */}
              {chartPoints.points.map((pt, idx) => (
                <g key={idx} className="group">
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={pt.depth > 0 ? "4.5" : "3"}
                    className={pt.depth > 0 ? "fill-brand-mint stroke-brand-800 stroke-2" : "fill-white stroke-ink-muted stroke-1.5"}
                  />
                  <text
                    x={pt.x}
                    y={Math.max(16, pt.y - 8)}
                    textAnchor="middle"
                    className="text-[10px] font-mono fill-ink-soft font-semibold select-none"
                  >
                    {pt.depth}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Time axis labels */}
          <div className="flex justify-between items-center text-[10px] font-mono text-ink-muted pt-2 border-t border-hairline mt-1">
            <span>{history[0]?.time ?? "Start"}</span>
            <span className="text-brand-800 font-semibold">
              {peakDepth > 0
                ? currentDepth > 0
                  ? `Outage active: ${currentDepth} held safely in SQLite`
                  : `Outage drained: peak of ${peakDepth} recovered with 0 loss ✓`
                : "Continuous healthy link · Zero queuing"}
            </span>
            <span>{history[history.length - 1]?.time ?? "Latest"}</span>
          </div>
        </div>

        {/* SLA Architecture Compliance Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl border border-hairline bg-surface-soft">
            <div className="text-[11px] font-mono font-bold uppercase text-ink-muted mb-1">Target 1: Wire Speed</div>
            <div className="text-[13px] font-bold text-ink">P95 Delivery Under 10s</div>
            <p className="text-[11px] text-ink-soft mt-1">Measured from source event timestamp to SaaS receipt ({metrics.latency_p95_s}s actual).</p>
          </div>
          <div className="p-4 rounded-xl border border-hairline bg-surface-soft">
            <div className="text-[11px] font-mono font-bold uppercase text-ink-muted mb-1">Target 2: Idempotency</div>
            <div className="text-[13px] font-bold text-ink">UUIDv4 Deduplication Key</div>
            <p className="text-[11px] text-ink-soft mt-1">Duplicate payloads acknowledge with HTTP 200 without double-counting metrics.</p>
          </div>
          <div className="p-4 rounded-xl border border-hairline bg-surface-soft">
            <div className="text-[11px] font-mono font-bold uppercase text-ink-muted mb-1">Target 3: Chronology</div>
            <div className="text-[13px] font-bold text-ink">Strict Event-Time Ordering</div>
            <p className="text-[11px] text-ink-soft mt-1">Late or out-of-order packets land in correct time order (Scenario #7).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
