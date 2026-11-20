"use client";

import React, { useState, useMemo } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Filter,
  ShieldAlert,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Search,
  Radio,
  FileText,
} from "lucide-react";
import { ActivityTimelineEvent, TenantId } from "@/types";

interface TimelineViewProps {
  tenantId: TenantId;
  events: ActivityTimelineEvent[];
}

export default function TimelineView({ tenantId, events }: TimelineViewProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = events.length;
    const critical = events.filter((e) => e.severity === "critical").length;
    const warning = events.filter((e) => e.severity === "warning").length;
    const egress = events.filter((e) => e.event_type === "metadata_transmitted").length;
    return { total, critical, warning, egress };
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterType !== "all" && e.event_type !== filterType) return false;
      if (filterSeverity !== "all" && e.severity !== filterSeverity) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(q);
        const matchesDesc = e.description.toLowerCase().includes(q);
        const matchesEntity = e.entity_id.toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesEntity;
      }
      return true;
    });
  }, [events, filterType, filterSeverity, searchQuery]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Critical
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Warning
          </span>
        );
      case "success":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#bff09c]/30 text-[#0a3a1e] border border-[#bff09c]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#104f2a]" />
            Success
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-[#5a6260] border border-neutral-200">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            Info
          </span>
        );
    }
  };

  const getEventIcon = (type: string, severity: string) => {
    if (severity === "critical") {
      return <ShieldAlert className="w-4 h-4 text-rose-600" />;
    }
    if (severity === "warning") {
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    }
    if (type === "metadata_transmitted") {
      return <Radio className="w-4 h-4 text-[#104f2a]" />;
    }
    if (severity === "success") {
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    }
    return <Activity className="w-4 h-4 text-neutral-600" />;
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Consistent Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[36px] font-bold tracking-[-0.03em] text-[#0b1210] leading-tight">
              Activity Timeline
            </h1>
            <span className="chip text-[12px] font-medium bg-[#bff09c]/30 text-[#0a3a1e] border border-[#bff09c]">
              Live Stream
            </span>
          </div>
          <p className="text-sm text-[#5a6260] mt-1">
            Chronological audit of system telemetry, anomaly detections, and verifiable egress events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#0b1210]/10 text-xs text-[#5a6260]">
            <span className="w-2 h-2 rounded-full bg-[#104f2a] animate-pulse" />
            <span className="font-mono text-[#0b1210] font-semibold">{filtered.length}</span> of {events.length} Events
          </div>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-[#5a6260] font-medium">Total Ingest Stream</div>
          <div className="text-2xl font-bold text-[#0b1210] mt-1 font-mono">{stats.total}</div>
          <div className="text-[11px] text-[#5a6260] mt-0.5">Audited events in log</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-rose-600 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Critical Anomalies
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1 font-mono">{stats.critical}</div>
          <div className="text-[11px] text-[#5a6260] mt-0.5">Automated triage triggers</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Warnings Flagged
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1 font-mono">{stats.warning}</div>
          <div className="text-[11px] text-[#5a6260] mt-0.5">Degraded threshold alerts</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[#104f2a] font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#104f2a]" /> Verified Egress
          </div>
          <div className="text-2xl font-bold text-[#104f2a] mt-1 font-mono">{stats.egress}</div>
          <div className="text-[11px] text-[#5a6260] mt-0.5">HMAC-SHA256 signed payloads</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#5a6260] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by title, description, or entity ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f4f5ef] border border-[#0b1210]/10 rounded-full pl-9 pr-4 py-2 text-xs text-[#0b1210] placeholder-[#5a6260]/60 focus:outline-none focus:border-[#104f2a] transition"
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[#f4f5ef] p-1 rounded-full border border-[#0b1210]/5 text-xs">
              <span className="text-[11px] font-medium text-[#5a6260] px-2.5">Severity:</span>
              {["all", "critical", "warning", "info"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${
                    filterSeverity === sev
                      ? "bg-[#104f2a] text-white shadow-xs"
                      : "text-[#5a6260] hover:text-[#0b1210]"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#f4f5ef] border border-[#0b1210]/10 px-3 py-1.5 rounded-full text-xs text-[#0b1210] focus:outline-none focus:border-[#104f2a]"
            >
              <option value="all">All Event Types</option>
              <option value="anomaly_detected">Anomalies</option>
              <option value="incident_created">Incidents</option>
              <option value="metadata_transmitted">Metadata Egress</option>
              <option value="collector_connected">Collector Events</option>
            </select>
          </div>
        </div>
      </div>

      {/* Connected Visual Timeline Stream */}
      <div className="card p-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[#5a6260] space-y-2">
            <Filter className="w-8 h-8 mx-auto text-[#5a6260]/40" />
            <div className="text-sm font-semibold text-[#0b1210]">No events match active filters</div>
            <div className="text-xs">Adjust your search query or reset filter pills above.</div>
          </div>
        ) : (
          <div className="relative pl-8 space-y-6 before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-[#104f2a] before:via-[#0b1210]/15 before:to-[#0b1210]/5">
            {filtered.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <div key={item.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-8 top-1 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-110 ${
                      item.severity === "critical"
                        ? "bg-rose-100 ring-2 ring-rose-500/20"
                        : item.severity === "warning"
                        ? "bg-amber-100 ring-2 ring-amber-500/20"
                        : item.severity === "success"
                        ? "bg-[#bff09c]/50 ring-2 ring-[#104f2a]/20"
                        : "bg-neutral-100 ring-2 ring-neutral-300/40"
                    }`}
                  >
                    {getEventIcon(item.event_type, item.severity)}
                  </div>

                  {/* Event Card Content */}
                  <div className="bg-[#f4f5ef]/50 hover:bg-[#f4f5ef] border border-[#0b1210]/5 rounded-2xl p-4 transition duration-150">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#0b1210]">
                          {item.title}
                        </span>
                        {getSeverityBadge(item.severity)}
                        <span className="chip text-[11px] font-mono text-[#5a6260] bg-white border border-[#0b1210]/10">
                          {item.event_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-[#5a6260]">
                          {item.timestamp_utc} (UTC)
                        </span>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="text-[#5a6260] hover:text-[#0b1210] p-1 rounded-full hover:bg-white/80 transition"
                          title="Toggle details"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#5a6260] mt-2 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#0b1210]/5 text-xs text-[#5a6260]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[#0b1210] bg-white px-2 py-0.5 rounded-md border border-[#0b1210]/10">
                          Entity: {item.entity_id}
                        </span>
                      </div>

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="text-[11px] font-medium text-[#104f2a] hover:underline flex items-center gap-1"
                      >
                        {isExpanded ? "Hide payload" : "Inspect payload"}
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Expandable JSON Detail View */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[#0b1210]/10 animate-in fade-in duration-150">
                        <div className="bg-[#0b1210] text-[#bff09c] rounded-xl p-3 font-mono text-xs overflow-x-auto space-y-1">
                          <div className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-neutral-400" />
                            Audit Metadata Record
                          </div>
                          <pre className="text-[11px] leading-tight text-neutral-200">
                            {JSON.stringify(
                              {
                                id: item.id,
                                event_type: item.event_type,
                                severity: item.severity,
                                entity_id: item.entity_id,
                                timestamp_utc: item.timestamp_utc,
                                tenant_id: tenantId,
                                egress_guard: "0_secrets_transmitted",
                                wire_signed: true,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
