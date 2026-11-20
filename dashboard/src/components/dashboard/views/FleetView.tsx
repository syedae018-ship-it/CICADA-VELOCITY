"use client";

import React from "react";
import { CollectorNode } from "@/types";

interface FleetViewProps {
  collectors: CollectorNode[];
}

export default function FleetView({ collectors }: FleetViewProps) {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 uppercase tracking-tight">
            Collector Fleet (Tier 1 Nodes)
          </h1>
          <p className="text-xs text-neutral-500">
            Local collector instances operating inside customer network perimeter
          </p>
        </div>
        <div className="text-xs font-mono text-neutral-600">
          {collectors.filter((c) => c.status === "online").length}/{collectors.length} ONLINE
        </div>
      </div>

      <div className="border border-neutral-200 bg-white rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 text-[10px] uppercase tracking-wider">
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
                <tr key={c.collector_id} className="hover:bg-neutral-50/70 transition">
                  <td className="py-3.5 px-4 font-semibold text-neutral-900">
                    {c.collector_id}
                    <span className="text-[10px] text-neutral-500 block font-normal">
                      v{c.version} · {Math.floor(c.uptime_s / 60)}m uptime
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-neutral-700">
                    {c.region}
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        c.status === "online"
                          ? "border-neutral-200 bg-neutral-100 text-neutral-800"
                          : "border-rose-300 bg-rose-50 text-rose-800"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        c.buffer_depth > 0
                          ? "border border-amber-300 bg-amber-50 text-amber-800 font-bold"
                          : "text-neutral-500"
                      }`}
                    >
                      {c.buffer_depth} items {c.buffer_depth > 0 && "(Buffered)"}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-neutral-700">
                    {c.cpu_pct}% / {c.mem_pct}%
                  </td>

                  <td className="py-3.5 px-4 text-neutral-500">
                    {c.config_hash}
                  </td>

                  <td className="py-3.5 px-4 text-neutral-500">
                    {c.last_seen_utc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-3 border border-neutral-200 bg-neutral-50 rounded text-xs font-mono text-neutral-600 flex items-center justify-between">
        <span>HMAC-SHA256 signature verification active on all collector requests</span>
        <span className="text-neutral-900 font-semibold">REPLAY WINDOW: 300s</span>
      </div>
    </div>
  );
}
