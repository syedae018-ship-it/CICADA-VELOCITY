"use client";

import React from "react";
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

export default function IncidentsView({
  tenantId,
  incidents,
  alerts,
  recommendations,
  auditLog,
  onApprove,
  onRollback,
}: IncidentsViewProps) {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 uppercase tracking-tight">
            AIOps Incidents & Recommendations
          </h1>
          <p className="text-xs text-neutral-500">
            Multi-signal correlation, z-score anomaly analysis, and human-in-the-loop remediation
          </p>
        </div>
        <div className="text-xs font-mono text-neutral-600">
          {incidents.length} OPEN · {recommendations.length} RECOMMENDATIONS
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-12 text-center rounded-lg shadow-xs">
          <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider mb-1">
            Status: Nominal
          </div>
          <h2 className="text-base font-bold text-neutral-900 mb-2">Zero Open Incidents</h2>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            All telemetry streams operating within 3σ baseline thresholds. No anomalies detected.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Incidents & Correlated Signals */}
          <div className="lg:col-span-7 space-y-5">
            {incidents.map((inc) => (
              <div
                key={inc.incident_id}
                className="border border-neutral-200 bg-white p-5 rounded-lg space-y-4 shadow-xs"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="border border-rose-200 bg-rose-50 text-rose-800 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                        {inc.severity} Severity
                      </span>
                      <span className="border border-neutral-200 bg-neutral-50 text-neutral-700 px-2 py-0.5 rounded text-[10px] font-mono">
                        {inc.suppressed_duplicates} Duplicates Suppressed
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-neutral-900 tracking-tight">
                      {inc.title}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500">
                    {inc.incident_id}
                  </span>
                </div>

                {/* Likely Cause Assessment */}
                <div className="p-3.5 border border-neutral-200 bg-neutral-50 rounded space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                    Inferred Root Cause:
                  </div>
                  <p className="text-xs text-neutral-800 font-medium leading-relaxed">
                    {inc.likely_cause}
                  </p>
                  <div className="text-[10px] font-mono text-neutral-500 pt-1">
                    Rule: {inc.correlation_rule}
                  </div>
                </div>

                {/* Correlated Alerts Timeline */}
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                    Contributing Signals ({alerts.length})
                  </div>
                  {alerts.map((al) => (
                    <div
                      key={al.alert_id}
                      className="p-3 border border-neutral-200 bg-neutral-50/50 rounded space-y-1 font-mono text-xs"
                    >
                      <div className="flex items-center justify-between text-neutral-900 font-semibold">
                        <span>{al.service} · {al.metric}</span>
                        <span className="text-amber-700 font-bold">
                          z = +{al.explanation.z_score}σ ({Math.round(al.explanation.confidence * 100)}% conf)
                        </span>
                      </div>
                      <p className="text-neutral-700 font-sans text-xs">
                        {al.explanation.why}
                      </p>
                      <div className="text-[10px] text-neutral-500 flex items-center gap-2 pt-1 border-t border-neutral-200">
                        <span>Observed: <strong className="text-neutral-900">{al.explanation.observed}</strong></span>
                        <span>·</span>
                        <span>Baseline: {al.explanation.baseline.mean} (&sigma;={al.explanation.baseline.std})</span>
                        <span>·</span>
                        <span>{al.explanation.baseline.window_minutes}m window</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Recommendation & Remediation */}
          <div className="lg:col-span-5 space-y-5">
            {recommendations.map((rec) => {
              const isExecuted = rec.status === "executed_simulated";
              const isRolledBack = rec.status === "rolled_back";

              return (
                <div
                  key={rec.rec_id}
                  className="border border-neutral-200 bg-white p-5 rounded-lg space-y-4 shadow-xs"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
                      Prescriptive Remediation
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold border ${
                        isExecuted
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : isRolledBack
                          ? "border-neutral-200 bg-neutral-50 text-neutral-600"
                          : "border-neutral-900 bg-neutral-900 text-white"
                      }`}
                    >
                      {rec.status.replace("_", " ")}
                    </span>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono uppercase text-neutral-500 mb-1">
                      Action Proposal:
                    </div>
                    <h3 className="text-sm font-bold text-neutral-900 tracking-tight leading-snug">
                      {rec.action}
                    </h3>
                  </div>

                  {/* Confidence & Policy Check */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="border border-neutral-200 bg-neutral-50 p-2.5 rounded">
                      <span className="text-[10px] text-neutral-500 block uppercase">Confidence</span>
                      <span className="text-neutral-900 font-bold">{Math.round(rec.confidence * 100)}%</span>
                    </div>
                    <div className="border border-neutral-200 bg-neutral-50 p-2.5 rounded">
                      <span className="text-[10px] text-neutral-500 block uppercase">Policy Check</span>
                      <span className="text-neutral-900 font-bold">Allowed &check;</span>
                    </div>
                  </div>

                  {/* Reasoning Path */}
                  <div className="space-y-1.5 border border-neutral-200 bg-neutral-50 p-3.5 rounded text-xs">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                      Reasoning Path:
                    </span>
                    {rec.reasoning_path.map((step, idx) => (
                      <div key={idx} className="text-neutral-700 leading-relaxed font-sans text-xs">
                        {step}
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="pt-2">
                    {!isExecuted && !isRolledBack && (
                      <button
                        onClick={() => onApprove(rec.rec_id)}
                        className="w-full py-2.5 bg-neutral-900 text-white hover:bg-black font-bold text-xs uppercase tracking-wider rounded transition"
                      >
                        Approve & Execute Remediation
                      </button>
                    )}

                    {isExecuted && (
                      <button
                        onClick={() => onRollback(rec.rec_id)}
                        className="w-full py-2.5 border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold text-xs uppercase tracking-wider rounded transition"
                      >
                        Rollback Remediation
                      </button>
                    )}

                    {isRolledBack && (
                      <div className="text-center py-2 text-xs font-mono text-neutral-500">
                        Remediation rolled back. State snapshot restored.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Audit Trail */}
            <div className="border border-neutral-200 bg-white p-4 rounded-lg space-y-2 shadow-xs">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold mb-2">
                Remediation Audit Log
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-[11px]">
                {auditLog.map((aud) => (
                  <div
                    key={aud.id}
                    className="p-2 border border-neutral-200 bg-neutral-50 rounded space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-neutral-600">
                      <span className="text-neutral-900 font-semibold">{aud.action}</span>
                      <span>{aud.at_utc.slice(11, 19)} UTC</span>
                    </div>
                    <p className="text-neutral-700 text-xs font-sans">{aud.details}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
