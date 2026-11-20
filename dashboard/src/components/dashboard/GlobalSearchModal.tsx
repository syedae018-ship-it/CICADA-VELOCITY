"use client";

import React, { useState, useEffect } from "react";
import { Search, X, Server, AlertTriangle, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { dataStore } from "@/lib/api";
import { TenantId, DashboardTab } from "@/types";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: TenantId;
  onNavigate: (tab: DashboardTab, entityId?: string) => void;
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  tenantId,
  onNavigate,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = dataStore.search(query, tenantId);
  const hasResults =
    results.sources.length > 0 ||
    results.collectors.length > 0 ||
    results.incidents.length > 0 ||
    results.recommendations.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-xs font-sans">
      <div className="bg-white border border-hairline rounded-lg shadow-xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-hairline flex items-center gap-3">
          <Search className="w-4 h-4 text-ink-soft/70 shrink-0" />
          <input
            type="text"
            placeholder="Search sources, collectors, incidents, recommendations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-soft/70 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-ink-soft/70 hover:text-ink-soft hover:bg-neutral-100 text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-3 text-xs">
          {!query.trim() ? (
            <div className="py-8 text-center text-ink-soft/70">
              Type keywords to search across monitored infrastructure...
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center text-ink-soft">
              No matching records found for "{query}".
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sources */}
              {results.sources.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft font-semibold mb-1 px-2">
                    Monitored Sources ({results.sources.length})
                  </div>
                  <div className="space-y-1">
                    {results.sources.map((s) => (
                      <button
                        key={s.source_id}
                        onClick={() => {
                          onNavigate("sources", s.source_id);
                          onClose();
                        }}
                        className="w-full p-2.5 rounded hover:bg-neutral-100 flex items-center justify-between text-left transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <Server className="w-3.5 h-3.5 text-ink-soft/70" />
                          <div>
                            <span className="font-semibold text-ink">{s.service}</span>
                            <span className="text-[11px] font-mono text-ink-soft ml-2">
                              {s.source_id}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border border-hairline bg-canvas text-ink-soft">
                          {s.state}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Collectors */}
              {results.collectors.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft font-semibold mb-1 px-2">
                    Collectors ({results.collectors.length})
                  </div>
                  <div className="space-y-1">
                    {results.collectors.map((c) => (
                      <button
                        key={c.collector_id}
                        onClick={() => {
                          onNavigate("fleet", c.collector_id);
                          onClose();
                        }}
                        className="w-full p-2.5 rounded hover:bg-neutral-100 flex items-center justify-between text-left transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-ink-soft/70" />
                          <span className="font-semibold text-ink">{c.collector_id}</span>
                          <span className="text-[11px] font-mono text-ink-soft">{c.region}</span>
                        </div>
                        <span className="text-[10px] font-mono text-ink-soft">
                          {c.status.toUpperCase()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Incidents */}
              {results.incidents.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft font-semibold mb-1 px-2">
                    Incidents ({results.incidents.length})
                  </div>
                  <div className="space-y-1">
                    {results.incidents.map((inc) => (
                      <button
                        key={inc.incident_id}
                        onClick={() => {
                          onNavigate("incidents", inc.incident_id);
                          onClose();
                        }}
                        className="w-full p-2.5 rounded hover:bg-neutral-100 flex items-center justify-between text-left transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          <span className="font-semibold text-ink truncate max-w-sm">
                            {inc.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono uppercase text-rose-700 font-bold">
                          {inc.severity}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {results.recommendations.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft font-semibold mb-1 px-2">
                    AIOps Recommendations ({results.recommendations.length})
                  </div>
                  <div className="space-y-1">
                    {results.recommendations.map((rec) => (
                      <button
                        key={rec.rec_id}
                        onClick={() => {
                          onNavigate("ai_insights", rec.rec_id);
                          onClose();
                        }}
                        className="w-full p-2.5 rounded hover:bg-neutral-100 flex items-center justify-between text-left transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-semibold text-ink truncate max-w-sm">
                            {rec.action}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-ink-soft">
                          {Math.round(rec.confidence * 100)}% Conf
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-2.5 bg-canvas border-t border-hairline flex items-center justify-between text-[11px] font-mono text-ink-soft">
          <span>Tenant Isolated Search: {tenantId}</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
