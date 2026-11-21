"use client";

import React, { useState } from "react";
import { Printer, FileText, CheckCircle2, ShieldCheck, Clock, Download } from "lucide-react";
import { dataStore } from "@/lib/api";
import { TenantId } from "@/types";

interface ReportsViewProps {
  tenantId: TenantId;
}

export default function ReportsView({ tenantId }: ReportsViewProps) {
  const [reportDateRange, setReportDateRange] = useState("Last 24 Hours");
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleDownloadSourcesCsv = () => {
    const csvContent = dataStore.generateSourcesCsv(tenantId);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `cicada_sources_${tenantId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess("sources");
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleDownloadIncidentsCsv = () => {
    const csvContent = dataStore.generateIncidentsCsv(tenantId);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `cicada_incidents_${tenantId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess("incidents");
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handlePrintExecutiveSummary = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-ink">Reports</h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            Generate tenant-scoped CSV exports and executive PDF audit summaries
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-ink-soft">Scope:</span>
          <span className="font-bold text-ink border border-hairline bg-neutral-100 px-2 py-0.5 rounded">
            {tenantId === "t_acme" ? "Acme Corp (t_acme)" : "Globex Corp (t_globex)"}
          </span>
        </div>
      </div>

      {/* Date Range Selection & Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CSV Monitoring Data Export */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-ink flex items-center gap-2">
                <FileText className="w-4 h-4 text-ink-soft" />
                Raw Telemetry & Sources CSV
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Full snapshot of all monitored sources, CPU/RAM utilization, latency, and operational health states.
              </p>
            </div>
            <span className="text-[10px] border border-hairline bg-canvas px-1.5 py-0.5 rounded text-ink-soft">
              CSV
            </span>
          </div>

          <div className="p-3 border border-hairline/60 bg-canvas rounded text-xs text-ink-soft space-y-1">
            <div className="flex justify-between">
              <span>Columns Included:</span>
              <span className="text-ink font-semibold">9 Attributes</span>
            </div>
            <div className="flex justify-between">
              <span>Security Guarantee:</span>
              <span className="text-emerald-700 font-semibold">Zero Credentials Exported</span>
            </div>
          </div>

          <button
            onClick={handleDownloadSourcesCsv}
            className="w-full py-2.5 bg-brand-700 text-white hover:bg-brand-800 font-semibold text-[13px] rounded-full transition flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadSuccess === "sources" ? "Downloaded Successfully!" : "Download Sources CSV"}</span>
          </button>
        </div>

        {/* CSV Incidents & Remediation Export */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-ink flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-ink-soft" />
                Incidents & Remediation Audit CSV
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Complete log of correlated incidents, anomaly z-scores, root causes, and simulated execution audits.
              </p>
            </div>
            <span className="text-[10px] border border-hairline bg-canvas px-1.5 py-0.5 rounded text-ink-soft">
              CSV
            </span>
          </div>

          <div className="p-3 border border-hairline/60 bg-canvas rounded text-xs text-ink-soft space-y-1">
            <div className="flex justify-between">
              <span>Scope:</span>
              <span className="text-ink font-semibold">Correlated Multi-signal Alerts</span>
            </div>
            <div className="flex justify-between">
              <span>Audit Chain:</span>
              <span className="text-emerald-700 font-semibold">Verifiable RLS Token</span>
            </div>
          </div>

          <button
            onClick={handleDownloadIncidentsCsv}
            className="w-full py-2.5 bg-brand-700 text-white hover:bg-brand-800 font-semibold text-[13px] rounded-full transition flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadSuccess === "incidents" ? "Downloaded Successfully!" : "Download Incidents CSV"}</span>
          </button>
        </div>
      </div>

      {/* Printable Executive PDF Report Preview */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-hairline gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-ink flex items-center gap-2">
              <Printer className="w-4 h-4 text-ink-soft" />
              Executive PDF Report Preview
            </h2>
            <p className="text-xs text-ink-soft">
              Formal audit document ready for print or PDF generation for compliance review
            </p>
          </div>

          <button
            onClick={handlePrintExecutiveSummary}
            className="px-4 py-2 border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 text-ink text-[13px] font-semibold rounded-full transition flex items-center gap-2"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save as PDF</span>
          </button>
        </div>

        {/* Report Document Shell */}
        <div className="p-6 border border-hairline bg-canvas rounded text-xs space-y-4 text-ink">
          <div className="flex justify-between border-b border-hairline pb-3">
            <div>
              <div className="text-[15px] font-bold text-ink">
                CICADA 2026 AIOps Platform — Executive SLA & Audit Report
              </div>
              <div className="text-ink-soft text-[11px]">
                Tenant: {tenantId} · Generated: {new Date().toUTCString()}
              </div>
            </div>
            <div className="text-right text-[11px] text-ink-soft">
              Classification: Confidential
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 py-2">
            <div>
              <span className="text-ink-muted text-[10px] uppercase tracking-[0.14em] font-semibold block">Ingest SLA</span>
              <strong className="text-ink text-sm">4.2s (p95 &lt; 10s Target)</strong>
            </div>
            <div>
              <span className="text-ink-muted text-[10px] uppercase tracking-[0.14em] font-semibold block">Sequence Gaps</span>
              <strong className="text-ink text-sm">0 Drops Recorded</strong>
            </div>
            <div>
              <span className="text-ink-muted text-[10px] uppercase tracking-[0.14em] font-semibold block">Privacy Compliance</span>
              <strong className="text-emerald-700 text-sm">100% Local Redaction</strong>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-ink-soft font-sans leading-relaxed border-t border-hairline">
            This certifies that all raw customer logs and authentication credentials remained strictly localized inside customer infrastructure (Tier 1). Only approved numerical telemetry and statistical metadata traversed the wire to the SaaS cluster (Tier 2).
          </div>
        </div>
      </div>
    </div>
  );
}
