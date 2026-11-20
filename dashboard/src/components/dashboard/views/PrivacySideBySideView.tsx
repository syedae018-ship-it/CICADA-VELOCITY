"use client";

import React, { useMemo, useState } from "react";
import {
  Lock,
  Unlock,
  ShieldCheck,
  EyeOff,
  FileText,
  KeyRound,
  Mail,
  Globe,
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  ArrowRight,
} from "lucide-react";
import { RawLogRecord } from "@/types";

interface PrivacySideBySideViewProps {
  rawRecords: RawLogRecord[];
}

const kindIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  metric: FileText,
  log: FileText,
  auth: KeyRound,
  flow: Globe,
};

function secretTypeIcon(t?: string): React.ComponentType<{ className?: string }> {
  if (!t) return AlertTriangle;
  const k = t.toLowerCase();
  if (k.includes("password") || k.includes("token") || k.includes("key") || k.includes("jwt") || k.includes("api")) return KeyRound;
  if (k.includes("email")) return Mail;
  if (k.includes("ip")) return Globe;
  return AlertTriangle;
}

function highlightSecrets(text: string) {
  // Visual emphasis for redaction tags [REDACTED:xxx] and secret hints
  const parts: React.ReactNode[] = [];
  const re = /\[REDACTED:([a-z0-9_]+)\]/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span
        key={key++}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-chip border border-[#d5e6b4] text-brand-800 text-[11px] font-semibold mx-0.5"
      >
        <Lock className="w-3 h-3 icon-sharp" />
        {m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function highlightLeaks(text: string) {
  // Visual emphasis for things that LOOK like credentials in the raw string
  const patterns: { re: RegExp; label: string }[] = [
    { re: /password\s*=\s*\S+/gi, label: "password" },
    { re: /api[_-]?key\s*=\s*\S+/gi, label: "api_key" },
    { re: /Bearer\s+[A-Za-z0-9._~+/=-]+/g, label: "bearer" },
    { re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, label: "jwt" },
    { re: /AKIA[0-9A-Z]{16}/g, label: "aws_key" },
    { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, label: "email" },
    { re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, label: "ipv4" },
  ];
  const marks: { start: number; end: number; label: string }[] = [];
  for (const { re, label } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      marks.push({ start: m.index, end: m.index + m[0].length, label });
    }
  }
  marks.sort((a, b) => a.start - b.start);
  // Merge overlaps
  const merged: typeof marks = [];
  for (const m of marks) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) {
      last.end = Math.max(last.end, m.end);
      last.label = last.label + "+" + m.label;
    } else {
      merged.push({ ...m });
    }
  }
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  for (const m of merged) {
    if (m.start > i) out.push(text.slice(i, m.start));
    out.push(
      <span
        key={key++}
        className="bg-danger-100 text-danger-700 font-semibold px-1 rounded-sm"
        title={m.label}
      >
        {text.slice(m.start, m.end)}
      </span>,
    );
    i = m.end;
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}

export default function PrivacySideBySideView({ rawRecords }: PrivacySideBySideViewProps) {
  const withSecrets = useMemo(() => rawRecords.filter((r) => r.has_secret), [rawRecords]);
  const [onlySecrets, setOnlySecrets] = useState(true);
  const list = onlySecrets && withSecrets.length > 0 ? withSecrets : rawRecords;
  const [selected, setSelected] = useState<RawLogRecord | null>(list[0] ?? null);

  // Keep selection fresh
  React.useEffect(() => {
    if (list.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !list.find((r) => r.id === selected.id)) {
      setSelected(list[0]);
    }
  }, [list, selected]);

  const totalSecrets = withSecrets.length;
  const leakedToSaas = rawRecords.reduce((n, r) => n + (r.saas_ingested?.secrets_leaked_to_saas ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="px-1">
        <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-ink">Privacy</h1>
        <p className="text-[14px] text-ink-soft mt-2">
          What stayed local vs. what SaaS saw.
        </p>
      </div>

      {/* Hero — single metric that tells the story */}
      <div
        className={`card p-6 flex items-center gap-5 border ${
          leakedToSaas === 0 ? "border-[#d5e6b4] bg-brand-chip" : "border-danger-100 bg-danger-50"
        }`}
      >
        <span
          className={`h-16 w-16 rounded-2xl flex items-center justify-center ${
            leakedToSaas === 0 ? "bg-white border border-[#d5e6b4]" : "bg-white border border-danger-100"
          }`}
        >
          {leakedToSaas === 0 ? (
            <ShieldCheck className="w-8 h-8 icon-sharp text-brand-800" />
          ) : (
            <AlertTriangle className="w-8 h-8 icon-sharp text-danger-700" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[22px] font-bold text-ink leading-tight">
            {leakedToSaas === 0 ? "Zero secrets reached SaaS" : `${leakedToSaas} secret${leakedToSaas === 1 ? "" : "s"} leaked`}
          </div>
          <div className="text-[13px] text-ink-soft mt-1">
            {totalSecrets} sensitive line{totalSecrets === 1 ? "" : "s"} redacted locally in this window.
          </div>
        </div>
        <button
          onClick={() => setOnlySecrets((v) => !v)}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-full border border-hairline bg-white text-[12.5px] font-semibold text-ink-soft hover:text-ink hover:border-brand-200 transition"
        >
          <EyeOff className="w-4 h-4 icon-sharp" />
          {onlySecrets ? "Showing secrets only" : "Showing all"}
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-ink-muted">
          <CircleSlash className="w-10 h-10 icon-sharp" />
          <div className="text-[14px]">No matching records.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Record list */}
          <div className="lg:col-span-4 space-y-2.5">
            <div className="flex items-center justify-between px-1 pb-1">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-muted">
                Recent lines
              </h3>
              <span className="text-[11.5px] font-mono text-ink-muted">{list.length} total</span>
            </div>
            <div className="max-h-[720px] overflow-y-auto space-y-2.5 pr-1">
              {list.map((r) => {
                const Icon = kindIcon[r.kind] ?? FileText;
                const SecIcon = secretTypeIcon(r.secret_type);
                const isSel = selected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`w-full card card-hover p-4 text-left border-2 transition ${
                      isSel ? "border-brand-800" : "border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                          r.has_secret ? "bg-danger-50 border border-danger-100" : "bg-canvas-deep/40 border border-hairline/60"
                        }`}
                      >
                        {r.has_secret ? (
                          <SecIcon className="w-4 h-4 icon-sharp text-danger-700" />
                        ) : (
                          <Icon className="w-4 h-4 icon-sharp text-ink-soft" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink truncate">
                          {r.service || r.kind}
                        </div>
                        <div className="text-[11px] text-ink-muted truncate font-mono">
                          {r.has_secret ? r.secret_type ?? "secret detected" : r.host}
                        </div>
                      </div>
                      {r.has_secret && (
                        <span className="h-2 w-2 rounded-full bg-danger-700 animate-pulse shrink-0 mt-2" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side-by-side detail */}
          <div className="lg:col-span-8">
            {selected && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sticky top-6">
                {/* Tier 1 — raw */}
                <div className="card p-6 border border-danger-100/70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="h-10 w-10 rounded-full bg-danger-50 border border-danger-100 flex items-center justify-center">
                        <Unlock className="w-5 h-5 icon-sharp text-danger-700" />
                      </span>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-danger-700">
                          Tier 1 · customer
                        </div>
                        <div className="text-[14px] font-bold text-ink">Raw (stays local)</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-danger-50 text-danger-700 border border-danger-100">
                      <AlertTriangle className="w-3.5 h-3.5 icon-sharp" />
                      {selected.has_secret ? "Contains secrets" : "Clean"}
                    </span>
                  </div>

                  <pre className="mt-4 max-h-[360px] overflow-auto px-4 py-3 rounded-2xl bg-ink text-neutral-200 text-[11.5px] font-mono leading-relaxed whitespace-pre-wrap">
                    {highlightLeaks(selected.message ?? JSON.stringify(selected, null, 2))}
                  </pre>

                  <div className="mt-4 flex items-center gap-2 text-[11.5px] text-ink-soft">
                    <Lock className="w-3.5 h-3.5 icon-sharp text-brand-700" />
                    Never leaves the collector
                  </div>
                </div>

                {/* Arrow between panels (desktop only) */}
                <div className="hidden md:flex absolute items-center" />

                {/* Tier 2 — redacted */}
                <div className="card p-6 border border-[#d5e6b4]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="h-10 w-10 rounded-full bg-brand-chip border border-[#d5e6b4] flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 icon-sharp text-brand-800" />
                      </span>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-800">
                          Tier 2 · SaaS
                        </div>
                        <div className="text-[14px] font-bold text-ink">What left the site</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-chip text-brand-800 border border-[#d5e6b4]">
                      <CheckCircle2 className="w-3.5 h-3.5 icon-sharp" />
                      Metadata only
                    </span>
                  </div>

                  <pre className="mt-4 max-h-[360px] overflow-auto px-4 py-3 rounded-2xl bg-ink text-brand-mint text-[11.5px] font-mono leading-relaxed whitespace-pre-wrap">
                    {selected.saas_ingested?.metrics_sent || selected.saas_ingested?.event_sent
                      ? JSON.stringify(
                          selected.saas_ingested.metrics_sent ?? selected.saas_ingested.event_sent,
                          null,
                          2,
                        )
                      : highlightSecrets(selected.redacted_message ?? "(no payload sent — local-only line)")}
                  </pre>

                  <div className="mt-4 flex items-center gap-2 text-[11.5px] text-brand-800">
                    <Fingerprint className="w-3.5 h-3.5 icon-sharp" />
                    0 secrets · 0 PII · signed + hashed
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
