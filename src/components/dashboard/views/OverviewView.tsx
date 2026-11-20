"use client";

import React, { useState } from "react";
import {
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Wifi,
  Cpu,
  Clock,
  ArrowRight,
} from "lucide-react";
import { MonitoredSource, CollectorNode, Incident, Recommendation, DashboardTab, HealthState } from "@/types";

interface OverviewViewProps {
  sources: MonitoredSource[];
  collectors: CollectorNode[];
  incidents: Incident[];
  recommendations: Recommendation[];
  onSelectTab: (tab: DashboardTab, entityId?: string) => void;
  onSelectSource: (source: MonitoredSource) => void;
}

export default function OverviewView({
  sources,
  collectors,
  incidents,
  recommendations,
  onSelectTab,
  onSelectSource,
}: OverviewViewProps) {
  const [activeChartMetric, setActiveChartMetric] = useState<"cpu" | "memory" | "latency" | "network">("cpu");

  const totalSources = sources.length;
  const onlineCollectors = collectors.filter((c) => c.status === "online").length;
  const offlineCollectors = collectors.filter((c) => c.status === "offline").length;
  const excellentSystems = sources.filter((s) => s.state === "excellent").length;
  const activeIncidents = incidents.filter((i) => i.status !== "resolved").length;
  const criticalIncidents = incidents.filter((i) => i.severity === "critical").length;

  const stateColors: Record<HealthState, { bg: string; text: string; border: string }> = {
    excellent: { bg: "bg-neutral-100", text: "text-neutral-800", border: "border-neutral-200" },
    good: { bg: "bg-neutral-100", text: "text-neutral-700", border: "border-neutral-200" },
    fair: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300" },
    poor: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-300" },
  };

  // 6 Primary KPI Cards
  const kpiCards = [
    {
      title: "Total Monitored Sources",
      value: totalSources,
      desc: "Active monitored workloads",
      trend: "+2 this week",
      trendUp: true,
      icon: Layers,
      tab: "sources" as DashboardTab,
    },
    {
      title: "Online Collectors",
      value: onlineCollectors,
      desc: "Tier 1 perimeter nodes",
      trend: "100% active",
      trendUp: true,
      icon: Server,
      tab: "fleet" as DashboardTab,
    },
    {
      title: "Offline Collectors",
      value: offlineCollectors,
      desc: "Unreachable instances",
      trend: "0 dropped",
      trendUp: false,
      icon: Activity,
      tab: "fleet" as DashboardTab,
      highlightZero: true,
    },
    {
      title: "Excellent Systems",
      value: excellentSystems,
      desc: "Sources below 60% load",
      trend: "Optimal state",
      trendUp: true,
      icon: CheckCircle2,
      tab: "sources" as DashboardTab,
    },
    {
      title: "Active Incidents",
      value: activeIncidents,
      desc: "Correlated multi-signal alerts",
      trend: activeIncidents > 0 ? "Requires review" : "Nominal",
      trendUp: activeIncidents === 0,
      icon: AlertTriangle,
      tab: "incidents" as DashboardTab,
      isWarning: activeIncidents > 0,
    },
    {
      title: "Critical Incidents",
      value: criticalIncidents,
      desc: "P0 compute / SLA anomalies",
      trend: criticalIncidents > 0 ? "Action recommended" : "0 Critical",
      trendUp: criticalIncidents === 0,
      icon: AlertCircle,
      tab: "incidents" as DashboardTab,
      isDanger: criticalIncidents > 0,
    },
  ];

  // Aggregate time-series for chart
  const timeBuckets = ["09:00", "09:03", "09:06", "09:09", "09:12", "09:15"];
  const avgCpuData = [28.4, 29.8, 30.5, 33.2, 48.5, 52.8];
  const avgMemData = [45.1, 45.4, 45.9, 47.1, 52.0, 56.4];
  const avgLatencyData = [16.2, 16.5, 17.1, 18.0, 38.4, 62.1];
  const avgNetworkData = [190, 205, 218, 235, 275, 298];

  const getChartValues = () => {
    switch (activeChartMetric) {
      case "cpu":
        return { data: avgCpuData, unit: "%", label: "Average Cluster CPU Utilization", max: 100 };
      case "memory":
        return { data: avgMemData, unit: "%", label: "Average Cluster Memory Utilization", max: 100 };
      case "latency":
        return { data: avgLatencyData, unit: "ms", label: "Average Network Latency (Roundtrip)", max: 120 };
      case "network":
        return { data: avgNetworkData, unit: " Mbps", label: "Aggregated Network Throughput", max: 400 };
    }
  };

  const chartMeta = getChartValues();

  return (
    <div className="space-y-6 font-sans">
      {/* 6 Enterprise KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={() => onSelectTab(card.tab)}
              className={`p-4 rounded-lg border bg-white cursor-pointer hover:border-neutral-400 hover:shadow-xs transition flex flex-col justify-between ${
                card.isDanger
                  ? "border-rose-300 bg-rose-50/30"
                  : card.isWarning
                  ? "border-amber-300 bg-amber-50/20"
                  : "border-neutral-200"
              }`}
            >
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider font-semibold truncate">
                  {card.title}
                </span>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${card.isDanger ? "text-rose-600" : card.isWarning ? "text-amber-600" : "text-neutral-400"}`} />
              </div>

              <div>
                <div className={`text-2xl font-light font-mono tracking-tight ${card.isDanger ? "text-rose-700 font-semibold" : card.isWarning ? "text-amber-800 font-semibold" : "text-neutral-900"}`}>
                  {card.value}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                  {card.desc}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] font-mono text-neutral-500">
                <span className={card.trendUp ? "text-neutral-700 font-semibold" : "text-neutral-600"}>
                  {card.trend}
                </span>
                <ArrowRight className="w-3 h-3 text-neutral-400" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Infrastructure Health & Performance Chart */}
      <div className="border border-neutral-200 bg-white rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-tight">
              Cluster Performance & Telemetry Trends
            </h2>
            <p className="text-xs text-neutral-500">
              Aggregated timeseries metrics emitted across customer collector fleet
            </p>
          </div>

          {/* Metric Switcher Tabs */}
          <div className="flex p-0.5 border border-neutral-200 bg-neutral-50 rounded text-xs font-mono">
            <button
              onClick={() => setActiveChartMetric("cpu")}
              className={`px-2.5 py-1 rounded transition ${
                activeChartMetric === "cpu" ? "bg-white text-neutral-900 font-semibold shadow-2xs" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              CPU Load
            </button>
            <button
              onClick={() => setActiveChartMetric("memory")}
              className={`px-2.5 py-1 rounded transition ${
                activeChartMetric === "memory" ? "bg-white text-neutral-900 font-semibold shadow-2xs" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Memory
            </button>
            <button
              onClick={() => setActiveChartMetric("latency")}
              className={`px-2.5 py-1 rounded transition ${
                activeChartMetric === "latency" ? "bg-white text-neutral-900 font-semibold shadow-2xs" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Latency
            </button>
            <button
              onClick={() => setActiveChartMetric("network")}
              className={`px-2.5 py-1 rounded transition ${
                activeChartMetric === "network" ? "bg-white text-neutral-900 font-semibold shadow-2xs" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Throughput
            </button>
          </div>
        </div>

        {/* Chart Visualization */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-500 mb-2">
            <span>{chartMeta.label}</span>
            <span>Current: <strong className="text-neutral-900">{chartMeta.data[chartMeta.data.length - 1]}{chartMeta.unit}</strong></span>
          </div>

          <div className="h-44 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b border-neutral-200 bg-neutral-50/50 rounded-t">
            {chartMeta.data.map((val, idx) => {
              const heightPct = Math.min((val / chartMeta.max) * 100, 100);
              const isLatest = idx === chartMeta.data.length - 1;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-mono text-neutral-600 opacity-0 group-hover:opacity-100 transition">
                    {val}{chartMeta.unit}
                  </span>
                  <div
                    className={`w-full rounded-t transition-all ${
                      isLatest && activeChartMetric === "cpu" && val > 50
                        ? "bg-rose-600"
                        : isLatest
                        ? "bg-neutral-900"
                        : "bg-neutral-300 group-hover:bg-neutral-400"
                    }`}
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                  <span className="text-[10px] font-mono text-neutral-500">{timeBuckets[idx]}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1">
            <span>09:00 UTC (Nominal)</span>
            <span>09:15 UTC (Anomaly spike registered)</span>
          </div>
        </div>
      </div>

      {/* Grid: Recent Incidents & AI Insights Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Incidents (7 Cols) */}
        <div className="lg:col-span-7 border border-neutral-200 bg-white rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Active Correlated Incidents
              </h3>
              <p className="text-xs text-neutral-500">AIOps multi-signal clustered incidents</p>
            </div>
            <button
              onClick={() => onSelectTab("incidents")}
              className="text-xs font-semibold text-neutral-900 hover:underline font-mono"
            >
              View All ({incidents.length}) &rarr;
            </button>
          </div>

          {incidents.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">Zero active incidents.</div>
          ) : (
            <div className="space-y-3">
              {incidents.map((inc) => (
                <div
                  key={inc.incident_id}
                  onClick={() => onSelectTab("incidents", inc.incident_id)}
                  className="p-4 rounded-lg border border-neutral-200 hover:border-neutral-400 bg-neutral-50/50 hover:bg-neutral-50 cursor-pointer transition space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="border border-rose-300 bg-rose-50 text-rose-800 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                        {inc.severity}
                      </span>
                      <h4 className="text-xs font-bold text-neutral-900 tracking-tight">
                        {inc.title}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500 shrink-0">
                      Duration: {inc.duration}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-700 leading-relaxed">
                    {inc.likely_cause}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1">
                    <span>{inc.alert_count} alerts · {inc.suppressed_duplicates} suppressed</span>
                    <span className="font-semibold text-neutral-800">Review & Approve &rarr;</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Insights & Prescriptive Recommendations (5 Cols) */}
        <div className="lg:col-span-5 border border-neutral-200 bg-white rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                AI Insights & Prescriptions
              </h3>
              <p className="text-xs text-neutral-500">Autonomous recommendation engine</p>
            </div>
            <button
              onClick={() => onSelectTab("ai_insights")}
              className="text-xs font-semibold text-neutral-900 hover:underline font-mono"
            >
              Full Details &rarr;
            </button>
          </div>

          {recommendations.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">No pending recommendations.</div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <div
                  key={rec.rec_id}
                  className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-mono uppercase text-blue-700 font-bold border border-blue-200 bg-blue-50 px-1.5 py-0.2 rounded">
                      Model Confidence: {Math.round(rec.confidence * 100)}%
                    </span>
                    <span className="text-[10px] font-mono uppercase text-neutral-500">
                      {rec.status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-neutral-900 leading-snug">
                    {rec.action}
                  </p>

                  <div className="text-[11px] text-neutral-600 bg-white p-2.5 rounded border border-neutral-200 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-neutral-500 font-semibold block">
                      Inferred Path:
                    </span>
                    <p className="line-clamp-2">{rec.reasoning_path[0]}</p>
                  </div>

                  <button
                    onClick={() => onSelectTab("incidents")}
                    className="w-full py-2 bg-neutral-900 text-white hover:bg-black text-xs font-bold uppercase rounded transition font-mono"
                  >
                    Action in Incidents Console &rarr;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
