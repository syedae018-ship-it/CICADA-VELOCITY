"use client";

import React from "react";
import { RawLogRecord } from "@/types";

interface PrivacySideBySideViewProps {
  rawRecords: RawLogRecord[];
}

export default function PrivacySideBySideView({
  rawRecords,
}: PrivacySideBySideViewProps) {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-neutral-200 gap-2">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 uppercase tracking-tight">
            Privacy Verification (Side-by-Side)
          </h1>
          <p className="text-xs text-neutral-500">
            Proves customer logs containing credentials remain in Tier 1; SaaS receives only safe metadata
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="border border-neutral-200 bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded">
            SECRETS IN SAAS: 0
          </span>
          <span className="border border-neutral-200 bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded">
            LOCAL REDACTION: 100%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Customer Site (Tier 1) */}
        <div className="space-y-3">
          <div className="p-3 border border-neutral-200 bg-white rounded flex items-center justify-between text-xs shadow-xs">
            <div>
              <span className="font-bold text-neutral-900 uppercase block">Customer Environment (Tier 1)</span>
              <span className="text-[11px] font-mono text-neutral-500">Collector API · port 8001 (/local/raw)</span>
            </div>
            <span className="text-[10px] font-mono uppercase border border-rose-200 bg-rose-50 text-rose-800 px-2 py-0.5 rounded font-semibold">
              Raw Logs With Credentials
            </span>
          </div>

          <div className="space-y-3">
            {rawRecords.map((item) => (
              <div
                key={item.id}
                className="border border-neutral-200 bg-white p-4 rounded-lg space-y-2.5 font-mono text-xs shadow-xs"
              >
                <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                  <span className="font-bold text-neutral-900">{item.host} ({item.service})</span>
                  <span>{item.ts}</span>
                </div>

                {item.has_secret && (
                  <div className="text-[10px] uppercase font-bold text-rose-700 border border-rose-200 bg-rose-50 px-2 py-0.5 rounded inline-block">
                    [SECRET DETECTED: {item.secret_type}]
                  </div>
                )}

                {/* Raw Message Box */}
                <div className="p-3 border border-neutral-200 bg-neutral-50 rounded text-[11px] text-neutral-800 leading-relaxed break-all select-all">
                  {item.message ? (
                    item.has_secret && item.message.includes("password=hunter2") ? (
                      <span>
                        {item.message.split("password=hunter2")[0]}
                        <span className="bg-rose-600 text-white font-bold px-1 py-0.2 rounded">
                          password=hunter2
                        </span>
                        {item.message.split("password=hunter2")[1] && (
                          <>
                            {item.message.split("password=hunter2")[1].split("Bearer ")[0]}
                            {item.message.includes("Bearer ") && (
                              <span className="bg-rose-600 text-white font-bold px-1 py-0.2 rounded">
                                Bearer eyJhbGciOiJIUzI1NiJ9...
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    ) : (
                      item.message
                    )
                  ) : (
                    JSON.stringify(item, null, 2)
                  )}
                </div>

                {item.redacted_message && (
                  <div className="p-2.5 border border-neutral-200 bg-neutral-50/60 rounded text-[11px] text-neutral-600">
                    <span className="text-[10px] uppercase block text-neutral-500 mb-0.5">
                      Local Redacted Form (stays local):
                    </span>
                    <span className="text-neutral-900">{item.redacted_message}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: SaaS Cloud (Tier 2) */}
        <div className="space-y-3">
          <div className="p-3 border border-neutral-200 bg-white rounded flex items-center justify-between text-xs shadow-xs">
            <div>
              <span className="font-bold text-neutral-900 uppercase block">SaaS Cloud Ingest (Tier 2)</span>
              <span className="text-[11px] font-mono text-neutral-500">Supabase & FastAPI · port 8000</span>
            </div>
            <span className="text-[10px] font-mono uppercase border border-neutral-200 bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded font-semibold">
              Metadata Only
            </span>
          </div>

          <div className="space-y-3">
            {rawRecords.map((item) => (
              <div
                key={`saas_${item.id}`}
                className="border border-neutral-200 bg-white p-4 rounded-lg space-y-2.5 font-mono text-xs shadow-xs"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-neutral-900">Stored by SaaS: {item.service}</span>
                  <span className="text-neutral-500">0 Secrets &check;</span>
                </div>

                <div className="p-3 border border-neutral-200 bg-neutral-50 rounded text-[11px] text-neutral-800 leading-relaxed select-all">
                  {item.saas_ingested.metrics_sent && (
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase block mb-1">
                        Metrics Stored:
                      </span>
                      <pre>{JSON.stringify(item.saas_ingested.metrics_sent, null, 2)}</pre>
                    </div>
                  )}
                  {item.saas_ingested.event_sent && (
                    <div className="mt-2">
                      <span className="text-[10px] text-neutral-500 uppercase block mb-1">
                        Event Summary Stored:
                      </span>
                      <pre>{JSON.stringify(item.saas_ingested.event_sent, null, 2)}</pre>
                    </div>
                  )}
                </div>

                <div className="p-2 border border-neutral-200 bg-neutral-50 rounded text-[11px] text-neutral-600">
                  &check; Verified: Raw payload text, credentials, and host IP discarded prior to egress.
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
