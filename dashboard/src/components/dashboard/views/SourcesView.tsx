"use client";

import React, { useMemo, useState } from "react";
import {
  Server,
  Wifi,
  ShieldAlert,
  Layers,
  Cpu,
  MemoryStick,
  Timer,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  CircleSlash,
} from "lucide-react";
import { MonitoredSource, HealthState, SourceType } from "@/types";

interface SourcesViewProps {
  sources: MonitoredSource[];
  onSelectSource: (source: MonitoredSource) => void;
}

/** Big icon per source type — the primary visual cue. */
const typeIcon: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  server: Server,
  network: Wifi,
  security: ShieldAlert,
  app: Layers,
};

/** State → ring color + status word + icon */
const stateMeta: Record<HealthState, { ring: string; chip: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  excellent: { ring: "var(--color-brand-500)", chip: "bg-brand-chip text-brand-800 border border-[#d5e6b4]", label: "Healthy", Icon: CheckCircle2 },
  good:      { ring: "var(--color-brand-700)", chip: "bg-brand-chip text-brand-800 border border-[#d5e6b4]", label: "Normal",  Icon: CheckCircle2 },
  fair:      { ring: "#d97706",               chip: "bg-warn-50 text-warn-700 border border-warn-100",    label: "Watch",   Icon: AlertTriangle },
  poor:      { ring: "#dc2626",               chip: "bg-danger-50 text-danger-700 border border-danger-100", label: "Critical", Icon: AlertOctagon },
};

/** Big ring showing the source's state as a circular gauge (single visual cue, no text until needed). */
function HealthRing({ state, value, unit }: { state: HealthState; value: number; unit: string }) {
  const R = 36;
  const C = 2 * Math.PI * R;
  const pct = Math.min(100, Math.max(5, value));
  const meta = stateMeta[state];
  return (
    <div className="relative h-24 w-24">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={R} stroke="#eef0ea" strokeWidth="8" fill="none" />
        <circle
          cx="48" cy="48" r={R}
          stroke={meta.ring}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * C} ${C}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[18px] font-bold text-ink leading-none tracking-tight">{Math.round(value)}</div>
        <div className="text-[10px] text-ink-muted mt-0.5 font-mono">{unit}</div>
      </div>
    </div>
  );
}

/** A single mini-stat with icon */
function MiniStat({ Icon, value, unit }: { Icon: React.ComponentType<{ className?: string }>; value: number | undefined; unit: string }) {
  if (value === undefined || value === null) {
    return (
      <div className="flex items-center gap-1.5 text-ink-muted/60">
        <Icon className="w-3.5 h-3.5 icon-sharp" />
        <span className="text-[11px] font-mono">—</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-ink-soft">
      <Icon className="w-3.5 h-3.5 icon-sharp" />
      <span className="text-[12px] font-semibold text-ink">
        {Math.round(value * 10) / 10}
        <span className="text-ink-muted font-normal text-[10px] ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

export default function SourcesView({ sources, onSelectSource }: SourcesViewProps) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | HealthState | "alerts">("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return sources.filter((s) => {
      if (query && !s.service.toLowerCase().includes(query) && !s.source_id.toLowerCase().includes(query)) return false;
      if (filter === "all") return true;
      if (filter === "alerts") return (s.active_alerts_count ?? 0) > 0;
      return s.state === filter;
    });
  }, [sources, q, filter]);

  const counts = {
    all: sources.length,
    excellent: sources.filter((s) => s.state === "excellent").length,
    fair: sources.filter((s) => s.state === "fair").length,
    poor: sources.filter((s) => s.state === "poor").length,
    alerts: sources.filter((s) => (s.active_alerts_count ?? 0) > 0).length,
  };

  const chipFilter = (key: typeof filter, count: number, label: string, tone?: "amber" | "rose") => {
    const base =
      filter === key
        ? "bg-brand-800 text-white border-brand-800"
        : tone === "amber"
        ? "bg-warn-50 text-warn-700 border-warn-100 hover:border-warn-700"
        : tone === "rose"
        ? "bg-danger-50 text-danger-700 border-danger-100 hover:border-danger-700"
        : "bg-white text-ink-soft border-hairline hover:border-brand-200 hover:text-ink";
    return (
      <button
        key={key}
        onClick={() => setFilter(key)}
        className={`inline-flex items-center gap-2 h-10 px-4 rounded-full border text-[13px] font-semibold transition ${base}`}
      >
        {label}
        <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md ${filter === key ? "bg-brand-mint text-brand-900" : "bg-canvas-deep/60 text-ink-muted"}`}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-ink">Sources</h1>
          <p className="text-[14px] text-ink-soft mt-2">What your collectors are watching.</p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 h-12 px-4 rounded-full bg-white border border-hairline w-full sm:w-80">
          <Search className="w-4 h-4 icon-sharp text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a service…"
            className="flex-1 bg-transparent focus:outline-none text-[13.5px] placeholder:text-ink-muted"
          />
        </div>
      </div>

      {/* Filter pills — visual, with counts */}
      <div className="flex flex-wrap gap-2.5">
        {chipFilter("all", counts.all, "All")}
        {chipFilter("excellent", counts.excellent, "Healthy")}
        {chipFilter("fair", counts.fair, "Watch", "amber")}
        {chipFilter("poor", counts.poor, "Critical", "rose")}
        {chipFilter("alerts", counts.alerts, "Alerting", "rose")}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-ink-muted">
          <CircleSlash className="w-10 h-10 icon-sharp" />
          <div className="text-[14px]">No sources match that filter.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((s) => {
            const TypeIcon = typeIcon[s.source_type] ?? Layers;
            const meta = stateMeta[s.state];
            const StateIcon = meta.Icon;
            const cpu = s.metrics?.cpu_pct as number | undefined;
            const mem = s.metrics?.mem_pct as number | undefined;
            const lat = s.metrics?.latency_ms as number | undefined;
            // Primary gauge value — pick the worst-looking metric or default to CPU
            const primary = Math.max(cpu ?? 0, mem ?? 0);
            const primaryUnit = "%";
            const alerts = s.active_alerts_count ?? 0;

            return (
              <button
                key={s.source_id}
                onClick={() => onSelectSource(s)}
                className="card card-hover p-6 text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Type icon + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #176534 0%, #0a3a1e 100%)" }}
                    >
                      <TypeIcon className="w-5 h-5 text-brand-mint icon-sharp" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[16px] font-bold text-ink truncate">{s.service}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5 font-mono truncate">{s.source_id}</div>
                    </div>
                  </div>
                  {/* Status chip */}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${meta.chip}`}>
                    <StateIcon className="w-3.5 h-3.5 icon-sharp" />
                    {meta.label}
                  </span>
                </div>

                {/* Big ring + quick stats */}
                <div className="mt-5 flex items-center gap-5">
                  <HealthRing state={s.state} value={primary} unit={primaryUnit} />
                  <div className="flex-1 space-y-3">
                    <MiniStat Icon={Cpu} value={cpu} unit="%" />
                    <MiniStat Icon={MemoryStick} value={mem} unit="%" />
                    <MiniStat Icon={Timer} value={lat} unit="ms" />
                  </div>
                </div>

                {/* Footer: alerts dot + region */}
                <div className="mt-5 pt-4 border-t border-hairline flex items-center justify-between text-[11.5px]">
                  <div className="flex items-center gap-2">
                    {alerts > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-danger-700 font-semibold">
                        <span className="h-2 w-2 rounded-full bg-danger-700 animate-pulse" />
                        {alerts} alert{alerts === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-brand-800">
                        <span className="h-2 w-2 rounded-full bg-brand-500" />
                        Nominal
                      </span>
                    )}
                  </div>
                  <span className="text-ink-muted font-mono">{s.region}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
