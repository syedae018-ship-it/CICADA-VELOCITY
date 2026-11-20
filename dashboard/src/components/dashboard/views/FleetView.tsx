"use client";

import React from "react";
import { CollectorNode } from "@/types";

interface FleetViewProps {
  collectors: CollectorNode[];
}

export default function FleetView({ collectors }: FleetViewProps) {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-hairline">
        <div>
          <h1 className="text-lg font-bold text-ink uppercase tracking-tight">
            Collector Fleet (Tier 1 Nodes)
          </h1>
          <p className="text-xs text-ink-soft">
            Local collector instances operating inside customer network perimeter
          </p>
        </div>
        <div className="text-xs font-mono text-ink-soft">
          {collectors.filter((c) => c.status === "online").length}/{collectors.length} ONLINE
        </div>
      </div>

      <div className="card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-canvas border-b border-hairline text-ink-soft text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Collector ID</th>
                <th className="py-3 px-4 font-semibold">Region</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Buffer Depth</th>
                <th className="py-3 px-4 font-semibold">CPU / Mem</th>
                <th className="py-3 px-4 font-semibold">Config Hash</th>
                <th className="py-3 px-4 font-semibold">Last Heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {collectors.map((c) => (
                <tr key={c.collector_id} className="hover:bg-canvas/70 transition">
                  <td className="py-3.5 px-4 font-semibold text-ink">
                    {c.collector_id}
                    <span className="text-[10px] text-ink-soft block font-normal">
                      v{c.version} · {Math.floor(c.uptime_s / 60)}m uptime
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-ink-soft">
                    {c.region}
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        c.status === "online"
                          ? "border-hairline bg-neutral-100 text-ink"
                          : "border-rose-200 bg-rose-50 text-rose-800"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        c.buffer_depth > 0
                          ? "border border-amber-200 bg-amber-50 text-amber-800 font-bold"
                          : "text-ink-soft"
                      }`}
                    >
                      {c.buffer_depth} items {c.buffer_depth > 0 && "(Buffered)"}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-ink-soft">
                    {c.cpu_pct}% / {c.mem_pct}%
                  </td>

                  <td className="py-3.5 px-4 text-ink-soft">
                    {c.config_hash}
                  </td>

                  <td className="py-3.5 px-4 text-ink-soft">
                    {c.last_seen_utc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-3 border border-hairline bg-canvas rounded text-xs font-mono text-ink-soft flex items-center justify-between">
        <span>HMAC-SHA256 signature verification active on all collector requests</span>
        <span className="text-ink font-semibold">REPLAY WINDOW: 300s</span>
      </div>
    </div>
  );
}
