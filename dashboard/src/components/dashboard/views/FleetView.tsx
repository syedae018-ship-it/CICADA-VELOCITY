"use client";

import React from "react";
import {
  Radar,
  MapPin,
  Zap,
  Inbox,
  Cpu,
  MemoryStick,
  ShieldCheck,
  Clock,
  WifiOff,
  Wifi,
  CircleSlash,
} from "lucide-react";
import { CollectorNode } from "@/types";

interface FleetViewProps {
  collectors: CollectorNode[];
}

function timeSince(iso?: string) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FleetView({ collectors }: FleetViewProps) {
  const online = collectors.filter((c) => c.status === "online").length;
  const offline = collectors.length - online;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-ink">Collector fleet</h1>
          <p className="text-[14px] text-ink-soft mt-2">Your watchers, one per customer environment.</p>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 h-12 px-4 rounded-full bg-brand-chip border border-[#d5e6b4]">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-[13px] font-semibold text-brand-800">{online} online</span>
          </div>
          {offline > 0 && (
            <div className="flex items-center gap-2.5 h-12 px-4 rounded-full bg-danger-50 border border-danger-100">
              <span className="h-2 w-2 rounded-full bg-danger-700" />
              <span className="text-[13px] font-semibold text-danger-700">{offline} offline</span>
            </div>
          )}
        </div>
      </div>

      {collectors.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-ink-muted">
          <CircleSlash className="w-10 h-10 icon-sharp" />
          <div className="text-[14px]">No collectors registered yet.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {collectors.map((c) => {
            const isOnline = c.status === "online";
            const isPoor = c.state === "poor";
            const isBuffering = (c.buffer_depth ?? 0) > 0;
            // Map region id → short label
            const regionLabel =
              c.region === "ap-south-1" ? "Mumbai" : c.region === "eu-west-1" ? "Frankfurt" : c.region === "us-east-1" ? "Virginia" : c.region;

            return (
              <div key={c.collector_id} className="card card-hover p-6">
                {/* Top: big icon + name + status */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className="relative h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: isOnline
                        ? "linear-gradient(135deg, #176534 0%, #0a3a1e 100%)"
                        : "linear-gradient(135deg, #8a3a1e 0%, #4a1f0e 100%)" }}
                    >
                      {isOnline ? (
                        <Radar className="w-6 h-6 text-brand-mint icon-sharp" />
                      ) : (
                        <WifiOff className="w-6 h-6 text-rose-200 icon-sharp" />
                      )}
                      {/* Pulsing status dot */}
                      <span
                        className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white ${
                          isOnline ? "bg-brand-500 animate-pulse" : "bg-danger-700"
                        }`}
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[18px] font-bold text-ink truncate">{c.collector_id}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5 font-mono truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 icon-sharp" />
                        {regionLabel}
                      </div>
                    </div>
                  </div>

                  {/* Status label — one word */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${
                      isOnline
                        ? "bg-brand-chip text-brand-800 border border-[#d5e6b4]"
                        : "bg-danger-50 text-danger-700 border border-danger-100"
                    }`}
                  >
                    {isOnline ? <Wifi className="w-3.5 h-3.5 icon-sharp" /> : <WifiOff className="w-3.5 h-3.5 icon-sharp" />}
                    {isOnline ? "Live" : "Offline"}
                  </span>
                </div>

                {/* Headline banner — buffer / health narrative */}
                <div
                  className={`mt-5 px-4 py-3 rounded-2xl text-[12.5px] font-medium flex items-center gap-3 ${
                    isPoor
                      ? "bg-danger-50 text-danger-700"
                      : isBuffering
                      ? "bg-warn-50 text-warn-700"
                      : "bg-canvas-deep/40 text-ink-soft"
                  }`}
                >
                  {isPoor ? (
                    <>
                      <WifiOff className="w-4 h-4 icon-sharp" />
                      Waiting to reconnect
                    </>
                  ) : isBuffering ? (
                    <>
                      <Inbox className="w-4 h-4 icon-sharp" />
                      Holding {c.buffer_depth} payload{c.buffer_depth === 1 ? "" : "s"} locally
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 icon-sharp text-brand-700" />
                      Streaming securely to SaaS
                    </>
                  )}
                </div>

                {/* Stats grid — 4 pill tiles */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <StatTile Icon={Clock} label="Last seen" value={timeSince(c.last_seen_utc)} />
                  <StatTile Icon={Zap} label="Uptime" value={fmtUptime(c.uptime_s ?? 0)} />
                  <StatTile Icon={Cpu} label="CPU" value={c.cpu_pct != null ? `${Math.round(c.cpu_pct)}%` : "—"} />
                  <StatTile Icon={MemoryStick} label="Memory" value={c.mem_pct != null ? `${Math.round(c.mem_pct)}%` : "—"} />
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between text-[11px] font-mono text-ink-muted">
                  <span>v{c.version || "—"}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 icon-sharp text-brand-700" />
                    HMAC verified
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trust badge banner — single-line explainer, mostly icon */}
      <div className="card p-5 flex items-center gap-4 bg-canvas-deep/40 border border-hairline">
        <span className="h-10 w-10 rounded-full bg-brand-chip border border-[#d5e6b4] flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-brand-800 icon-sharp" />
        </span>
        <div className="text-[13px] text-ink-soft">
          Every collector request is signed with <span className="font-mono font-semibold text-ink">HMAC-SHA256</span> and a 300 s replay window.
        </div>
      </div>
    </div>
  );
}

function fmtUptime(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function StatTile({
  Icon,
  label,
  value,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 h-14 px-3.5 rounded-xl bg-canvas-deep/40 border border-hairline/60">
      <Icon className="w-4 h-4 icon-sharp text-ink-muted shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
        <div className="text-[13px] font-semibold text-ink leading-tight">{value}</div>
      </div>
    </div>
  );
}
