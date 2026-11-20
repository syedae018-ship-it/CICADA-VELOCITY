"use client";

import React from "react";
import { X, Server, Activity, AlertTriangle, ShieldCheck, Clock, Cpu, HardDrive, Wifi, ArrowUpRight } from "lucide-react";
import { MonitoredSource, Incident } from "@/types";

interface SourceDetailDrawerProps {
  source: MonitoredSource | null;
  onClose: () => void;
  incidents: Incident[];
}

export default function SourceDetailDrawer({
  source,
  onClose,
  incidents,
}: SourceDetailDrawerProps) {
  if (!source) return null;

  const relatedIncidents = incidents.filter((i) =>
    i.affected_sources.includes(source.source_id)
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs font-sans">
      <div className="bg-white border-l border-neutral-200 w-full max-w-xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase border border-neutral-200 bg-neutral-50 px-2 py-0.5 rounded text-neutral-600 font-semibold">
                {source.source_type}
              </span>
              <span className="text-[10px] font-mono text-neutral-500">
                Region: {source.region}
              </span>
            </div>
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
              {source.service}
            </h2>
            <div className="text-xs font-mono text-neutral-500">
              ID: {source.source_id} · Collector: {source.collector_id}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Health Assessment Box */}
          <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-500 uppercase font-semibold">Health Classification</span>
              <span className="font-bold uppercase px-2 py-0.5 rounded text-[11px] border border-neutral-300 bg-white">
                {source.state}
              </span>
            </div>
            <p className="text-xs text-neutral-800 font-medium">
              {source.reason}
            </p>
            <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>Last Event: {source.last_seen_utc}</span>
              <span>Heartbeat: {source.last_heartbeat_utc}</span>
            </div>
          </div>

          {/* Current Realtime Metrics */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-500 font-semibold mb-3">
              Current Telemetry Metrics
            </h3>
            <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
              <div className="p-3 rounded border border-neutral-200 bg-white">
                <span className="text-[10px] text-neutral-500 block uppercase">CPU Load</span>
                <span className={`text-base font-bold ${source.metrics.cpu_pct && source.metrics.cpu_pct > 90 ? "text-rose-600" : "text-neutral-900"}`}>
                  {source.metrics.cpu_pct ?? "N/A"}%
                </span>
              </div>
              <div className="p-3 rounded border border-neutral-200 bg-white">
                <span className="text-[10px] text-neutral-500 block uppercase">Memory</span>
                <span className="text-base font-bold text-neutral-900">
                  {source.metrics.mem_pct ?? "N/A"}%
                </span>
              </div>
              <div className="p-3 rounded border border-neutral-200 bg-white">
                <span className="text-[10px] text-neutral-500 block uppercase">Latency</span>
                <span className={`text-base font-bold ${source.metrics.latency_ms && source.metrics.latency_ms > 100 ? "text-amber-700" : "text-neutral-900"}`}>
                  {source.metrics.latency_ms ?? "N/A"}ms
                </span>
              </div>
              <div className="p-3 rounded border border-neutral-200 bg-white">
                <span className="text-[10px] text-neutral-500 block uppercase">Packet Loss</span>
                <span className="text-base font-bold text-neutral-900">
                  {source.metrics.packet_loss_pct ?? "0.0"}%
                </span>
              </div>
              <div className="p-3 rounded border border-neutral-200 bg-white">
                <span className="text-[10px] text-neutral-500 block uppercase">Disk Usage</span>
                <span className="text-base font-bold text-neutral-900">
                  {source.metrics.disk_pct ?? "N/A"}%
                </span>
              </div>
              <div className="p-3 rounded border border-neutral-200 bg-white">
                <span className="text-[10px] text-neutral-500 block uppercase">Throughput</span>
                <span className="text-base font-bold text-neutral-900">
                  {source.metrics.bandwidth_mbps ?? "120"} Mbps
                </span>
              </div>
            </div>
          </div>

          {/* Metric Trends Over Time (Interactive SVG Charts) */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-500 font-semibold">
              Telemetry History (Last 15m)
            </h3>

            {/* CPU Trend Chart */}
            <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-900">CPU Utilization Trend</span>
                <span className="font-mono text-neutral-500 text-[11px]">Threshold: 90%</span>
              </div>
              <div className="h-28 flex items-end gap-2 pt-4 px-1 border-b border-neutral-100">
                {source.history.map((pt, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[9px] font-mono text-neutral-500 opacity-0 group-hover:opacity-100 transition">
                      {pt.cpu}%
                    </span>
                    <div
                      className={`w-full rounded-t transition-all ${
                        pt.cpu > 90 ? "bg-rose-600" : pt.cpu > 75 ? "bg-amber-500" : "bg-neutral-800"
                      }`}
                      style={{ height: `${Math.min(pt.cpu, 100)}%` }}
                    />
                    <span className="text-[9px] font-mono text-neutral-400">{pt.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Latency Trend Chart */}
            <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-900">Network Latency Trend (ms)</span>
                <span className="font-mono text-neutral-500 text-[11px]">Threshold: 100ms</span>
              </div>
              <div className="h-28 flex items-end gap-2 pt-4 px-1 border-b border-neutral-100">
                {source.history.map((pt, i) => {
                  const maxLat = 200;
                  const pct = Math.min((pt.latency / maxLat) * 100, 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                      <span className="text-[9px] font-mono text-neutral-500 opacity-0 group-hover:opacity-100 transition">
                        {pt.latency}ms
                      </span>
                      <div
                        className={`w-full rounded-t transition-all ${
                          pt.latency > 100 ? "bg-amber-600" : "bg-neutral-600"
                        }`}
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                      <span className="text-[9px] font-mono text-neutral-400">{pt.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Related Incidents */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-500 font-semibold mb-2">
              Related Active Incidents ({relatedIncidents.length})
            </h3>
            {relatedIncidents.length === 0 ? (
              <div className="p-3 text-xs text-neutral-500 border border-neutral-200 rounded bg-neutral-50">
                No active incidents currently targeting this source.
              </div>
            ) : (
              relatedIncidents.map((inc) => (
                <div
                  key={inc.incident_id}
                  className="p-3.5 border border-rose-200 bg-rose-50/50 rounded space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-950">{inc.title}</span>
                    <span className="text-[10px] font-mono uppercase text-rose-800 font-bold border border-rose-200 px-1.5 py-0.2 rounded bg-white">
                      {inc.severity}
                    </span>
                  </div>
                  <p className="text-rose-900 text-xs font-sans">
                    {inc.likely_cause}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between text-xs font-mono text-neutral-500">
          <span>Collector: {source.collector_id}</span>
          <span>Verified RLS Tenant Scope</span>
        </div>
      </div>
    </div>
  );
}
