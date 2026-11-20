"use client";

import React, { useState, useMemo } from "react";
import {
  Layers,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Server,
  Wifi,
  Cpu,
  Lock,
  Database,
  Clock,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import { MonitoredSource, HealthState, SourceType } from "@/types";

interface SourcesViewProps {
  sources: MonitoredSource[];
  onSelectSource: (source: MonitoredSource) => void;
}

type SortField = "service" | "cpu" | "mem" | "latency" | "state";
type SortOrder = "asc" | "desc";

export default function SourcesView({ sources, onSelectSource }: SourcesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<HealthState | "all">("all");
  const [typeFilter, setTypeFilter] = useState<SourceType | "all">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("service");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Filter & Sort
  const filteredSources = useMemo(() => {
    return sources
      .filter((s) => {
        const matchesSearch =
          s.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.source_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.reason.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesState = stateFilter === "all" || s.state === stateFilter;
        const matchesType = typeFilter === "all" || s.source_type === typeFilter;
        const matchesRegion = regionFilter === "all" || s.region === regionFilter;
        return matchesSearch && matchesState && matchesType && matchesRegion;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortField === "service") comp = a.service.localeCompare(b.service);
        else if (sortField === "cpu") comp = (a.metrics.cpu_pct ?? 0) - (b.metrics.cpu_pct ?? 0);
        else if (sortField === "mem") comp = (a.metrics.mem_pct ?? 0) - (b.metrics.mem_pct ?? 0);
        else if (sortField === "latency") comp = (a.metrics.latency_ms ?? 0) - (b.metrics.latency_ms ?? 0);
        else if (sortField === "state") comp = a.state.localeCompare(b.state);

        return sortOrder === "asc" ? comp : -comp;
      });
  }, [sources, searchTerm, stateFilter, typeFilter, regionFilter, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const stateBadge = (state: HealthState) => {
    switch (state) {
      case "excellent":
        return <span className="border border-neutral-200 bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">EXCELLENT</span>;
      case "good":
        return <span className="border border-neutral-200 bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">GOOD</span>;
      case "fair":
        return <span className="border border-amber-300 bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">FAIR</span>;
      case "poor":
        return <span className="border border-rose-300 bg-rose-50 text-rose-800 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">POOR</span>;
    }
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-neutral-200 gap-2">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 uppercase tracking-tight">
            Monitored Infrastructure Sources
          </h1>
          <p className="text-xs text-neutral-500">
            Realtime workload metrics, health classifications, and pseudonymous telemetry metadata
          </p>
        </div>
        <div className="text-xs font-mono text-neutral-600">
          Showing {filteredSources.length} of {sources.length} Total Sources
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="border border-neutral-200 bg-white p-3.5 rounded-lg shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-neutral-200 bg-neutral-50 w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder="Search service, source ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none w-full"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Health Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500 text-[11px] font-medium">Status:</span>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as any)}
              className="bg-neutral-50 border border-neutral-200 px-2.5 py-1 rounded text-xs text-neutral-800 font-mono focus:outline-none"
            >
              <option value="all">All States</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500 text-[11px] font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-neutral-50 border border-neutral-200 px-2.5 py-1 rounded text-xs text-neutral-800 font-mono focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="server">Server</option>
              <option value="network">Network</option>
              <option value="security">Security</option>
              <option value="app">Application</option>
            </select>
          </div>

          {/* Region Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500 text-[11px] font-medium">Region:</span>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 px-2.5 py-1 rounded text-xs text-neutral-800 font-mono focus:outline-none"
            >
              <option value="all">All Regions</option>
              <option value="ap-south-1">ap-south-1</option>
              <option value="eu-west-1">eu-west-1</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Sources Table */}
      <div className="border border-neutral-200 bg-white rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 text-[10px] uppercase tracking-wider">
              <tr>
                <th
                  onClick={() => toggleSort("service")}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-neutral-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Source & Service</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 font-semibold">Category / Region</th>
                <th
                  onClick={() => toggleSort("state")}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-neutral-900"
                >
                  <div className="flex items-center gap-1">
                    <span>State</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("cpu")}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-neutral-900"
                >
                  <div className="flex items-center gap-1">
                    <span>CPU %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("mem")}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-neutral-900"
                >
                  <div className="flex items-center gap-1">
                    <span>RAM %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("latency")}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-neutral-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Latency</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 font-semibold">Packet Loss</th>
                <th className="py-3 px-4 font-semibold">Last Heartbeat</th>
                <th className="py-3 px-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredSources.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-500">
                    No sources match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredSources.map((s) => (
                  <tr
                    key={s.source_id}
                    onClick={() => onSelectSource(s)}
                    className="hover:bg-neutral-50/70 transition cursor-pointer group"
                  >
                    {/* Service Name & Pseudonym ID */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-neutral-900 font-sans text-xs">
                        {s.service}
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {s.source_id}
                      </span>
                    </td>

                    {/* Category & Region */}
                    <td className="py-3.5 px-4 text-neutral-700">
                      <span className="uppercase text-[10px] border border-neutral-200 bg-neutral-50 px-1.5 py-0.2 rounded mr-1.5">
                        {s.source_type}
                      </span>
                      <span className="text-[11px] text-neutral-500">{s.region}</span>
                    </td>

                    {/* State */}
                    <td className="py-3.5 px-4">
                      {stateBadge(s.state)}
                    </td>

                    {/* CPU */}
                    <td className="py-3.5 px-4">
                      <span className={s.metrics.cpu_pct && s.metrics.cpu_pct > 90 ? "text-rose-600 font-bold" : "text-neutral-900"}>
                        {s.metrics.cpu_pct !== undefined ? `${s.metrics.cpu_pct}%` : "—"}
                      </span>
                    </td>

                    {/* Memory */}
                    <td className="py-3.5 px-4 text-neutral-900">
                      {s.metrics.mem_pct !== undefined ? `${s.metrics.mem_pct}%` : "—"}
                    </td>

                    {/* Latency */}
                    <td className="py-3.5 px-4">
                      <span className={s.metrics.latency_ms && s.metrics.latency_ms > 100 ? "text-amber-700 font-bold" : "text-neutral-900"}>
                        {s.metrics.latency_ms !== undefined ? `${s.metrics.latency_ms}ms` : "—"}
                      </span>
                    </td>

                    {/* Packet Loss */}
                    <td className="py-3.5 px-4 text-neutral-800">
                      {s.metrics.packet_loss_pct !== undefined ? `${s.metrics.packet_loss_pct}%` : "0.0%"}
                    </td>

                    {/* Heartbeat */}
                    <td className="py-3.5 px-4 text-neutral-500 text-[11px]">
                      {s.last_heartbeat_utc.slice(11, 19)} UTC
                    </td>

                    {/* Click row view */}
                    <td className="py-3.5 px-4 text-right">
                      <button className="text-xs font-semibold text-neutral-600 group-hover:text-neutral-900 transition flex items-center justify-end gap-1 w-full">
                        <span>Inspect</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
