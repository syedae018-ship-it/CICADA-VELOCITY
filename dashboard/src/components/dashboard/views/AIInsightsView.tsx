"use client";

import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Play,
  Undo2,
  ChevronDown,
  CheckCircle2,
  BrainCircuit,
  Cpu,
  MemoryStick,
  Timer,
  Wifi,
  ShieldAlert,
  Server,
  Activity,
  ArrowRight,
  CircleSlash,
  Shield,
} from "lucide-react";
import { Recommendation, Alert, Incident, TenantId, DashboardTab } from "@/types";

interface AIInsightsViewProps {
  tenantId: TenantId;
  recommendations: Recommendation[];
  alerts: Alert[];
  incidents: Incident[];
  onApprove: (recId: string) => void;
  onRollback: (recId: string) => void;
  onSelectTab: (tab: DashboardTab, id?: string) => void;
}

/** Signal keyword → icon */
function signalIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes("cpu")) return Cpu;
  if (k.includes("mem")) return MemoryStick;
  if (k.includes("latency")) return Timer;
  if (k.includes("packet") || k.includes("bandwidth") || k.includes("network")) return Wifi;
  if (k.includes("login") || k.includes("auth") || k.includes("security")) return ShieldAlert;
  if (k.includes("heartbeat") || k.includes("collector") || k.includes("offline")) return Server;
  return Activity;
}

const statusMeta: Record<
  Recommendation["status"],
  { chip: string; label: string; dot: string }
> = {
  proposed:           { chip: "bg-brand-chip text-brand-800 border border-[#d5e6b4]",  label: "Proposed",   dot: "bg-brand-500" },
  approved:           { chip: "bg-brand-chip text-brand-800 border border-[#d5e6b4]",  label: "Approved",   dot: "bg-brand-500" },
  executed_simulated: { chip: "bg-brand-800 text-white border border-brand-800",         label: "Simulated",  dot: "bg-brand-mint" },
  rolled_back:        { chip: "bg-canvas-deep/40 text-ink-soft border border-hairline",  label: "Rolled back", dot: "bg-ink-muted" },
  rejected:           { chip: "bg-danger-50 text-danger-700 border border-danger-100",   label: "Rejected",   dot: "bg-danger-700" },
};

/** Circular confidence gauge — the primary visual */
function ConfidenceRing({ pct }: { pct: number }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const val = Math.max(5, Math.min(100, pct));
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
        <circle cx="56" cy="56" r={R} stroke="#eef0ea" strokeWidth="10" fill="none" />
        <circle
          cx="56"
          cy="56"
          r={R}
          stroke="url(#confGrad)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(val / 100) * C} ${C}`}
          className="transition-all duration-500"
        />
        <defs>
          <linearGradient id="confGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-brand-500)" />
            <stop offset="100%" stopColor="var(--color-brand-800)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[22px] font-bold text-ink leading-none tracking-tight">{Math.round(pct)}%</div>
        <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-wider font-semibold">confidence</div>
      </div>
    </div>
  );
}

export default function AIInsightsView({
  recommendations,
  alerts,
  incidents,
  onApprove,
  onRollback,
  onSelectTab,
}: AIInsightsViewProps) {
  const proposed = recommendations.filter((r) => r.status === "proposed");
  const simulated = recommendations.filter((r) => r.status === "executed_simulated");
  const rolledBack = recommendations.filter((r) => r.status === "rolled_back");

  return (
    <div className="space-y-6">
      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-ink">AI Insights</h1>
          <p className="text-[14px] text-ink-soft mt-2">Explainable recommendations — approve, simulate, roll back.</p>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3">
          <SummaryPill Icon={Sparkles} count={proposed.length} label="Awaiting" tone="brand" />
          <SummaryPill Icon={Play} count={simulated.length} label="Simulated" tone="dark" />
          <SummaryPill Icon={Undo2} count={rolledBack.length} label="Rolled back" tone="muted" />
        </div>
      </div>

      {/* Safety strip — one visual line */}
      <div className="card p-5 flex items-center gap-4 border border-hairline">
        <span className="h-11 w-11 rounded-full bg-brand-chip border border-[#d5e6b4] flex items-center justify-center">
          <Shield className="w-5 h-5 text-brand-800 icon-sharp" />
        </span>
        <div className="flex-1">
          <div className="text-[13.5px] font-semibold text-ink">Policy-checked · human-approved · fully reversible</div>
          <div className="text-[12px] text-ink-muted">All actions are simulated and audited; no production change is made.</div>
        </div>
      </div>

      {/* Recommendation cards */}
      {recommendations.length === 0 ? (
        <div className="card p-16 flex flex-col items-center gap-4">
          <span className="h-16 w-16 rounded-full bg-brand-chip border border-[#d5e6b4] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-brand-800 icon-sharp" />
          </span>
          <div className="text-[20px] font-bold text-ink">Nothing to review</div>
          <div className="text-[13px] text-ink-soft">
            AIOps hasn't proposed anything — telemetry is within baseline.
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {recommendations.map((rec) => (
            <RecommendationHero
              key={rec.rec_id}
              rec={rec}
              incident={incidents.find((i) => i.incident_id === rec.incident_id)}
              incidentAlerts={alerts.filter((a) => a.incident_id === rec.incident_id)}
              onApprove={() => onApprove(rec.rec_id)}
              onRollback={() => onRollback(rec.rec_id)}
              onOpenIncident={() => onSelectTab("incidents", rec.incident_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryPill({
  Icon,
  count,
  label,
  tone,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  count: number;
  label: string;
  tone: "brand" | "dark" | "muted";
}) {
  const skin =
    tone === "brand"
      ? "bg-brand-chip border-[#d5e6b4] text-brand-800"
      : tone === "dark"
      ? "bg-brand-800 border-brand-800 text-white"
      : "bg-white border-hairline text-ink-soft";
  return (
    <div className={`flex items-center gap-2 h-12 px-4 rounded-full border ${skin}`}>
      <Icon className="w-4 h-4 icon-sharp" />
      <span className="text-[13px] font-semibold">
        {count} {label}
      </span>
    </div>
  );
}

function RecommendationHero({
  rec,
  incident,
  incidentAlerts,
  onApprove,
  onRollback,
  onOpenIncident,
}: {
  rec: Recommendation;
  incident: Incident | undefined;
  incidentAlerts: Alert[];
  onApprove: () => void;
  onRollback: () => void;
  onOpenIncident: () => void;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const status = statusMeta[rec.status];
  const executed = rec.status === "executed_simulated";
  const rolled = rec.status === "rolled_back";

  // Unique signal icons for contributing signals
  const uniqueSignals = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; Icon: React.ComponentType<{ className?: string }> }[] = [];
    for (const sig of rec.contributing_signals) {
      const key = sig;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, Icon: signalIcon(key) });
      if (out.length >= 6) break;
    }
    return out;
  }, [rec.contributing_signals]);

  return (
    <div className="card p-6">
      {/* Top row: confidence ring + headline + status */}
      <div className="flex items-start gap-5 flex-wrap">
        <ConfidenceRing pct={rec.confidence * 100} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${status.chip}`}>
              {status.label}
            </span>
            {incident && (
              <button
                onClick={onOpenIncident}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-800 hover:underline"
              >
                {incident.severity} · {incident.title.length > 30 ? incident.title.slice(0, 30) + "…" : incident.title}
                <ArrowRight className="w-3 h-3 icon-sharp" />
              </button>
            )}
          </div>
          <h3 className="mt-3 text-[20px] font-bold text-ink leading-snug tracking-tight">
            {rec.action}
          </h3>

          {/* Contributing signals as icon chips */}
          {uniqueSignals.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Signals</span>
              {uniqueSignals.map(({ key, Icon }) => (
                <span
                  key={key}
                  title={key}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-canvas-deep/40 border border-hairline/60"
                >
                  <Icon className="w-3.5 h-3.5 icon-sharp text-brand-800" />
                  <span className="text-[11px] font-mono text-ink-soft truncate max-w-[120px]">{key}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Policy + risk + rollback plan — visual tiles */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoTile
          Icon={Shield}
          label="Policy"
          value={rec.policy_check?.allowed ? "Allowed" : "Blocked"}
          tone={rec.policy_check?.allowed ? "brand" : "rose"}
        />
        <InfoTile
          Icon={Activity}
          label="Risk"
          value={(rec.risk ?? "low").toString()}
          tone={rec.risk === "high" ? "rose" : rec.risk === "medium" ? "amber" : "brand"}
        />
        <InfoTile Icon={Undo2} label="Rollback" value={rec.rollback_plan ? "Available" : "None"} tone="muted" />
      </div>

      {/* Reasoning dropdown */}
      <button
        onClick={() => setShowReasoning((v) => !v)}
        className="mt-5 w-full text-left px-4 py-3 rounded-xl bg-canvas-deep/40 border border-hairline/60 flex items-center gap-3 hover:border-brand-200 transition"
      >
        <BrainCircuit className="w-4 h-4 icon-sharp text-brand-800" />
        <span className="flex-1 text-[12.5px] font-semibold text-ink-soft">How did AIOps decide?</span>
        <ChevronDown
          className={`w-4 h-4 icon-sharp text-ink-muted transition-transform ${showReasoning ? "rotate-180" : ""}`}
        />
      </button>
      {showReasoning && (
        <div className="mt-3 space-y-2">
          {rec.reasoning_path.length === 0 ? (
            <div className="px-4 py-3 rounded-xl text-[12px] text-ink-muted bg-canvas-deep/40 border border-hairline/60">
              No reasoning recorded.
            </div>
          ) : (
            <ol className="space-y-2">
              {rec.reasoning_path.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 px-4 py-2.5 rounded-xl bg-canvas-deep/40 border border-hairline/60"
                >
                  <span className="h-6 w-6 rounded-full bg-brand-800 text-brand-mint text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-[12px] text-ink-soft leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          )}
          {/* Peek at some alert explanations for extra context */}
          {incidentAlerts.slice(0, 2).map((a) => (
            <div
              key={a.alert_id}
              className="px-4 py-2.5 rounded-xl bg-white border border-hairline/60 text-[11.5px] text-ink-soft flex items-start gap-2"
            >
              {React.createElement(signalIcon(a.metric || a.kind), {
                className: "w-3.5 h-3.5 icon-sharp text-brand-800 mt-0.5 shrink-0",
              })}
              <span>{a.explanation?.why ?? `${a.service} · ${a.metric || a.kind}`}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        {!executed && !rolled && (
          <>
            <button onClick={onApprove} className="btn-pill-primary flex-1 justify-center">
              <Play className="w-4 h-4 icon-sharp" />
              Approve &amp; simulate
            </button>
            <button onClick={onOpenIncident} className="btn-pill">
              Open incident
            </button>
          </>
        )}
        {executed && (
          <>
            <div className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-full bg-brand-800 text-white text-[13px] font-semibold">
              <CheckCircle2 className="w-4 h-4 icon-sharp" />
              Simulated · audit recorded
            </div>
            <button onClick={onRollback} className="btn-pill">
              <Undo2 className="w-4 h-4 icon-sharp" />
              Roll back
            </button>
          </>
        )}
        {rolled && (
          <div className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-full bg-canvas-deep/40 border border-hairline text-[12.5px] font-semibold text-ink-soft">
            <CircleSlash className="w-4 h-4 icon-sharp" />
            Rolled back
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTile({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "brand" | "amber" | "rose" | "muted";
}) {
  const skin =
    tone === "brand"
      ? "text-brand-800"
      : tone === "amber"
      ? "text-warn-700"
      : tone === "rose"
      ? "text-danger-700"
      : "text-ink-soft";
  return (
    <div className="rounded-2xl bg-canvas-deep/40 border border-hairline/60 p-4 flex items-center gap-3">
      <span className="h-10 w-10 rounded-xl bg-white border border-hairline flex items-center justify-center">
        <Icon className={`w-5 h-5 icon-sharp ${skin}`} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
        <div className={`text-[13.5px] font-semibold capitalize ${tone === "muted" ? "text-ink" : skin}`}>{value}</div>
      </div>
    </div>
  );
}
