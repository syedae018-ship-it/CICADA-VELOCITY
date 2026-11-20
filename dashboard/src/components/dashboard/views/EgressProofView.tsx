"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Fingerprint,
  Clock,
  Hash,
  Database,
  CircleSlash,
  ChevronRight,
} from "lucide-react";
import { EgressPayloadEntry, TenantId } from "@/types";

interface EgressProofViewProps {
  tenantId: TenantId;
  egressPayloads: EgressPayloadEntry[];
}

const resultMeta: Record<
  EgressPayloadEntry["result"],
  { chip: string; label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  delivered:     { chip: "bg-brand-chip text-brand-800 border border-[#d5e6b4]", label: "Delivered",  Icon: CheckCircle2 },
  duplicate_ack: { chip: "bg-canvas-deep/40 text-ink-soft border border-hairline", label: "Duplicate",  Icon: CheckCircle2 },
  buffered:      { chip: "bg-warn-50 text-warn-700 border border-warn-100",       label: "Buffered",   Icon: Clock },
  failed:        { chip: "bg-danger-50 text-danger-700 border border-danger-100", label: "Failed",     Icon: AlertTriangle },
};

function timeHHMMSS(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

export default function EgressProofView({ egressPayloads }: EgressProofViewProps) {
  const [selected, setSelected] = useState<EgressPayloadEntry | null>(egressPayloads[0] ?? null);
  const [copied, setCopied] = useState(false);

  // Keep selection fresh when the data array is refreshed
  React.useEffect(() => {
    if (egressPayloads.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !egressPayloads.find((p) => p.payload_id === selected.payload_id)) {
      setSelected(egressPayloads[0]);
    }
  }, [egressPayloads, selected]);

  const copyJson = (data: unknown) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const allMatch = egressPayloads.every((p) => p.matches_saas);
  const delivered = egressPayloads.filter((p) => p.matches_saas).length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="px-1">
        <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-ink">
          Egress proof
        </h1>
        <p className="text-[14px] text-ink-soft mt-2">
          Every payload that left Tier 1, byte-for-byte.
        </p>
      </div>

      {/* Hero summary strip */}
      <div
        className={`card p-5 flex items-center gap-4 ${
          allMatch ? "border border-[#d5e6b4] bg-brand-chip" : "border border-warn-100 bg-warn-50"
        }`}
      >
        <span
          className={`h-12 w-12 rounded-full flex items-center justify-center ${
            allMatch ? "bg-white border border-[#d5e6b4]" : "bg-white border border-warn-100"
          }`}
        >
          <ShieldCheck className={`w-6 h-6 icon-sharp ${allMatch ? "text-brand-800" : "text-warn-700"}`} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-ink">
            {allMatch ? "All payloads match SaaS" : "Some payloads still buffered"}
          </div>
          <div className="text-[12.5px] text-ink-soft">
            {delivered} of {egressPayloads.length} delivered · sha256 verified
          </div>
        </div>
      </div>

      {egressPayloads.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-ink-muted">
          <CircleSlash className="w-10 h-10 icon-sharp" />
          <div className="text-[14px]">No payloads sent yet.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Timeline list */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="flex items-center justify-between px-1 pb-1">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-muted">
                Recent payloads
              </h3>
              <span className="text-[11.5px] font-mono text-ink-muted">{egressPayloads.length} total</span>
            </div>
            <div className="max-h-[720px] overflow-y-auto space-y-2.5 pr-1">
              {egressPayloads.map((p) => {
                const r = resultMeta[p.result];
                const isSel = selected?.payload_id === p.payload_id;
                return (
                  <button
                    key={p.payload_id}
                    onClick={() => setSelected(p)}
                    className={`w-full card card-hover p-4 text-left border-2 transition ${
                      isSel ? "border-brand-800" : "border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="h-9 w-9 rounded-xl bg-canvas-deep/40 border border-hairline/60 flex items-center justify-center">
                          <Hash className="w-4 h-4 icon-sharp text-brand-800" />
                        </span>
                        <div>
                          <div className="text-[13px] font-semibold text-ink">#{p.seq}</div>
                          <div className="text-[10.5px] text-ink-muted font-mono truncate max-w-[180px]">
                            {p.payload_id.slice(0, 18)}…
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold ${r.chip}`}
                      >
                        <r.Icon className="w-3 h-3 icon-sharp" />
                        {r.label}
                      </span>
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-hairline/60 flex items-center justify-between text-[10.5px] font-mono text-ink-muted">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 icon-sharp" />
                        {timeHHMMSS(p.sent_at_utc)}
                      </span>
                      <span className="truncate ml-2">
                        {p.sha256 ? `${p.sha256.slice(0, 12)}…` : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected payload detail */}
          <div className="lg:col-span-7">
            {selected && (
              <div className="card p-6 sticky top-6">
                {/* Headline */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-10 w-10 rounded-xl bg-brand-chip border border-[#d5e6b4] flex items-center justify-center">
                      <Fingerprint className="w-5 h-5 text-brand-800 icon-sharp" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] text-ink-muted font-semibold uppercase tracking-wider">
                        Payload #{selected.seq}
                      </div>
                      <div className="text-[13px] text-ink font-mono truncate">{selected.payload_id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${resultMeta[selected.result].chip}`}
                    >
                      {React.createElement(resultMeta[selected.result].Icon, {
                        className: "w-3.5 h-3.5 icon-sharp",
                      })}
                      {resultMeta[selected.result].label}
                    </span>
                    <button
                      onClick={() => copyJson(selected.body)}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-hairline hover:border-brand-200 text-[12px] font-semibold text-ink-soft hover:text-ink transition"
                    >
                      <Copy className="w-3.5 h-3.5 icon-sharp" />
                      {copied ? "Copied" : "Copy JSON"}
                    </button>
                  </div>
                </div>

                {/* Mini stats */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <StatTile Icon={Clock} label="Sent at" value={timeHHMMSS(selected.sent_at_utc)} mono />
                  <StatTile Icon={Database} label="Attempts" value={String(selected.attempts ?? 1)} />
                  <StatTile Icon={Hash} label="Size" value={`${JSON.stringify(selected.body ?? {}).length} B`} />
                </div>

                {/* SHA */}
                <div className="mt-4 px-4 py-3 rounded-2xl bg-canvas-deep/40 border border-hairline/60">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted mb-1 flex items-center gap-1.5">
                    <Fingerprint className="w-3 h-3 icon-sharp" />
                    SHA-256 (what SaaS received)
                  </div>
                  <div className="text-[11.5px] font-mono text-ink break-all">{selected.sha256}</div>
                </div>

                {/* Payload body */}
                <div className="mt-4">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
                    Wire payload (exact bytes)
                  </div>
                  <pre className="max-h-[320px] overflow-auto px-4 py-3 rounded-2xl bg-ink text-brand-mint text-[11.5px] font-mono leading-relaxed">
                    {JSON.stringify(selected.body, null, 2)}
                  </pre>
                </div>

                {/* Verified strip */}
                <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-brand-chip border border-[#d5e6b4]">
                  <CheckCircle2 className="w-4 h-4 icon-sharp text-brand-800 shrink-0" />
                  <div className="text-[12.5px] text-brand-800">
                    No raw logs, no credentials, no PII — only allow-listed metadata.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  Icon,
  label,
  value,
  mono,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-canvas-deep/40 border border-hairline/60 p-3 flex items-center gap-2.5">
      <Icon className="w-4 h-4 icon-sharp text-ink-muted shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
        <div className={`text-[13px] font-semibold text-ink leading-tight ${mono ? "font-mono" : ""}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
