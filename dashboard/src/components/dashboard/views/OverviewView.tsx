"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Plus,
  Upload,
  ArrowUpRight,
  ShieldCheck,
  Server,
  Activity,
  CalendarDays,
  Play,
  Pause,
  Square,
  Workflow,
  Eye,
  Video,
} from "lucide-react";
import {
  MonitoredSource,
  CollectorNode,
  Incident,
  Recommendation,
  DashboardTab,
  HealthState,
} from "@/types";

interface OverviewViewProps {
  sources: MonitoredSource[];
  collectors: CollectorNode[];
  incidents: Incident[];
  recommendations: Recommendation[];
  onSelectTab: (tab: DashboardTab, entityId?: string) => void;
  onSelectSource: (source: MonitoredSource) => void;
}

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

const stateChip: Record<HealthState, string> = {
  excellent: "bg-brand-chip text-brand-800 border border-[#d5e6b4]",
  good: "bg-brand-chip text-brand-800 border border-[#d5e6b4]",
  fair: "bg-warn-50 text-warn-700 border border-warn-100",
  poor: "bg-danger-50 text-danger-700 border border-danger-100",
};

/** KPI cards — large numeric displays, pill arrow button top-right, small delta chip + caption underneath. */
function KpiCard({
  label,
  value,
  deltaValue,
  caption,
  highlight,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  deltaValue: number;
  caption: string;
  highlight?: "amber" | "rose";
  onClick?: () => void;
}) {
  const skin =
    highlight === "rose"
      ? "bg-danger-50/50 border border-danger-100"
      : highlight === "amber"
      ? "bg-warn-50/60 border border-warn-100"
      : "bg-surface";
  return (
    <button
      onClick={onClick}
      className={`group text-left card card-hover ${skin} p-6 flex flex-col justify-between min-h-[200px]`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-semibold text-ink">{label}</div>
        <span className="h-9 w-9 rounded-full border border-hairline flex items-center justify-center text-ink-soft group-hover:text-brand-800 group-hover:border-brand-300 transition">
          <ArrowUpRight className="w-[18px] h-[18px] icon-sharp" />
        </span>
      </div>
      <div>
        <div className="text-[56px] font-bold tracking-[-0.04em] text-ink leading-none">{value}</div>
        <div className="mt-4 flex items-center gap-2">
          <span className="chip">
            <ArrowUpRight className="w-3 h-3" />
            {deltaValue}
          </span>
          <span className="text-[12px] text-ink-muted">{caption}</span>
        </div>
      </div>
    </button>
  );
}

/** Hatched pill bar used by the telemetry trend chart, matching the reference. */
function HatchBar({
  height,
  highlight,
  peak,
  label,
}: {
  height: number;
  highlight: boolean;
  peak: boolean;
  label: string;
}) {
  const h = Math.max(24, Math.round(height));
  return (
    <div className="flex-1 flex flex-col items-center justify-end gap-3 h-full">
      {peak && (
        <div className="relative mb-1">
          <div className="text-[11px] font-semibold text-brand-800 bg-white px-2 py-1 rounded-lg border border-brand-100 shadow-sm">
            {label}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 h-2 w-2 rotate-45 bg-white border-r border-b border-brand-100" />
        </div>
      )}
      <div
        aria-hidden
        className={`w-full rounded-full ${
          highlight
            ? "bg-brand-500"
            : peak
            ? "bg-brand-700"
            : "hatch-tight bg-transparent border border-hairline-strong"
        }`}
        style={{ height: `${h}px` }}
      />
    </div>
  );
}

/** Semicircular gauge — progress indicator for the completed share. */
function Semicircle({
  completed,
  inProgress,
  pending,
}: {
  completed: number;
  inProgress: number;
  pending: number;
}) {
  const total = Math.max(1, completed + inProgress + pending);
  const pctCompleted = completed / total;
  const R = 95;
  const CX = 115;
  const CY = 115;
  const stroke = 24;
  const half = Math.PI * R;
  const completedLen = half * pctCompleted;
  const inProgressLen = half * (inProgress / total);
  return (
    <div className="relative w-[230px] h-[135px] mx-auto">
      <svg width="230" height="135" viewBox="0 0 230 135">
        <defs>
          <pattern id="hatchPending" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#b8c0b0" strokeWidth="2" />
          </pattern>
        </defs>
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="url(#hatchPending)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {inProgress > 0 && (
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke="var(--color-brand-800)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${completedLen + inProgressLen} ${half}`}
          />
        )}
        {completed > 0 && (
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${completedLen} ${half}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <div className="text-[44px] font-bold text-ink leading-none tracking-tight">
          {Math.round(pctCompleted * 100)}%
        </div>
        <div className="text-[11px] text-ink-muted mt-1.5">Excellent share</div>
      </div>
    </div>
  );
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

const serviceInitial = (s: MonitoredSource) => {
  const [first, ...rest] = s.service.replace(/-/g, " ").split(" ");
  return (first[0]?.toUpperCase() ?? "S") + (rest[0]?.[0]?.toUpperCase() ?? "V");
};

export default function OverviewView({
  sources,
  collectors,
  incidents,
  recommendations,
  onSelectTab,
  onSelectSource,
}: OverviewViewProps) {
  // Live tracker
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const startRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Counts
  const totalSources = sources.length;
  const onlineCollectors = collectors.filter((c) => c.status === "online").length;
  const offlineCollectors = collectors.filter((c) => c.status === "offline").length;
  const completedSources = sources.filter((s) => s.state === "excellent").length;
  const fairSources = sources.filter((s) => s.state === "fair").length;
  const poorSources = sources.filter((s) => s.state === "poor").length;
  const activeIncidents = incidents.filter((i) => i.status !== "resolved").length;
  const resolvedIncidents = incidents.length - activeIncidents;
  const pendingReview = recommendations.filter((r) => r.status === "proposed").length;

  // Telemetry trend across 7 buckets (week visual)
  const points = sources.flatMap((s) => s.history ?? []);
  const sampleSize = Math.max(1, Math.ceil(points.length / 7));
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const slice = points.slice(i * sampleSize, (i + 1) * sampleSize);
    const vals = slice.map((p) => p.cpu).filter((n) => typeof n === "number" && n > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  const bucketMax = Math.max(1, ...buckets);
  const peakIdx = buckets.reduce((best, v, i, a) => (v > a[best] ? i : best), 0);
  const peakPct = Math.round(buckets[peakIdx]);

  // Nearest incident reminder
  const nextIncident = incidents.find((i) => i.status !== "resolved") ?? incidents[0];
  const nextIncidentTime = nextIncident
    ? new Date(nextIncident.started_utc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  // Top sources list
  const topSources = [...sources]
    .sort((a, b) => (b.active_alerts_count ?? 0) - (a.active_alerts_count ?? 0))
    .slice(0, 4);

  return (
    <div className="space-y-5">
      {/* Page title row */}
      <div className="flex flex-wrap items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-[48px] leading-[1.02] font-bold tracking-[-0.035em] text-ink">
            Dashboard
          </h1>
          <p className="text-[15px] text-ink-soft mt-3 max-w-xl">
            Monitor telemetry, inspect incidents, and accomplish approvals — privacy enforced by design.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onSelectTab("incidents")} className="btn-pill-primary">
            <Plus className="w-[18px] h-[18px] icon-sharp" />
            Open review
          </button>
          <button onClick={() => onSelectTab("reports")} className="btn-pill">
            <Upload className="w-[18px] h-[18px] icon-sharp" />
            Export data
          </button>
        </div>
      </div>

      {/* KPI row: 1 hero (dark forest) + 3 white cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Hero: Total sources */}
        <button
          onClick={() => onSelectTab("sources")}
          className="relative overflow-hidden text-left card card-hover p-6 min-h-[200px] flex flex-col justify-between text-white"
          style={{
            background:
              "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 55%, #062715 100%)",
            boxShadow: "var(--shadow-hero)",
          }}
        >
          <div className="ring-deco -right-8 -top-8 h-36 w-36" />
          <div className="ring-deco -right-20 -bottom-20 h-60 w-60" />
          <div className="relative flex items-center justify-between">
            <div className="text-[14px] font-semibold text-white">Total sources</div>
            <span className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <ArrowUpRight className="w-[18px] h-[18px] icon-sharp" />
            </span>
          </div>
          <div className="relative">
            <div
              className="text-[56px] font-bold tracking-[-0.04em] leading-none"
              style={{ color: "var(--color-brand-mint)" }}
            >
              {totalSources}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-mint/20 border border-brand-mint/30 text-brand-mint text-[11px] font-semibold">
                <ArrowUpRight className="w-3 h-3" />
                {completedSources}
              </span>
              <span className="text-[12px] text-white/75">Excellent this window</span>
            </div>
          </div>
        </button>

        <KpiCard
          label="Resolved incidents"
          value={resolvedIncidents}
          deltaValue={resolvedIncidents}
          caption="Closed since window start"
          onClick={() => onSelectTab("incidents")}
        />
        <KpiCard
          label="Open incidents"
          value={activeIncidents}
          deltaValue={fairSources + poorSources}
          caption="Sources in fair / poor"
          highlight={activeIncidents > 0 ? "amber" : undefined}
          onClick={() => onSelectTab("incidents")}
        />
        <KpiCard
          label="Pending review"
          value={pendingReview}
          deltaValue={recommendations.length}
          caption="Recommendations total"
          highlight={pendingReview > 0 ? "rose" : undefined}
          onClick={() => onSelectTab("ai_insights")}
        />
      </div>

      {/* Middle row: telemetry trend · next review · sources side list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Telemetry trend */}
        <div className="lg:col-span-6 card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-ink">Telemetry analytics</h2>
              <p className="text-[12.5px] text-ink-muted mt-1">
                Average CPU across monitored sources, by day of week
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Peak</div>
              <div className="text-[16px] font-bold text-ink">{peakPct}%</div>
            </div>
          </div>
          <div className="mt-8 h-48 flex items-end gap-6 px-1">
            {buckets.map((v, i) => (
              <HatchBar
                key={i}
                height={(v / Math.max(1, bucketMax)) * 160}
                highlight={i === peakIdx - 1}
                peak={i === peakIdx}
                label={`${peakPct}%`}
              />
            ))}
          </div>
          <div className="mt-3 flex items-end gap-6 px-1">
            {WEEK.map((d, i) => (
              <div
                key={i}
                className={`flex-1 text-center text-[12px] font-medium ${
                  i === peakIdx ? "text-ink" : "text-ink-muted"
                }`}
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Next review */}
        <div className="lg:col-span-3 card p-6 flex flex-col">
          <h3 className="text-[14px] font-semibold text-ink">Next review</h3>
          <div className="mt-5 flex-1">
            <div className="text-[22px] font-bold text-ink leading-tight tracking-tight">
              {nextIncident ? nextIncident.title : "No open incidents"}
            </div>
            <div className="mt-3 text-[12px] text-ink-muted flex items-center gap-2" suppressHydrationWarning>
              <CalendarDays className="w-[14px] h-[14px] icon-sharp" />
              {nextIncidentTime ? `Started ${nextIncidentTime} UTC` : "Normal operations"}
            </div>
          </div>
          <button onClick={() => onSelectTab("incidents")} className="btn-pill-primary mt-6 w-full justify-center">
            <Video className="w-[18px] h-[18px] icon-sharp" />
            Open review
          </button>
        </div>

        {/* Sources side list */}
        <div className="lg:col-span-3 card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink">Sources</h3>
            <button
              onClick={() => onSelectTab("sources")}
              className="text-[11px] font-semibold text-brand-800 inline-flex items-center gap-1 rounded-full border border-brand-200 px-2.5 py-1 hover:bg-brand-50 transition"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          </div>
          <ul className="mt-5 space-y-4">
            {sources.slice(0, 4).map((s) => (
              <li key={s.source_id}>
                <button onClick={() => onSelectSource(s)} className="w-full flex items-center gap-3 text-left group">
                  <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-[10px] font-bold text-brand-mint shrink-0">
                    {serviceInitial(s)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ink truncate group-hover:text-brand-800">
                      {s.service}
                    </div>
                    <div className="text-[11px] text-ink-muted" suppressHydrationWarning>
                      Due{" "}
                      {new Date(s.last_seen_utc).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom row: signal collaboration · gauge · ingest tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Signal collaboration */}
        <div className="lg:col-span-5 card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-ink">Signal collaboration</h3>
            <button
              onClick={() => onSelectTab("sources")}
              className="text-[11.5px] font-semibold text-brand-800 inline-flex items-center gap-1.5 rounded-full border border-brand-200 px-3 py-1.5 hover:bg-brand-50 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add view
            </button>
          </div>
          <ul className="mt-6 space-y-5">
            {topSources.length === 0 ? (
              <li className="text-xs text-ink-muted text-center py-8">No sources yet.</li>
            ) : (
              topSources.map((s) => (
                <li key={s.source_id} className="flex items-center gap-3.5">
                  <span className="h-11 w-11 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-[12px] font-bold text-brand-mint shrink-0">
                    {serviceInitial(s)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-ink truncate">{s.service}</div>
                    <div className="text-[12px] text-ink-muted truncate">
                      Working on{" "}
                      <span className="font-semibold text-ink">{s.source_type}</span> telemetry · {s.region}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${stateChip[s.state]}`}>
                    {s.state === "excellent" ? "Completed" : s.state === "good" ? "In progress" : s.state === "fair" ? "Pending" : "Critical"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Gauge */}
        <div className="lg:col-span-4 card p-6">
          <h3 className="text-[16px] font-bold text-ink">Health distribution</h3>
          <div className="mt-2">
            <Semicircle
              completed={completedSources}
              inProgress={sources.filter((s) => s.state === "good").length}
              pending={fairSources + poorSources}
            />
          </div>
          <div className="mt-5 flex items-center justify-around text-[12px] font-medium text-ink-soft">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
              Completed
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-800" />
              In progress
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full hatch-tight bg-transparent border border-hairline-strong" />
              Pending
            </div>
          </div>
        </div>

        {/* Ingest tracker */}
        <div
          className="lg:col-span-3 card p-6 relative overflow-hidden text-white"
          style={{
            background:
              "radial-gradient(130% 110% at 20% 15%, #176534 0%, #0a3a1e 55%, #062715 100%)",
            boxShadow: "var(--shadow-hero)",
          }}
        >
          <div className="ring-deco -right-14 -top-10 h-44 w-44" />
          <div className="ring-deco -right-24 -bottom-16 h-56 w-56" />
          <h3 className="relative text-[14px] font-semibold text-white">Ingest tracker</h3>
          <div className="relative text-[48px] font-bold tracking-[-0.03em] leading-none mt-8" style={{ color: "var(--color-brand-mint)" }}>
            {fmtDuration(elapsed)}
          </div>
          <div className="relative text-[11px] text-white/70 mt-2">
            Live window · {onlineCollectors}/{onlineCollectors + offlineCollectors} online
          </div>
          <div className="relative mt-6 flex items-center gap-3">
            <button
              onClick={() => setRunning((v) => !v)}
              className="h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition backdrop-blur-sm"
              aria-label={running ? "Pause tracker" : "Resume tracker"}
            >
              {running ? <Pause className="w-4 h-4 text-brand-mint" /> : <Play className="w-4 h-4 text-brand-mint" />}
            </button>
            <button
              onClick={() => {
                setRunning(false);
                setElapsed(0);
                startRef.current = Date.now();
              }}
              className="h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition backdrop-blur-sm"
              aria-label="Reset tracker"
            >
              <Square className="w-4 h-4 text-brand-mint" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick links row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <button
          onClick={() => onSelectTab("egress")}
          className="card card-hover p-5 flex items-center gap-4 text-left"
        >
          <span className="h-11 w-11 rounded-full bg-brand-chip border border-[#d5e6b4] flex items-center justify-center text-brand-800 shrink-0">
            <ShieldCheck className="w-5 h-5 icon-sharp" />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink">Egress proof</div>
            <div className="text-[11.5px] text-ink-muted truncate">Byte-for-byte audit</div>
          </div>
        </button>
        <button
          onClick={() => onSelectTab("privacy")}
          className="card card-hover p-5 flex items-center gap-4 text-left"
        >
          <span className="h-11 w-11 rounded-full bg-brand-chip border border-[#d5e6b4] flex items-center justify-center text-brand-800 shrink-0">
            <Eye className="w-5 h-5 icon-sharp" />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink">Privacy</div>
            <div className="text-[11.5px] text-ink-muted truncate">Raw vs SaaS</div>
          </div>
        </button>
        <button
          onClick={() => onSelectTab("reliability")}
          className="card card-hover p-5 flex items-center gap-4 text-left"
        >
          <span className="h-11 w-11 rounded-full bg-brand-chip border border-[#d5e6b4] flex items-center justify-center text-brand-800 shrink-0">
            <Activity className="w-5 h-5 icon-sharp" />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink">Reliability</div>
            <div className="text-[11.5px] text-ink-muted truncate">p95 · duplicates</div>
          </div>
        </button>
        <button
          onClick={() => onSelectTab("ai_insights")}
          className="card card-hover p-5 flex items-center gap-4 text-left"
        >
          <span className="h-11 w-11 rounded-full bg-brand-chip border border-[#d5e6b4] flex items-center justify-center text-brand-800 shrink-0">
            <Workflow className="w-5 h-5 icon-sharp" />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink">AI insights</div>
            <div className="text-[11.5px] text-ink-muted truncate">Explainable recs</div>
          </div>
        </button>
      </div>
    </div>
  );
}
