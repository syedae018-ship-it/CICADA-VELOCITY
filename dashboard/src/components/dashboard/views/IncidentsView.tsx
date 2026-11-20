"use client";

import React, { useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  MemoryStick,
  Timer,
  Wifi,
  ShieldAlert,
  Server,
  ChevronDown,
  Play,
  Undo2,
  Activity,
  Sparkles,
  CircleSlash,
  BrainCircuit,
} from "lucide-react";
import { Incident, Alert, Recommendation, AuditLogEntry, TenantId } from "@/types";

interface IncidentsViewProps {
  tenantId: TenantId;
  incidents: Incident[];
  alerts: Alert[];
  recommendations: Recommendation[];
  auditLog: AuditLogEntry[];
  onApprove: (recId: string) => void;
  onRollback: (recId: string) => void;
}

/** Severity → glyph + color */
const severityMeta: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }>; dot: string; chip: string; label: string }
> = {
  critical: { Icon: AlertOctagon, dot: "bg-danger-700", chip: "bg-danger-50 text-danger-700 border border-danger-100", label: "Critical" },
  high:     { Icon: AlertTriangle, dot: "bg-danger-700", chip: "bg-danger-50 text-danger-700 border border-danger-100", label: "High" },
  medium:   { Icon: AlertTriangle, dot: "bg-amber-500",  chip: "bg-warn-50 text-warn-700 border border-warn-100",       label: "Medium" },
  low:      { Icon: AlertTriangle, dot: "bg-amber-400",  chip: "bg-warn-50 text-warn-700 border border-warn-100",       label: "Low" },
};

/** Metric → icon so a single row says "what" visually */
function metricIcon(metric?: string) {
  if (!metric) return Activity;
  if (metric.includes("cpu")) return Cpu;
  if (metric.includes("mem")) return MemoryStick;
  if (metric.includes("latency")) return Timer;
  if (metric.includes("packet") || metric.includes("bandwidth")) return Wifi;
  if (metric.includes("login") || metric.includes("auth")) return ShieldAlert;
  if (metric.includes("heartbeat") || metric.includes("collector")) return Server;
  return Activity;
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function IncidentsView({
  incidents,
  alerts,
  recommendations,
  auditLog,
  onApprove,
  onRollback,
}: IncidentsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    incidents.find((i) => i.status !== "resolved")?.incident_id ?? incidents[0]?.incident_id ?? null,
  );
  const [showReasoning, setShowReasoning] = useState(false);

  // Keep selected valid as data refreshes
  const selected = useMemo(
    () => incidents.find((i) => i.incident_id === selectedId) ?? incidents[0],
    [incidents, selectedId],
  );
  const selectedAlerts = useMemo(
    () => (selected ? alerts.filter((a) => a.incident_id === selected.incident_id) : []),
    [alerts, selected],
  );
  const selectedRecs = useMemo(
    () => (selected ? recommendations.filter((r) => r.incident_id === selected.incident_id) : []),
    [recommendations, selected],
  );

  const open = incidents.filter((i) => i.status !== "resolved").length;
  const critical = incidents.filter((i) => i.severity === "critical").length;

  if (incidents.length === 0) {
    return (
      <div className="space-y-6">
        <HeaderStrip open={0} critical={0} />
        <div className="card p-16 flex flex-col items-center gap-4">
          <span className="h-16 w-16 rounded-full bg-brand-chip border border-[#d5e6b4] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-brand-800 icon-sharp" />
          </span>
          <div className="text-[20px] font-bold text-ink">All clear</div>
          <div className="text-[13px] text-ink-soft">No incidents — telemetry within baseline.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HeaderStrip open={open} critical={critical} />

      {/* Split layout: list left, detail right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Incident list */}
        <div className="lg:col-span-5 space-y-3">
          {incidents.map((inc) => {
            const sev = severityMeta[inc.severity] ?? severityMeta.medium;
            const isSelected = inc.incident_id === selected?.incident_id;
            return (
              <button
                key={inc.incident_id}
                onClick={() => {
                  setSelectedId(inc.incident_id);
                  setShowReasoning(false);
                }}
                className={`card card-hover w-full p-5 text-left border-2 ${
                  isSelected ? "border-brand-800" : "border-transparent"
                }`}
              >
                {/* Row 1: severity chip + time */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${sev.chip}`}>
                    <sev.Icon className="w-3.5 h-3.5 icon-sharp" />
                    {sev.label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted font-mono">
                    <Clock className="w-3 h-3 icon-sharp" />
                    {timeAgo(inc.started_utc)}
                  </span>
                </div>
                {/* Title */}
                <div className="mt-3 text-[15px] font-bold text-ink leading-snug">
                  {shortTitle(inc.title)}
                </div>
                {/* Signal-icon strip */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {uniqueSignalIcons(inc, selectedAlertsFor(alerts, inc)).map((Icon, i) => (
                    <span
                      key={i}
                      className="h-7 w-7 rounded-lg bg-canvas-deep/40 border border-hairline/60 flex items-center justify-center"
                    >
                      <Icon className="w-3.5 h-3.5 icon-sharp text-brand-800" />
                    </span>
                  ))}
                  <span className="text-[11px] text-ink-muted ml-1">
                    {inc.alert_count} signal{inc.alert_count === 1 ? "" : "s"}
                    {inc.suppressed_duplicates > 0 ? ` · ${inc.suppressed_duplicates} muted` : ""}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail pane */}
        {selected && (
          <div className="lg:col-span-7 space-y-5">
            {/* Headline card */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <IncidentSeverityBadge severity={selected.severity} />
                    <span className="text-[11px] font-mono text-ink-muted">
                      {selected.incident_id}
                    </span>
                  </div>
                  <h2 className="mt-3 text-[22px] font-bold text-ink leading-tight tracking-tight">
                    {selected.title}
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline bg-canvas-deep/40 text-[11.5px] text-ink-soft">
                  <Activity className="w-3.5 h-3.5 icon-sharp" />
                  {selected.status}
                </span>
              </div>

              {/* Impact counter row — purely visual */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                <ImpactTile Icon={BrainCircuit} label="Signals" value={selected.alert_count} />
                <ImpactTile Icon={CircleSlash} label="Muted" value={selected.suppressed_duplicates} />
                <ImpactTile Icon={Server} label="Affected" value={selected.affected_sources?.length ?? 0} />
              </div>
            </div>

            {/* Signal timeline — icons left, the metric + value inline */}
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-ink">Signals</h3>
                <button
                  onClick={() => setShowReasoning((v) => !v)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-800 hover:underline"
                >
                  <Sparkles className="w-3.5 h-3.5 icon-sharp" />
                  {showReasoning ? "Hide reasoning" : "Show reasoning"}
                </button>
              </div>

              <ul className="mt-5 relative">
                {/* Timeline rail */}
                <div className="absolute left-5 top-5 bottom-5 w-px bg-hairline" />
                {selectedAlerts.slice(0, showReasoning ? undefined : 5).map((a) => {
                  const Icon = metricIcon(a.metric);
                  return (
                    <li key={a.alert_id} className="relative pl-14 py-3 first:pt-0 last:pb-0">
                      <span className="absolute left-1.5 top-2 h-8 w-8 rounded-full bg-white border-2 border-brand-200 flex items-center justify-center shadow-sm">
                        <Icon className="w-4 h-4 icon-sharp text-brand-800" />
                      </span>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold text-ink">
                            {a.service} · <span className="font-mono text-ink-soft text-[12.5px]">{a.metric || a.kind}</span>
                          </div>
                          {showReasoning && a.explanation?.why && (
                            <div className="text-[12px] text-ink-muted mt-1 leading-relaxed">
                              {a.explanation.why}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {a.explanation?.z_score !== undefined && (
                            <span className="text-[11px] font-mono font-semibold text-brand-800 bg-brand-chip border border-[#d5e6b4] px-2 py-0.5 rounded-md">
                              {a.explanation.z_score >= 0 ? "+" : ""}
                              {a.explanation.z_score.toFixed(1)}σ
                            </span>
                          )}
                          <IncidentSeverityDot severity={a.severity} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!showReasoning && selectedAlerts.length > 5 && (
                <button
                  onClick={() => setShowReasoning(true)}
                  className="mt-3 w-full text-center py-2 rounded-xl text-[12px] font-semibold text-ink-soft hover:text-ink border border-hairline hover:border-brand-200 flex items-center justify-center gap-1.5 transition"
                >
                  <ChevronDown className="w-3.5 h-3.5 icon-sharp" />
                  {selectedAlerts.length - 5} more signal{selectedAlerts.length - 5 === 1 ? "" : "s"}
                </button>
              )}
            </div>

            {/* Recommendation(s) — big visual action card */}
            {selectedRecs.map((rec) => (
              <RecommendationCard
                key={rec.rec_id}
                rec={rec}
                onApprove={() => onApprove(rec.rec_id)}
                onRollback={() => onRollback(rec.rec_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Audit strip */}
      {auditLog.length > 0 && (
        <div className="card p-6">
          <h3 className="text-[15px] font-bold text-ink">Recent actions</h3>
          <ul className="mt-4 space-y-2">
            {auditLog.slice(0, 3).map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-canvas-deep/40 border border-hairline/60"
              >
                <span className="h-7 w-7 rounded-full bg-brand-chip flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-800 icon-sharp" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink truncate">
                    {prettyAction(a.action)}
                  </div>
                  <div className="text-[11px] text-ink-muted truncate font-mono">{a.target || a.actor}</div>
                </div>
                <span className="text-[11px] font-mono text-ink-muted">{timeAgo(a.at_utc)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Sub-components ─────────────────────── */

function HeaderStrip({ open, critical }: { open: number; critical: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 px-1">
      <div>
        <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-ink">Incidents</h1>
        <p className="text-[14px] text-ink-soft mt-2">What AIOps is watching for you.</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 h-12 px-4 rounded-full bg-white border border-hairline">
          <AlertTriangle className="w-4 h-4 icon-sharp text-amber-500" />
          <span className="text-[13px] font-semibold text-ink">{open} open</span>
        </div>
        {critical > 0 && (
          <div className="flex items-center gap-2.5 h-12 px-4 rounded-full bg-danger-50 border border-danger-100">
            <AlertOctagon className="w-4 h-4 icon-sharp text-danger-700" />
            <span className="text-[13px] font-semibold text-danger-700">{critical} critical</span>
          </div>
        )}
      </div>
    </div>
  );
}

function IncidentSeverityBadge({ severity }: { severity: string }) {
  const sev = severityMeta[severity] ?? severityMeta.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${sev.chip}`}>
      <sev.Icon className="w-3.5 h-3.5 icon-sharp" />
      {sev.label}
    </span>
  );
}

function IncidentSeverityDot({ severity }: { severity: string }) {
  const sev = severityMeta[severity] ?? severityMeta.medium;
  return <span className={`h-2 w-2 rounded-full ${sev.dot}`} />;
}

function ImpactTile({
  Icon,
  label,
  value,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-canvas-deep/40 border border-hairline/60 p-4 flex items-center gap-3">
      <span className="h-10 w-10 rounded-xl bg-white border border-hairline flex items-center justify-center">
        <Icon className="w-5 h-5 icon-sharp text-brand-800" />
      </span>
      <div>
        <div className="text-[22px] font-bold text-ink leading-none">{value}</div>
        <div className="text-[11px] text-ink-muted mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function RecommendationCard({
  rec,
  onApprove,
  onRollback,
}: {
  rec: Recommendation;
  onApprove: () => void;
  onRollback: () => void;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const executed = rec.status === "executed_simulated";
  const rolled = rec.status === "rolled_back";
  const confidence = Math.round(rec.confidence * 100);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-full bg-brand-chip border border-[#d5e6b4] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-brand-800 icon-sharp" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Recommendation</span>
        </div>
        <StatusChip status={rec.status} />
      </div>

      <div className="mt-4 text-[17px] font-bold text-ink leading-snug">{rec.action}</div>

      {/* Confidence bar — visual, no decimal */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          <span>Model confidence</span>
          <span className="text-ink">{confidence}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-canvas-deep/60 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-brand-700"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Reasoning — collapsed by default, visual step list when open */}
      <button
        onClick={() => setShowReasoning((v) => !v)}
        className="mt-5 w-full text-left px-4 py-3 rounded-xl bg-canvas-deep/40 border border-hairline/60 flex items-center gap-3 hover:border-brand-200 transition"
      >
        <BrainCircuit className="w-4 h-4 icon-sharp text-brand-800" />
        <span className="flex-1 text-[12.5px] font-semibold text-ink-soft">Why this action?</span>
        <ChevronDown
          className={`w-4 h-4 icon-sharp text-ink-muted transition-transform ${showReasoning ? "rotate-180" : ""}`}
        />
      </button>
      {showReasoning && rec.reasoning_path.length > 0 && (
        <ol className="mt-3 space-y-2">
          {rec.reasoning_path.map((step, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-2.5 rounded-xl bg-canvas-deep/40 border border-hairline/60">
              <span className="h-6 w-6 rounded-full bg-brand-800 text-brand-mint text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-[12px] text-ink-soft leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        {!executed && !rolled && (
          <button onClick={onApprove} className="btn-pill-primary flex-1 justify-center">
            <Play className="w-4 h-4 icon-sharp" />
            Approve &amp; simulate
          </button>
        )}
        {executed && (
          <button onClick={onRollback} className="btn-pill flex-1 justify-center">
            <Undo2 className="w-4 h-4 icon-sharp" />
            Roll back
          </button>
        )}
        {rolled && (
          <div className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-full bg-canvas-deep/40 border border-hairline text-[12.5px] font-semibold text-ink-soft">
            <Undo2 className="w-4 h-4 icon-sharp" />
            Rolled back
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { chip: string; label: string }> = {
    proposed:            { chip: "bg-brand-chip text-brand-800 border border-[#d5e6b4]", label: "Proposed" },
    executed_simulated:  { chip: "bg-brand-800 text-white border border-brand-800",        label: "Executed (simulated)" },
    rolled_back:         { chip: "bg-canvas-deep/40 text-ink-soft border border-hairline", label: "Rolled back" },
    rejected:            { chip: "bg-danger-50 text-danger-700 border border-danger-100",  label: "Rejected" },
  };
  const m = map[status] ?? map.proposed;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${m.chip}`}>
      {m.label}
    </span>
  );
}

/* ─────────────────────── Helpers ─────────────────────── */

function shortTitle(t: string): string {
  // Many of our incident titles are structured like "payments-api degradation: cpu + latency + mem + warning".
  // Keep the service and the first two signal words for a snappier row.
  const m = t.match(/^([^:]+?)\s+degradation:\s*(.+)$/i);
  if (m) {
    const parts = m[2].split(/\s*\+\s*/).slice(0, 2);
    return `${m[1]}: ${parts.join(" + ")}`;
  }
  return t;
}

function selectedAlertsFor(alerts: Alert[], inc: Incident): Alert[] {
  return alerts.filter((a) => a.incident_id === inc.incident_id);
}

function uniqueSignalIcons(inc: Incident, incAlerts: Alert[]): React.ComponentType<{ className?: string }>[] {
  const seen = new Set<string>();
  const out: React.ComponentType<{ className?: string }>[] = [];
  for (const a of incAlerts) {
    const key = a.metric || a.kind;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(metricIcon(key));
    if (out.length >= 4) break;
  }
  return out.length ? out : [Activity];
}

function prettyAction(a: string) {
  return a
    .replace(/_/g, " ")
    .replace(/\brecommendation\b/i, "recommendation")
    .replace(/^\w/, (c) => c.toUpperCase());
}
