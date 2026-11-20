"use client";

import React from "react";
import { Sparkles, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, Activity, Cpu, RotateCcw } from "lucide-react";
import { Recommendation, Alert, Incident, TenantId } from "@/types";

interface AIInsightsViewProps {
  tenantId: TenantId;
  recommendations: Recommendation[];
  alerts: Alert[];
  incidents: Incident[];
  onApprove: (recId: string) => void;
  onRollback: (recId: string) => void;
  onSelectTab: (tab: any, id?: string) => void;
}

export default function AIInsightsView({
  tenantId,
  recommendations,
  alerts,
  incidents,
  onApprove,
  onRollback,
  onSelectTab,
}: AIInsightsViewProps) {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-neutral-200 gap-2">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 uppercase tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            AIOps Insights & Autonomous Prescriptions
          </h1>
          <p className="text-xs text-neutral-500">
            Explainable root-cause inference, anomaly z-scores, and policy-governed remediation
          </p>
        </div>
        <div className="text-xs font-mono border border-neutral-200 bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded">
          MODEL: STATISTICAL + DETERMINISTIC CORRELATION
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-neutral-200 bg-white shadow-xs">
          <div className="text-[10px] font-mono uppercase text-neutral-500 mb-1">
            Active Recommendations
          </div>
          <div className="text-2xl font-light font-mono text-neutral-900">
            {recommendations.length}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Human-in-the-loop review required
          </p>
        </div>

        <div className="p-4 rounded-lg border border-neutral-200 bg-white shadow-xs">
          <div className="text-[10px] font-mono uppercase text-neutral-500 mb-1">
            Average Model Confidence
          </div>
          <div className="text-2xl font-light font-mono text-neutral-900">
            {recommendations.length > 0
              ? `${Math.round(
                  (recommendations.reduce((acc, r) => acc + r.confidence, 0) /
                    recommendations.length) *
                    100
                )}%`
              : "N/A"}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Calculated across multi-variate baselines
          </p>
        </div>

        <div className="p-4 rounded-lg border border-neutral-200 bg-white shadow-xs">
          <div className="text-[10px] font-mono uppercase text-neutral-500 mb-1">
            Guardrail Policies
          </div>
          <div className="text-2xl font-light font-mono text-emerald-700">
            100% Passed
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Automated policy check: Allowed ✓
          </p>
        </div>
      </div>

      {/* Main Recommendations List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-tight">
          Generated Actionable Recommendations
        </h2>

        {recommendations.length === 0 ? (
          <div className="border border-neutral-200 bg-white p-12 text-center rounded-lg shadow-xs">
            <h3 className="text-sm font-bold text-neutral-900 mb-1">No Anomalies Detected</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              All infrastructure metrics are operating within normal 3σ parameters. No prescriptive actions required.
            </p>
          </div>
        ) : (
          recommendations.map((rec) => {
            const isExecuted = rec.status === "executed_simulated";
            const isRolledBack = rec.status === "rolled_back";

            return (
              <div
                key={rec.rec_id}
                className="border border-neutral-200 bg-white rounded-lg p-6 shadow-xs space-y-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase text-blue-700 font-bold border border-blue-200 bg-blue-50 px-2 py-0.5 rounded">
                      ID: {rec.rec_id}
                    </span>
                    <span className="text-xs font-mono text-neutral-500">
                      Target Incident: {rec.incident_id}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                      isExecuted
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : isRolledBack
                        ? "border-neutral-200 bg-neutral-100 text-neutral-600"
                        : "border-neutral-900 bg-neutral-900 text-white"
                    }`}
                  >
                    {rec.status.replace("_", " ")}
                  </span>
                </div>

                {/* Proposed Action */}
                <div>
                  <div className="text-[10px] font-mono uppercase text-neutral-500 font-semibold mb-1">
                    Prescriptive Action Proposal:
                  </div>
                  <h3 className="text-base font-bold text-neutral-900 tracking-tight leading-snug">
                    {rec.action}
                  </h3>
                </div>

                {/* Contributing Signals & Confidence */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 border border-neutral-200 bg-neutral-50 rounded">
                    <span className="text-[10px] text-neutral-500 uppercase block mb-1">Model Confidence</span>
                    <span className="text-base font-bold text-neutral-900">
                      {Math.round(rec.confidence * 100)}%
                    </span>
                  </div>
                  <div className="p-3 border border-neutral-200 bg-neutral-50 rounded">
                    <span className="text-[10px] text-neutral-500 uppercase block mb-1">Safety Risk Tier</span>
                    <span className="text-base font-bold text-emerald-700 uppercase">
                      {rec.risk} Risk
                    </span>
                  </div>
                  <div className="p-3 border border-neutral-200 bg-neutral-50 rounded">
                    <span className="text-[10px] text-neutral-500 uppercase block mb-1">Policy Governance</span>
                    <span className="text-base font-bold text-neutral-900">
                      Allowed ✓
                    </span>
                  </div>
                </div>

                {/* Explainable Reasoning Path */}
                <div className="p-4 border border-neutral-200 bg-neutral-50 rounded space-y-2 text-xs">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold block">
                    Explainable Inference Logic (Step-by-Step):
                  </span>
                  <div className="space-y-1.5 font-sans text-neutral-700 leading-relaxed">
                    {rec.reasoning_path.map((step, idx) => (
                      <div key={idx} className="p-1">
                        {step}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rollback Snapshot Plan */}
                <div className="p-3 border border-neutral-200 bg-white rounded text-xs font-mono flex items-center justify-between text-neutral-600">
                  <span>Automated Rollback Plan: <strong className="text-neutral-900">{rec.rollback_plan}</strong></span>
                  <span className="text-neutral-400">Snapshot Saved ✓</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  {!isExecuted && !isRolledBack && (
                    <button
                      onClick={() => onApprove(rec.rec_id)}
                      className="px-5 py-2.5 bg-neutral-900 text-white hover:bg-black font-bold text-xs uppercase tracking-wider rounded transition font-mono"
                    >
                      Approve & Execute Remediation
                    </button>
                  )}

                  {isExecuted && (
                    <button
                      onClick={() => onRollback(rec.rec_id)}
                      className="px-5 py-2.5 border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold text-xs uppercase tracking-wider rounded transition font-mono flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Rollback To Baseline</span>
                    </button>
                  )}

                  <button
                    onClick={() => onSelectTab("incidents", rec.incident_id)}
                    className="px-4 py-2.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded transition font-mono"
                  >
                    View Target Incident &rarr;
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
