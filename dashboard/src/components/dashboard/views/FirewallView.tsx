"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BrickWall,
  CheckCircle2,
  Database,
  FlaskConical,
  Radio,
  Server,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { fetchFirewallStatus, runFirewallSelftest } from "@/lib/live";
import { TenantId } from "@/types";

interface Rule {
  id: string;
  name: string;
  description: string;
}
interface Decision {
  at_utc: string;
  action: "allow" | "block";
  rule: string | null;
  ip: string;
  collector_id: string | null;
  endpoint: string;
  reason: string;
  synthetic: boolean;
}
interface FwStatus {
  rules: Rule[];
  counters: { allowed: number; blocked: number; by_rule: Record<string, number> };
  quarantined: { key: string; seconds_left: number }[];
  recent: Decision[];
  started_at_utc: string;
}
interface Probe {
  probe: string;
  expected: string;
  result: string;
  passed: boolean;
}

const BRIDGE_ID = "c_prom01";

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/70 font-semibold">{label}</div>
      <div className="mt-1 text-[26px] font-bold font-mono leading-none">{value}</div>
    </div>
  );
}

export default function FirewallView({ tenantId }: { tenantId: TenantId }) {
  const [status, setStatus] = useState<FwStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [probes, setProbes] = useState<Probe[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [showSynthetic, setShowSynthetic] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const s = (await fetchFirewallStatus(tenantId)) as FwStatus | null;
      if (alive) {
        setStatus(s);
        setLoaded(true);
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tenantId]);

  const runTest = async () => {
    setTesting(true);
    setTestError(null);
    try {
      const r = await runFirewallSelftest(tenantId);
      setProbes(r.results as Probe[]);
      const s = (await fetchFirewallStatus(tenantId)) as FwStatus | null;
      if (s) setStatus(s);
    } catch (e) {
      setTestError((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  if (loaded && !status) {
    return (
      <div className="card p-8 text-center space-y-2">
        <BrickWall className="w-8 h-8 mx-auto text-ink-muted" />
        <h2 className="text-[18px] font-semibold">Firewall status unavailable</h2>
        <p className="text-[13px] text-ink-soft">
          The SaaS receiver isn&apos;t reachable. Start it with <code className="font-mono">./scripts/dev.sh</code>.
        </p>
      </div>
    );
  }

  const rules = status?.rules ?? [];
  const recent = (status?.recent ?? []).filter((d) => showSynthetic || !d.synthetic);
  const bridgeLast = status?.recent.find((d) => d.collector_id === BRIDGE_ID && d.action === "allow");
  const bridgeLive = !!bridgeLast && Date.now() - new Date(bridgeLast.at_utc).getTime() < 60_000;
  const realBlocks = (status?.recent ?? []).filter((d) => d.action === "block" && !d.synthetic).length;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-cardLg p-6 sm:p-8 text-white"
        style={{
          background: "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 55%, #062715 100%)",
          boxShadow: "var(--shadow-hero)",
        }}
      >
        <div className="ring-deco -right-8 -top-8 h-36 w-36" />
        <div className="ring-deco -right-20 -bottom-20 h-60 w-60" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-brand-mint/90">
            <BrickWall className="w-3.5 h-3.5" /> Ingest firewall
          </div>
          <div className="mt-3 flex items-end gap-4 flex-wrap">
            <h1 className="text-[32px] sm:text-[44px] leading-[1.02] font-bold tracking-[-0.035em]">
              Firewall <span className="text-brand-mint">active</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/10 border border-white/20">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-mint animate-pulse" /> Inspecting every request
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-white/80 text-[14px]">
            Every payload from a collector passes {rules.length || 8} checks before it reaches the receiver. If any
            check fails, the request is dropped and logged below. Nothing is stored.
          </p>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            <Stat label="Allowed" value={status?.counters.allowed ?? "–"} />
            <Stat label="Blocked" value={status?.counters.blocked ?? "–"} />
            <Stat label="Rules" value={rules.length || "–"} />
            <Stat label="Quarantined" value={status?.quarantined.length ?? "–"} />
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="card p-5 sm:p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-muted font-semibold mb-4">Data path</div>
        <div className="flex flex-col md:flex-row md:items-stretch gap-3">
          <div className="md:w-56 shrink-0 rounded-2xl border border-hairline bg-surface-soft p-4 space-y-2">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Server className="w-4 h-4 text-brand-700" /> Collectors
            </div>
            <div className="text-[12px] text-ink-soft">Local collector (Tier 1)</div>
            <div className="flex items-center gap-1.5 text-[12px]">
              <Radio className={`w-3.5 h-3.5 ${bridgeLive ? "text-brand-600" : "text-ink-muted"}`} />
              <span className={bridgeLive ? "text-brand-800 font-medium" : "text-ink-muted"}>
                Prometheus bridge {bridgeLive ? "· live" : "· idle"}
              </span>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-ink-muted self-center rotate-90 md:rotate-0 shrink-0" />
          <div className="flex-1 rounded-2xl border-2 border-brand-700 bg-brand-chip/40 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-800 mb-2">
              <BrickWall className="w-4 h-4" /> Firewall
            </div>
            <div className="flex flex-wrap gap-1.5">
              {rules.map((r, i) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-surface border border-hairline"
                >
                  <span className="font-mono text-ink-muted">{i + 1}</span> {r.name}
                </span>
              ))}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-ink-muted self-center rotate-90 md:rotate-0 shrink-0" />
          <div className="md:w-48 shrink-0 rounded-2xl border border-hairline bg-surface-soft p-4 space-y-1">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Database className="w-4 h-4 text-brand-700" /> Receiver
            </div>
            <div className="text-[12px] text-ink-soft">Stores only payloads that passed every check</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Live feed */}
        <div className="card p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold">Live test feed</h3>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                bridgeLive ? "bg-brand-chip text-brand-800" : "bg-canvas-deep text-ink-muted"
              }`}
            >
              {bridgeLive ? "Streaming" : "Not running"}
            </span>
          </div>
          <p className="text-[13px] text-ink-soft">
            Until the local collector is finished, real-time metrics come from the public{" "}
            <strong>Prometheus demo server</strong>. The bridge turns them into signed payloads and sends them through
            this firewall as collector <code className="font-mono text-[12px]">{BRIDGE_ID}</code>. Hostnames are
            hashed and never leave the bridge.
          </p>
          <div className="rounded-xl bg-surface-soft border border-hairline p-3 text-[12px] font-mono space-y-1">
            <div>source: prometheus.demo.prometheus.io</div>
            <div>last accepted: {bridgeLast ? ago(bridgeLast.at_utc) : "none yet"}</div>
          </div>
          {!bridgeLive && (
            <div className="text-[12px] text-ink-muted">
              Start it with <code className="font-mono">.venv/bin/python -m demo.prometheus_bridge</code>
            </div>
          )}
        </div>

        {/* Self-test */}
        <div className="card p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-semibold">Attack self-test</h3>
            <button
              onClick={runTest}
              disabled={testing}
              className="btn-pill-primary h-9 px-4 inline-flex items-center gap-2 text-[13px] disabled:opacity-50"
            >
              <FlaskConical className="w-4 h-4" /> {testing ? "Running…" : "Run attack test"}
            </button>
          </div>
          <p className="text-[13px] text-ink-soft">
            Sends one hostile request at each rule (spoofed IP, flood, leaked secrets, forged signature, smuggled raw
            log), plus one clean payload that should get through.
          </p>
          {testError && <div className="text-[12px] text-danger-700">Self-test failed: {testError}</div>}
          {probes && (
            <ul className="divide-y divide-hairline rounded-xl border border-hairline overflow-hidden">
              {probes.map((p) => (
                <li key={p.probe} className="flex items-center gap-2 px-3 py-2 text-[12.5px] bg-surface">
                  {p.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-danger-700 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate">{p.probe}</span>
                  <span
                    className={`font-mono text-[11px] ${
                      p.result.startsWith("blocked") ? "text-danger-700" : "text-brand-700"
                    }`}
                  >
                    {p.result}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {probes && (
            <div className="text-[12px] font-semibold text-brand-800">
              {probes.filter((p) => p.passed).length}/{probes.length} behaved as expected
            </div>
          )}
        </div>
      </div>

      {/* Rules */}
      <div className="card p-5 sm:p-6">
        <h3 className="text-[16px] font-semibold mb-3">Rules</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {rules.map((r, i) => (
            <div key={r.id} className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-soft p-3">
              <span className="h-6 w-6 shrink-0 rounded-full bg-brand-800 text-brand-mint text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold">{r.name}</div>
                <div className="text-[12px] text-ink-soft">{r.description}</div>
              </div>
              <span className="text-[11px] font-mono text-ink-muted whitespace-nowrap">
                {status?.counters.by_rule[r.id] ?? 0} blocked
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Decisions */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-[16px] font-semibold">Recent decisions</h3>
          <div className="flex items-center gap-3 text-[12px] text-ink-soft">
            <span>{realBlocks} real block{realBlocks === 1 ? "" : "s"}</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showSynthetic} onChange={(e) => setShowSynthetic(e.target.checked)} />
              Show self-test
            </label>
          </div>
        </div>
        {recent.length === 0 ? (
          <div className="text-[13px] text-ink-muted py-6 text-center">
            No traffic yet. Start a collector or the Prometheus bridge, or run the attack test.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:mx-0">
            <table className="w-full text-[12.5px] min-w-[640px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">Decision</th>
                  <th className="px-3 py-2 font-semibold">Collector</th>
                  <th className="px-3 py-2 font-semibold">Source IP</th>
                  <th className="px-3 py-2 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {recent.slice(0, 25).map((d, i) => (
                  <tr key={`${d.at_utc}-${i}`}>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-soft">{ago(d.at_utc)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {d.action === "allow" ? (
                        <span className="inline-flex items-center gap-1 text-brand-700 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" /> allowed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-danger-700 font-medium">
                          <ShieldAlert className="w-3.5 h-3.5" /> blocked · {d.rule}
                        </span>
                      )}
                      {d.synthetic && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-canvas-deep text-[10px] text-ink-muted">
                          test
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">{d.collector_id ?? "unknown"}</td>
                    <td className="px-3 py-2 font-mono">{d.ip}</td>
                    <td className="px-3 py-2 text-ink-soft max-w-[320px] truncate" title={d.reason}>
                      {d.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
