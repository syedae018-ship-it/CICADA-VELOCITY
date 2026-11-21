"use client";

import React from "react";
import { Radio } from "lucide-react";
import { CollectorNode, MonitoredSource } from "@/types";

export const PROM_COLLECTOR_ID = "c_prom01";
export const PROM_HOST = "prometheus.demo.prometheus.io";

function ago(iso?: string): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

/** Small "Prometheus" tag for a source that came in through the bridge. */
export function PromTag() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#fff1e8] text-[#b4441a] text-[10px] font-semibold">
      <Radio className="w-3 h-3" /> Prometheus
    </span>
  );
}

/** Shows whether live Prometheus demo data is flowing in, and how much. */
export default function LiveFeedBanner({
  sources,
  collectors,
  onOpen,
}: {
  sources: MonitoredSource[];
  collectors: CollectorNode[];
  onOpen?: () => void;
}) {
  const bridge = collectors.find((c) => c.collector_id === PROM_COLLECTOR_ID);
  const promSources = sources.filter((s) => s.collector_id === PROM_COLLECTOR_ID);
  const fresh = !!bridge?.last_seen_utc && Date.now() - new Date(bridge.last_seen_utc).getTime() < 60_000;
  const live = bridge?.status === "online" && fresh;
  const hosts = promSources.filter((s) => s.source_type === "server").length;
  const apps = promSources.filter((s) => s.source_type === "app").length;

  return (
    <div className="card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span
          className={`relative h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${
            live ? "bg-[#fff1e8] text-[#b4441a]" : "bg-canvas-deep text-ink-muted"
          }`}
        >
          <Radio className="w-5 h-5" />
          {live && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white animate-pulse" />}
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink">
            {live ? "Live data from Prometheus" : "Prometheus feed not connected"}
          </div>
          <div className="text-[12px] text-ink-soft truncate">
            {live
              ? `${PROM_HOST} · ${hosts} host${hosts === 1 ? "" : "s"}, ${apps} service${apps === 1 ? "" : "s"} · updated ${ago(bridge?.last_seen_utc)}`
              : bridge
                ? `Last data ${ago(bridge.last_seen_utc)}. Start it: .venv/bin/python -m demo.prometheus_bridge`
                : "Start it: .venv/bin/python -m demo.prometheus_bridge"}
          </div>
        </div>
      </div>
      {onOpen && (
        <button
          onClick={onOpen}
          className="self-start sm:self-auto px-3.5 py-2 rounded-full text-[12px] font-semibold border border-hairline hover:border-brand-700 hover:text-brand-800 transition-colors"
        >
          View sources
        </button>
      )}
    </div>
  );
}
