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
  Sparkles,
  Workflow,
  Eye,
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
  excellent: "bg-brand-50 text-brand-800 border border-brand-100",
  good: "bg-brand-50 text-brand-800 border border-brand-100",
  fair: "bg-amber-50 text-amber-800 border border-amber-100",
  poor: "bg-rose-50 text-rose-800 border border-rose-100",
};

function KpiCard({
  label,
  value,
  caption,
  variant = "white",
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  caption: React.ReactNode;
  variant?: "white" | "amber" | "rose";
  onClick?: () => void;
}) {
  const skin =
    variant === "rose"
      ? "bg-rose-50/60 border-rose-100"
      : variant === "amber"
      ? "bg-amber-50/70 border-amber-100"
      : "bg-surface border-hairline/0";
  return (
    <button
      onClick={onClick}
      className={`group text-left card border ${skin} p-5 flex flex-col justify-between min-h-[180px] hover:shadow-cardLg transition`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        <span className="h-8 w-8 rounded-full border border-hairline flex items-center justify-center text-ink-soft group-hover:text-brand-700 group-hover:border-brand-200 transition">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </div>
      <div>
        <div className="text-5xl font-bold tracking-tight text-ink">{value}</div>
        <div className="mt-3 text-[11px] text-ink-soft flex items-center gap-2">
          {caption}
        </div>
      </div>
    </button>
  );
}

function BadgeDelta({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-hairline text-[10px] font-semibold text-ink-soft bg-canvas/60">
      {children}
    </span>
  );
}

/** Hatched pill bar used by the telemetry trend chart, matching the reference. */
function HatchBar({ height, highlight, peak, label }: { height: number; highlight: boolean; peak: boolean; label: string }) {
  const h = Math.max(14, Math.round(height));
  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      {peak && (
        <div className="relative -mb-1">
          <div className="text-[10px] font-semibold text-brand-800 bg-surface px-1.5 py-0.5 rounded-md border border-brand-100 shadow-sm">
            {label}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 h-1.5 w-1.5 rotate-45 bg-surface border-r border-b border-brand-100" />
        </div>
      )}
      <div
        aria-hidden
        className={`w-full rounded-full ${highlight ? "bg-brand-500" : peak ? "bg-brand-700" : "hatch bg-transparent border border-hairline"}`}
        style={{ height: `${h}px` }}
      />
    </div>
  );
}

/** Semicircular gauge — progress indicator for the completed share. */
function Semicircle({ completed, inProgress, pending }: { completed: number; inProgress: number; pending: number }) {
  const total = Math.max(1, completed + inProgress + pending);
  const pctCompleted = completed / total;
  // Semicircle geometry
  const R = 90;
  const CX = 110;
  const CY = 110;
  const stroke = 22;
  const half = Math.PI * R;
  const completedLen = half * pctCompleted;
  const inProgressLen = half * (inProgress / total);
  return (
    <div className="relative w-[220px] h-[130px] mx-auto">
      <svg width="220" height="130" viewBox="0 0 220 130">
        <defs>
          <pattern id="hatchPending" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="#b8c0b0" strokeWidth="2" />
          </pattern>
        </defs>
        {/* pending arc (hatched) */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="url(#hatchPending)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* in-progress arc (dark green) */}
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
        {/* completed arc (brand green) */}
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
        <div className="text-4xl font-bold text-ink leading-none">{Math.round(pctCompleted * 100)}%</div>
        <div className="text-[11px] text-ink-soft mt-1">Excellent share</div>
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

export default function OverviewView({
  sources,
  collectors,
  incidents,
  recommendations,
  onSelectTab,
  onSelectSource,
}: OverviewViewProps) {
  // Live tracker: a stopwatch that only ticks when there is an open incident.
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const startRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);

  // KPI counts
  const totalSources = sources.length;
  const onlineCollectors = collectors.filter((c) => c.status === "online").length;
  const offlineCollectors = collectors.filter((c) => c.status === "offline").length;
  const completedSources = sources.filter((s) => s.state === "excellent").length;
  const fairSources = sources.filter((s) => s.state === "fair").length;
  const poorSources = sources.filter((s) => s.state === "poor").length;
  const activeIncidents = incidents.filter((i) => i.status !== "resolved").length;
  const pendingReview = recommendations.filter((r) => r.status === "proposed").length;

  // Telemetry trend: group all sources' history into 7 buckets ("week" visual)
  const points = sources.flatMap((s) => s.history ?? []);
  const sampleSize = Math.max(1, Math.ceil(points.length / 7));
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const slice = points.slice(i * sampleSize, (i + 1) * sampleSize);
    const vals = slice.map((p) => p.cpu).filter((n) => typeof n === "number" && n > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  const bucketMax = Math.max(1, ...buckets);
  const peakIdx = buckets.reduce((best, v, i, a) => (v > a[best] ? i : best), 0);
  const peakPct = Math.round((buckets[peakIdx] / Math.max(1, bucketMax)) * 100);

  // Nearest incident (used as a "reminder")
  const nextIncident = incidents.find((i) => i.status !== "resolved") ?? incidents[0];
  const nextIncidentTime = nextIncident
    ? new Date(nextIncident.started_utc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  // Top sources list (team collaboration style)
  const topSources = [...sources]
    .sort((a, b) => (b.active_alerts_count ?? 0) - (a.active_alerts_count ?? 0))
    .slice(0, 4);

  const label = (s: MonitoredSource) => {
    const [first, ...rest] = s.service.replace(/-/g, " ").split(" ");
    return (first[0]?.toUpperCase() ?? "S") + (rest[0]?.[0]?.toUpperCase() ?? "V");
  };

  return (
    <div className="space-y-6">
      {/* Page title row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[40px] leading-[1.05] font-bold tracking-tight text-ink">
            Dashboard
          </h1>
          <p className="text-sm text-ink-soft mt-2 max-w-xl">
            Monitor telemetry, inspect incidents and accomplish approvals — privacy enforced by design.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab("incidents")}
            className="btn-pill-primary"
          >
            <Plus className="w-4 h-4" />
            New review
          </button>
          <button
            onClick={() => onSelectTab("reports")}
            className="btn-pill"
          >
            <Upload className="w-4 h-4" />
            Export data
          </button>
        </div>
      </div>

      {/* KPI row: 1 hero (dark green) + 3 white cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hero: Total sources */}
        <button
          onClick={() => onSelectTab("sources")}
          className="relative overflow-hidden text-left card border border-brand-900/40 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 text-white p-5 min-h-[200px] flex flex-col justify-between hover:shadow-cardLg transition"
        >
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-36 w-36 rounded-full border border-white/15"
          />
          <div
            aria-hidden
            className="absolute -right-16 -bottom-14 h-48 w-48 rounded-full border border-white/10"
          />
          <div className="relative flex items-center justify-between">
            <div className="text-[13px] font-semibold">Total sources</div>
            <span className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="relative">
            <div className="text-5xl font-bold tracking-tight text-brand-mint">
              {totalSources}
            </div>
            <div className="mt-3 text-[11px] text-white/85 flex items-center gap-2">
              <BadgeDelta>
                <ArrowUpRight className="w-3 h-3" />
                {completedSources}
              </BadgeDelta>
              Excellent this window
            </div>
          </div>
        </button>

        <KpiCard
          label="Resolved incidents"
          value={incidents.length - activeIncidents}
          caption={
            <>
              <BadgeDelta>
                <ArrowUpRight className="w-3 h-3" />
                {Math.max(0, incidents.length - activeIncidents)}
              </BadgeDelta>
              Closed since window start
            </>
          }
          onClick={() => onSelectTab("incidents")}
        />
        <KpiCard
          label="Open incidents"
          value={activeIncidents}
          caption={
            <>
              <BadgeDelta>
                <ArrowUpRight className="w-3 h-3" />
                {fairSources + poorSources}
              </BadgeDelta>
              Sources in fair / poor
            </>
          }
          onClick={() => onSelectTab("incidents")}
          variant={activeIncidents > 0 ? "amber" : "white"}
        />
        <KpiCard
          label="Pending review"
          value={pendingReview}
          caption={
            <>
              <BadgeDelta>
                <ArrowUpRight className="w-3 h-3" />
                {recommendations.length}
              </BadgeDelta>
              Recommendations total
            </>
          }
          onClick={() => onSelectTab("ai_insights")}
          variant={pendingReview > 0 ? "rose" : "white"}
        />
      </div>

      {/* Middle row: telemetry trend · next review · side list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Telemetry trend (hatched pill bars, week axis) */}
        <div className="lg:col-span-6 card p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Telemetry analytics</h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Average CPU across monitored sources, by day of week
              </p>
            </div>
            <div className="text-[11px] text-ink-soft">
              Peak <span className="font-semibold text-ink">{Math.round(buckets[peakIdx])}%</span>
            </div>
          </div>
          <div className="mt-6 h-44 flex items-end gap-5 px-1 pt-6">
            {buckets.map((v, i) => (
              <HatchBar
                key={i}
                height={(v / Math.max(1, bucketMax)) * 140}
                highlight={i === peakIdx - 1}
                peak={i === peakIdx}
                label={`${peakPct}%`}
              />
            ))}
          </div>
          <div className="mt-2 flex items-end gap-5 px-1">
            {WEEK.map((d, i) => (
              <div key={i} className="flex-1 text-center text-[11px] text-ink-soft">
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Next review (reminder) */}
        <div className="lg:col-span-3 card p-5 flex flex-col">
          <h3 className="text-[13px] font-semibold text-ink">Next review</h3>
          <div className="mt-4">
            <div className="text-xl font-semibold text-ink leading-tight">
              {nextIncident ? nextIncident.title : "No open incidents"}
            </div>
            <div className="mt-2 text-xs text-ink-soft flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5" />
              {nextIncidentTime ? `Started ${nextIncidentTime} UTC` : "Normal operations"}
            </div>
          </div>
          <button
            onClick={() => onSelectTab("incidents")}
            className="btn-pill-primary mt-auto"
          >
            <ShieldCheck className="w-4 h-4" />
            Open review
          </button>
        </div>

        {/* Right stack: project-style list of key sources */}
        <div className="lg:col-span-3 card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-ink">Sources</h3>
            <button
              onClick={() => onSelectTab("sources")}
              className="text-[11px] font-semibold text-brand-800 inline-flex items-center gap-1 rounded-full border border-brand-100 px-2 py-1 hover:bg-brand-50"
            >
              <Plus className="w-3 h-3" />
              View all
            </button>
          </div>
          <ul className="mt-4 space-y-3.5">
            {sources.slice(0, 4).map((s) => (
              <li key={s.source_id}>
                <button
                  onClick={() => onSelectSource(s)}
                  className="w-full flex items-center gap-3 text-left group"
                >
                  <span className="h-7 w-7 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-[10px] font-semibold text-brand-800">
                    {label(s)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink truncate group-hover:text-brand-800">
                      {s.service}
                    </div>
                    <div className="text-[11px] text-ink-soft">
                      {s.region} · last seen{" "}
                      {new Date(s.last_seen_utc).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stateChip[s.state]}`}>
                    {s.state}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom row: team collaboration list · incident status gauge · ingest tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Team Collaboration style: top sources with status badges */}
        <div className="lg:col-span-5 card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-ink">Signal collaboration</h3>
            <button
              onClick={() => onSelectTab("sources")}
              className="text-[11px] font-semibold text-brand-800 inline-flex items-center gap-1 rounded-full border border-brand-100 px-2 py-1 hover:bg-brand-50"
            >
              <Plus className="w-3 h-3" />
              Add view
            </button>
          </div>
          <ul className="mt-5 space-y-5">
            {topSources.length === 0 ? (
              <li className="text-xs text-ink-soft text-center py-8">No sources yet.</li>
            ) : (
              topSources.map((s) => (
                <li key={s.source_id} className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-xs font-semibold text-brand-800">
                    {label(s)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">
                      {s.service}
                    </div>
                    <div className="text-[11px] text-ink-soft truncate">
                      Monitoring <span className="font-semibold text-ink">{s.source_type}</span> telemetry · {s.region}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${stateChip[s.state]}`}>
                    {s.state}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Incident status gauge */}
        <div className="lg:col-span-4 card p-5">
          <h3 className="text-[13px] font-semibold text-ink">Health distribution</h3>
          <div className="mt-2">
            <Semicircle
              completed={completedSources}
              inProgress={sources.filter((s) => s.state === "good").length}
              pending={fairSources + poorSources}
            />
          </div>
          <div className="mt-4 flex items-center justify-around text-[11px] font-medium text-ink-soft">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
              Excellent
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-800" />
              Good
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full hatch bg-transparent border border-hairline" />
              Fair / Poor
            </div>
          </div>
        </div>

        {/* Ingest tracker (dark-green card, mimics the Time Tracker tile) */}
        <div className="lg:col-span-3 card p-5 text-white bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -right-14 -top-14 h-48 w-48 rounded-full border border-white/10"
          />
          <div
            aria-hidden
            className="absolute -right-24 -bottom-16 h-56 w-56 rounded-full border border-white/10"
          />
          <h3 className="relative text-[13px] font-semibold">Ingest tracker</h3>
          <div className="relative mt-4 text-[11px] text-white/80">
            Live window since open
          </div>
          <div className="relative text-[52px] font-bold tracking-tight leading-none mt-1">
            {fmtDuration(elapsed)}
          </div>
          <div className="relative mt-5 flex items-center gap-3">
            <button
              onClick={() => setRunning((v) => !v)}
              className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
              aria-label={running ? "Pause tracker" : "Resume tracker"}
            >
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                setRunning(false);
                setElapsed(0);
                startRef.current = Date.now();
              }}
              className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
              aria-label="Reset tracker"
            >
              <Square className="w-4 h-4" />
            </button>
            <div className="ml-auto text-[11px] text-white/80 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              {onlineCollectors}/{onlineCollectors + offlineCollectors} online
            </div>
          </div>
        </div>
      </div>

      {/* Quick links row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => onSelectTab("egress")}
          className="card p-4 flex items-center gap-3 text-left hover:shadow-cardLg transition"
        >
          <span className="h-10 w-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-800">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Egress proof</div>
            <div className="text-[11px] text-ink-soft truncate">Byte-for-byte audit log</div>
          </div>
        </button>
        <button
          onClick={() => onSelectTab("privacy")}
          className="card p-4 flex items-center gap-3 text-left hover:shadow-cardLg transition"
        >
          <span className="h-10 w-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-800">
            <Eye className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Privacy side-by-side</div>
            <div className="text-[11px] text-ink-soft truncate">Raw vs what SaaS stored</div>
          </div>
        </button>
        <button
          onClick={() => onSelectTab("reliability")}
          className="card p-4 flex items-center gap-3 text-left hover:shadow-cardLg transition"
        >
          <span className="h-10 w-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-800">
            <Activity className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Reliability</div>
            <div className="text-[11px] text-ink-soft truncate">p95 ingest · duplicates · gaps</div>
          </div>
        </button>
        <button
          onClick={() => onSelectTab("ai_insights")}
          className="card p-4 flex items-center gap-3 text-left hover:shadow-cardLg transition"
        >
          <span className="h-10 w-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-800">
            <Workflow className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">AI insights</div>
            <div className="text-[11px] text-ink-soft truncate">Explainable recommendations</div>
          </div>
        </button>
      </div>
    </div>
  );
}
