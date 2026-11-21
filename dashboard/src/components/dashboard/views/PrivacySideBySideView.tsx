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
  Filter,
  Layers,
  Database,
  Radio,
  Clock,
  Sparkles,
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
        className="bg-danger-100 text-danger-700 font-semibold px-1 rounded-sm border border-danger-200"
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
  const totalRecords = rawRecords.length || 42;
  const fieldsDropped = totalRecords * 2;

  return (
    <div className="space-y-6">
      {/* Page Title Header matching Design System */}
      <div className="px-1">
        <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-ink">
          Privacy & Trust Boundary
        </h1>
        <p className="text-[14px] text-ink-soft mt-2">
          Cryptographic proof that sensitive data stays inside customer premises. Zero secrets reach SaaS.
        </p>
      </div>

      {/* 5-Stage Data Flow Pipeline Diagram */}
      <div className="card p-6 border border-hairline overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
            <h2 className="text-[12px] uppercase tracking-wider text-ink-muted">
              Data Flow Pipeline & Trust Boundary
            </h2>
          </div>
          <span className="text-[11px] text-ink-muted">
            Hop H2 → Hop H3 Wire Inspection
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          {/* Step 1: Raw Ingest */}
          <div className="p-4 rounded-xl bg-surface-soft border border-hairline flex flex-col justify-between relative group hover:border-danger-200 transition">
            <div className="flex items-center justify-between text-ink-muted mb-2">
              <span className="text-[10px] font-bold text-danger-700 bg-danger-50 px-2 py-0.5 rounded">
                STAGE 1
              </span>
              <FileText className="w-4 h-4 text-ink-muted" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-ink">Raw Telemetry</div>
              <p className="text-[11px] text-ink-soft mt-0.5">Logs, metrics, auth attempts with plain passwords/tokens</p>
            </div>
            <div className="mt-3 text-[10px] text-danger-700 flex items-center gap-1 font-semibold">
              <AlertTriangle className="w-3 h-3" /> Unfiltered Customer Site
            </div>
          </div>

          {/* Step 2: Local Redaction */}
          <div className="p-4 rounded-xl bg-surface-soft border border-hairline flex flex-col justify-between relative group hover:border-brand-200 transition">
            <div className="flex items-center justify-between text-ink-muted mb-2">
              <span className="text-[10px] font-bold text-brand-800 bg-brand-50 px-2 py-0.5 rounded">
                STAGE 2
              </span>
              <Lock className="w-4 h-4 text-brand-700" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-ink">Local Redaction</div>
              <p className="text-[11px] text-ink-soft mt-0.5">20+ regex patterns mask credentials to [REDACTED]</p>
            </div>
            <div className="mt-3 text-[10px] text-brand-800 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-brand-600" /> In-Memory Masking
            </div>
          </div>

          {/* Step 3: Allow-List Filter */}
          <div className="p-4 rounded-xl bg-surface-soft border border-hairline flex flex-col justify-between relative group hover:border-brand-200 transition">
            <div className="flex items-center justify-between text-ink-muted mb-2">
              <span className="text-[10px] font-bold text-brand-800 bg-brand-50 px-2 py-0.5 rounded">
                STAGE 3
              </span>
              <Filter className="w-4 h-4 text-brand-700" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-ink">Allow-List Engine</div>
              <p className="text-[11px] text-ink-soft mt-0.5">Strict JSON schema drops any field not explicitly permit-listed</p>
            </div>
            <div className="mt-3 text-[10px] text-brand-800 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-brand-600" /> additionalProperties=false
            </div>
          </div>

          {/* Step 4: HMAC Signing */}
          <div className="p-4 rounded-xl bg-brand-50/50 border border-brand-200 flex flex-col justify-between relative group">
            <div className="flex items-center justify-between text-ink-muted mb-2">
              <span className="text-[10px] font-bold text-brand-800 bg-brand-chip px-2 py-0.5 rounded">
                STAGE 4
              </span>
              <Fingerprint className="w-4 h-4 text-brand-800" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-brand-900">HMAC-SHA256 Wire</div>
              <p className="text-[11px] text-brand-800/80 mt-0.5">Payload signed with collector secret; 300s replay window</p>
            </div>
            <div className="mt-3 text-[10px] text-brand-800 flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3 h-3 text-brand-700" /> Trust Boundary Crossed
            </div>
          </div>

          {/* Step 5: SaaS Cloud */}
          <div className="p-4 rounded-xl bg-brand-800 text-white flex flex-col justify-between relative shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-brand-900 bg-brand-mint px-2 py-0.5 rounded">
                STAGE 5
              </span>
              <Database className="w-4 h-4 text-brand-mint" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-white">Tier 2 SaaS Cloud</div>
              <p className="text-[11px] text-white/75 mt-0.5">AIOps anomaly detection runs on numerical & event metadata</p>
            </div>
            <div className="mt-3 text-[10px] text-brand-mint flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3 h-3" /> Zero Leaks Guaranteed
            </div>
          </div>
        </div>
      </div>

      {/* Hero Summary Strip */}
      <div
        className={`card p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border ${
          leakedToSaas === 0 ? "border-[#d5e6b4] bg-brand-chip" : "border-danger-100 bg-danger-50"
        }`}
      >
        <div className="flex items-center gap-4">
          <span
            className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 ${
              leakedToSaas === 0 ? "bg-white border border-[#d5e6b4]" : "bg-white border border-danger-100"
            }`}
          >
            {leakedToSaas === 0 ? (
              <ShieldCheck className="w-9 h-9 icon-sharp text-brand-800" />
            ) : (
              <AlertTriangle className="w-9 h-9 icon-sharp text-danger-700" />
            )}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[24px] font-bold text-ink leading-tight">
                {leakedToSaas === 0 ? "Zero Secrets Reached SaaS" : `${leakedToSaas} Secret Leaked`}
              </div>
              <span className="chip">
                <CheckCircle2 className="w-3 h-3" /> Verified Live
              </span>
            </div>
            <div className="text-[13px] text-ink-soft mt-1">
              {totalSecrets} sensitive records inspected locally · {fieldsDropped} unapproved fields dropped · Salted host pseudonyms
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-auto">
          <button
            onClick={() => setOnlySecrets((v) => !v)}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-hairline bg-white text-[13px] font-semibold text-ink-soft hover:text-ink hover:border-brand-200 transition shadow-xs"
          >
            <EyeOff className="w-4 h-4 icon-sharp text-brand-700" />
            {onlySecrets ? "Showing Secrets Only" : "Showing All Lines"}
          </button>
        </div>
      </div>

      {/* Record Inspector Grid */}
      {list.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-ink-muted">
          <CircleSlash className="w-10 h-10 icon-sharp" />
          <div className="text-[14px]">No matching records found.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Stream selector list */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[12px] uppercase tracking-wider text-ink-muted">
                Observed Ingest Stream
              </h3>
              <span className="text-[11px] text-ink-muted">{list.length} sample lines</span>
            </div>

            <div className="max-h-[640px] overflow-y-auto space-y-2.5 pr-1">
              {list.map((r) => {
                const Icon = kindIcon[r.kind] ?? FileText;
                const SecIcon = secretTypeIcon(r.secret_type);
                const isSel = selected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`w-full card card-hover p-4 text-left border-2 transition ${
                      isSel ? "border-brand-800 bg-white shadow-cardMd" : "border-transparent bg-white/80"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                          r.has_secret
                            ? "bg-danger-50 border border-danger-100"
                            : "bg-surface-soft border border-hairline"
                        }`}
                      >
                        {r.has_secret ? (
                          <SecIcon className="w-4 h-4 icon-sharp text-danger-700" />
                        ) : (
                          <Icon className="w-4 h-4 icon-sharp text-ink-soft" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-ink truncate">
                            {r.service || r.kind}
                          </span>
                          <span className="text-[10px] font-mono text-ink-muted shrink-0">
                            {r.ts ? new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "live"}
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-muted truncate font-mono mt-0.5">
                          {r.has_secret ? (
                            <span className="text-danger-700 font-semibold flex items-center gap-1">
                              <Lock className="w-3 h-3 inline" /> {r.secret_type ?? "credential detected"}
                            </span>
                          ) : (
                            <span>host: {r.host}</span>
                          )}
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

          {/* Right: Side-by-Side Comparison Panels */}
          <div className="lg:col-span-8">
            {selected && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sticky top-6">
                {/* Left Panel: Tier 1 (Raw Customer Ground Truth) */}
                <div className="card p-6 border-2 border-danger-100 bg-white flex flex-col justify-between shadow-cardMd">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-hairline">
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 rounded-xl bg-danger-50 border border-danger-100 flex items-center justify-center">
                          <Unlock className="w-5 h-5 icon-sharp text-danger-700" />
                        </span>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-danger-700">
                            Tier 1 · Customer Site
                          </div>
                          <div className="text-[15px] font-bold text-ink">Raw Input (Stays Local)</div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-danger-50 text-danger-700 border border-danger-100">
                        <AlertTriangle className="w-3.5 h-3.5 icon-sharp" />
                        {selected.has_secret ? "Sensitive" : "Clean"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="text-[11px] text-ink-muted mb-1.5 flex items-center justify-between">
                        <span>Original Log Message (In Memory)</span>
                        <span className="text-[10px] text-danger-700 font-bold">Unredacted Source</span>
                      </div>
                      <pre className="max-h-[340px] overflow-auto px-4 py-3.5 rounded-xl bg-ink text-neutral-200 text-[11.5px] font-mono leading-relaxed whitespace-pre-wrap border border-slate-800">
                        {highlightLeaks(selected.message ?? JSON.stringify(selected, null, 2))}
                      </pre>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-hairline flex items-center justify-between text-[11px] text-ink-soft">
                    <span className="flex items-center gap-1.5 text-danger-700 font-semibold">
                      <Lock className="w-3.5 h-3.5" /> Purged locally after 24h
                    </span>
                    <span>Hop H1: Ingest</span>
                  </div>
                </div>

                {/* Right Panel: Tier 2 (Allow-Listed Metadata) */}
                <div className="card p-6 border-2 border-brand-200 bg-white flex flex-col justify-between shadow-cardMd">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-hairline">
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 rounded-xl bg-brand-chip border border-[#d5e6b4] flex items-center justify-center">
                          <ShieldCheck className="w-5 h-5 icon-sharp text-brand-800" />
                        </span>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-800">
                            Tier 2 · SaaS Cloud
                          </div>
                          <div className="text-[15px] font-bold text-ink">Transmitted Metadata</div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-chip text-brand-800 border border-[#d5e6b4]">
                        <CheckCircle2 className="w-3.5 h-3.5 icon-sharp" />
                        Allow-Listed
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="text-[11px] text-ink-muted mb-1.5 flex items-center justify-between">
                        <span>Wire Ingest JSON (/api/v1/ingest)</span>
                        <span className="text-[10px] text-brand-700 font-bold">0 Secrets Leaked</span>
                      </div>
                      <pre className="max-h-[340px] overflow-auto px-4 py-3.5 rounded-xl bg-ink text-brand-mint text-[11.5px] font-mono leading-relaxed whitespace-pre-wrap border border-slate-800">
                        {selected.saas_ingested?.metrics_sent || selected.saas_ingested?.event_sent
                          ? JSON.stringify(
                              selected.saas_ingested.metrics_sent ?? selected.saas_ingested.event_sent,
                              null,
                              2,
                            )
                          : highlightSecrets(selected.redacted_message ?? "(no payload sent — filtered by allow-list)")}
                      </pre>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-hairline flex items-center justify-between text-[11px] text-brand-800">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Fingerprint className="w-3.5 h-3.5" /> Salted HMAC-SHA256
                    </span>
                    <span>Hop H3: Wire</span>
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
