"use client";

import React from "react";
import { HealthHistoryRecord, HealthState } from "@/types";

interface HistoryViewProps {
  history: HealthHistoryRecord[];
}

export default function HistoryView({ history }: HistoryViewProps) {
  const stateBadge = (state: HealthState) => {
    switch (state) {
      case "excellent":
        return <span className="border border-neutral-200 bg-neutral-100 text-neutral-800 px-2 py-0.2 rounded text-[10px] font-mono font-bold uppercase">EXCELLENT</span>;
      case "good":
        return <span className="border border-neutral-200 bg-neutral-100 text-neutral-700 px-2 py-0.2 rounded text-[10px] font-mono font-bold uppercase">GOOD</span>;
      case "fair":
        return <span className="border border-amber-300 bg-amber-50 text-amber-800 px-2 py-0.2 rounded text-[10px] font-mono font-bold uppercase">FAIR</span>;
      case "poor":
        return <span className="border border-rose-300 bg-rose-50 text-rose-800 px-2 py-0.2 rounded text-[10px] font-mono font-bold uppercase">POOR</span>;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 uppercase tracking-tight">
            Health State Transition History
          </h1>
          <p className="text-xs text-neutral-500">
            Immutable log of state transitions, thresholds crossed, and recorded reasons
          </p>
        </div>
        <div className="text-xs font-mono text-neutral-600">
          {history.length} TRANSITIONS RECORDED
        </div>
      </div>

      <div className="border border-neutral-200 bg-white rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Entity</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">State Transition</th>
                <th className="py-3 px-4 font-semibold">Recorded Reason / Rule</th>
                <th className="py-3 px-4 font-semibold">Timestamp (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-neutral-50/70 transition">
                  <td className="py-3.5 px-4 font-semibold text-neutral-900">
                    {h.entity_name}
                  </td>

                  <td className="py-3.5 px-4 text-neutral-600 capitalize">
                    {h.entity_type}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      {stateBadge(h.prev_state)}
                      <span className="text-neutral-400">&rarr;</span>
                      {stateBadge(h.state)}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-neutral-700 font-sans text-xs max-w-md">
                    {h.reason}
                  </td>

                  <td className="py-3.5 px-4 text-neutral-500 text-[11px]">
                    {h.at_utc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
