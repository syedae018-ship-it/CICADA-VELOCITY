"use client";

import React, { useState } from "react";
import {
  Clock,
  Server,
  AlertTriangle,
  CheckCircle2,
  Send,
  Zap,
  Activity,
  Filter,
} from "lucide-react";
import { ActivityTimelineEvent, TenantId } from "@/types";

interface TimelineViewProps {
  tenantId: TenantId;
  events: ActivityTimelineEvent[];
}

export default function TimelineView({ tenantId, events }: TimelineViewProps) {
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = events.filter((e) => {
    if (filterType === "all") return true;
    return e.event_type === filterType;
  });

  const getEventBadge = (type: string, severity: string) => {
    switch (severity) {
      case "critical":
        return <span className="border border-rose-300 bg-rose-50 text-rose-800 text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">Critical</span>;
      case "warning":
        return <span className="border border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">Warning</span>;
      case "success":
        return <span className="border border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">Success</span>;
      default:
        return <span className="border border-neutral-200 bg-neutral-100 text-neutral-800 text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">Info</span>;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-neutral-200 gap-2">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 uppercase tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-neutral-700" />
            Activity Timeline & Event Stream
          </h1>
          <p className="text-xs text-neutral-500">
            Chronological audit of system events, cluster heartbeats, and anomaly detections
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-neutral-500">Filter:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-neutral-50 border border-neutral-200 px-2.5 py-1 rounded text-neutral-800 focus:outline-none"
          >
            <option value="all">All Events</option>
            <option value="anomaly_detected">Anomalies</option>
            <option value="incident_created">Incidents</option>
            <option value="metadata_transmitted">Metadata Egress</option>
            <option value="collector_connected">Collector Events</option>
          </select>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="border border-neutral-200 bg-white rounded-lg p-6 shadow-xs">
        <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
          {filtered.map((item) => (
            <div key={item.id} className="relative group">
              {/* Dot */}
              <div
                className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                  item.severity === "critical"
                    ? "bg-rose-600"
                    : item.severity === "warning"
                    ? "bg-amber-500"
                    : item.severity === "success"
                    ? "bg-emerald-600"
                    : "bg-neutral-700"
                }`}
              />

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-neutral-900 font-sans">
                    {item.title}
                  </span>
                  {getEventBadge(item.event_type, item.severity)}
                  <span className="text-[11px] font-mono text-neutral-500 ml-auto">
                    {item.timestamp_utc} (UTC)
                  </span>
                </div>

                <p className="text-xs text-neutral-700 font-sans leading-relaxed">
                  {item.description}
                </p>

                <div className="text-[10px] font-mono text-neutral-400">
                  Target Entity: {item.entity_id}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
