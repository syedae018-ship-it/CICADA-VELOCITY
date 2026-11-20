"use client";

import React, { useState, useMemo } from "react";
import {
  History,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
} from "lucide-react";
import { HealthHistoryRecord, HealthState } from "@/types";

interface HistoryViewProps {
  history: HealthHistoryRecord[];
}

export default function HistoryView({ history }: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterState, setFilterState] = useState<string>("all");

  const stats = useMemo(() => {
    const total = history.length;
    const degraded = history.filter(
      (h) => h.state === "poor" || h.state === "fair"
    ).length;
    const recovered = history.filter(
      (h) =>
        (h.prev_state === "poor" || h.prev_state === "fair") &&
        (h.state === "good" || h.state === "excellent")
    ).length;
    const uniqueEntities = new Set(history.map((h) => h.entity_name)).size;

    // Distribution
    const counts = { excellent: 0, good: 0, fair: 0, poor: 0 };
    history.forEach((h) => {
      if (counts[h.state] !== undefined) counts[h.state]++;
    });

    return { total, degraded, recovered, uniqueEntities, counts };
  }, [history]);

  const filtered = useMemo(() => {
    return history.filter((h) => {
      if (filterState !== "all" && h.state !== filterState) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesName = h.entity_name.toLowerCase().includes(q);
        const matchesReason = h.reason.toLowerCase().includes(q);
        const matchesType = h.entity_type.toLowerCase().includes(q);
        return matchesName || matchesReason || matchesType;
      }
      return true;
    });
  }, [history, filterState, searchQuery]);

  const stateBadge = (state: HealthState) => {
    switch (state) {
      case "excellent":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#bff09c]/30 text-[#0a3a1e] border border-[#bff09c]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#104f2a]" />
            EXCELLENT
          </span>
        );
      case "good":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            GOOD
          </span>
        );
      case "fair":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            FAIR
          </span>
        );
      case "poor":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-rose-50 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            POOR
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Consistent Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[36px] font-bold tracking-[-0.03em] text-[#0b1210] leading-tight">
              State Transition History
            </h1>
            <span className="chip text-[12px] font-medium bg-[#bff09c]/30 text-[#0a3a1e] border border-[#bff09c]">
              Immutable Audit
            </span>
          </div>
          <p className="text-sm text-[#5a6260] mt-1">
            Historical health state transitions, crossed operational thresholds, and root causal audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#0b1210]/10 text-xs text-[#5a6260]">
            <History className="w-3.5 h-3.5 text-[#104f2a]" />
            <span className="font-mono text-[#0b1210] font-semibold">{filtered.length}</span> of {history.length} Transitions
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-[#5a6260] font-medium">Logged Transitions</div>
          <div className="text-2xl font-bold text-[#0b1210] mt-1 font-mono">{stats.total}</div>
          <div className="text-[11px] text-[#5a6260] mt-0.5">Recorded across lifecycle</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[#104f2a] font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Healthy Recoveries
          </div>
          <div className="text-2xl font-bold text-[#104f2a] mt-1 font-mono">{stats.recovered}</div>
          <div className="text-[11px] text-[#5a6260] mt-0.5">Restored to Good / Excellent</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Degraded Events
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1 font-mono">{stats.degraded}</div>
          <div className="text-[11px] text-[#5a6260] mt-0.5">Fell to Fair or Poor status</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[#5a6260] font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Distinct Entities
          </div>
          <div className="text-2xl font-bold text-[#0b1210] mt-1 font-mono">{stats.uniqueEntities}</div>
          <div className="text-[11px] text-[#5a6260] mt-0.5">Nodes, pods & endpoints</div>
        </div>
      </div>

      {/* Visual Health Distribution Bar */}
      {stats.total > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#0b1210]">Historical State Distribution</span>
            <span className="text-[#5a6260] font-mono">{stats.total} total observations</span>
          </div>

          <div className="w-full h-3 rounded-full bg-neutral-100 overflow-hidden flex">
            {stats.counts.excellent > 0 && (
              <div
                style={{ width: `${(stats.counts.excellent / stats.total) * 100}%` }}
                className="bg-[#104f2a] h-full"
                title={`Excellent: ${stats.counts.excellent}`}
              />
            )}
            {stats.counts.good > 0 && (
              <div
                style={{ width: `${(stats.counts.good / stats.total) * 100}%` }}
                className="bg-[#bff09c] h-full"
                title={`Good: ${stats.counts.good}`}
              />
            )}
            {stats.counts.fair > 0 && (
              <div
                style={{ width: `${(stats.counts.fair / stats.total) * 100}%` }}
                className="bg-amber-400 h-full"
                title={`Fair: ${stats.counts.fair}`}
              />
            )}
            {stats.counts.poor > 0 && (
              <div
                style={{ width: `${(stats.counts.poor / stats.total) * 100}%` }}
                className="bg-rose-500 h-full"
                title={`Poor: ${stats.counts.poor}`}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#5a6260] pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#104f2a]" />
              <span>Excellent: {stats.counts.excellent} ({Math.round((stats.counts.excellent / stats.total) * 100 || 0)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#bff09c]" />
              <span>Good: {stats.counts.good} ({Math.round((stats.counts.good / stats.total) * 100 || 0)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Fair: {stats.counts.fair} ({Math.round((stats.counts.fair / stats.total) * 100 || 0)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Poor: {stats.counts.poor} ({Math.round((stats.counts.poor / stats.total) * 100 || 0)}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#5a6260] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by entity name, type, or rule reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f4f5ef] border border-[#0b1210]/10 rounded-full pl-9 pr-4 py-2 text-xs text-[#0b1210] placeholder-[#5a6260]/60 focus:outline-none focus:border-[#104f2a] transition"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#f4f5ef] p-1 rounded-full border border-[#0b1210]/5 text-xs">
            <span className="text-[11px] font-medium text-[#5a6260] px-2.5">Target State:</span>
            {["all", "excellent", "good", "fair", "poor"].map((st) => (
              <button
                key={st}
                onClick={() => setFilterState(st)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${
                  filterState === st
                    ? "bg-[#104f2a] text-white shadow-xs"
                    : "text-[#5a6260] hover:text-[#0b1210]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Polished Table Card */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[#5a6260] space-y-2">
            <Filter className="w-8 h-8 mx-auto text-[#5a6260]/40" />
            <div className="text-sm font-semibold text-[#0b1210]">No transition records found</div>
            <div className="text-xs">Try clearing search filters or selecting All target states.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#f4f5ef]/80 border-b border-[#0b1210]/5 text-[#5a6260] text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5 font-semibold">Monitored Entity</th>
                  <th className="py-3.5 px-4 font-semibold">Entity Type</th>
                  <th className="py-3.5 px-4 font-semibold">State Transition Flow</th>
                  <th className="py-3.5 px-4 font-semibold">Recorded Reason & Crossed Threshold</th>
                  <th className="py-3.5 px-5 font-semibold text-right">Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0b1210]/5">
                {filtered.map((h) => (
                  <tr key={h.id} className="hover:bg-[#f4f5ef]/50 transition duration-150">
                    <td className="py-4 px-5 font-semibold text-[#0b1210]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#104f2a]" />
                        <span>{h.entity_name}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-[#5a6260]">
                      <span className="chip text-[11px] bg-[#f4f5ef] border border-[#0b1210]/5 capitalize">
                        {h.entity_type}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {stateBadge(h.prev_state)}
                        <ArrowRight className="w-3.5 h-3.5 text-[#5a6260]/60" />
                        {stateBadge(h.state)}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-[#5a6260] font-sans text-xs max-w-md leading-relaxed">
                      {h.reason}
                    </td>

                    <td className="py-4 px-5 text-[#5a6260] text-[11px] text-right font-mono">
                      {h.at_utc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
