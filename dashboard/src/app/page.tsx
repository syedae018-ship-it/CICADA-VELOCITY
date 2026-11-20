"use client";

// Placeholder home. Owner: M4, replace with the real dashboard (see dashboard/README.md).
import { useEffect, useState } from "react";

const SAAS = process.env.NEXT_PUBLIC_SAAS_URL ?? "http://localhost:8000";
const COLLECTOR = process.env.NEXT_PUBLIC_COLLECTOR_URL ?? "http://localhost:8001";

type Check = { name: string; url: string; ok: boolean | null; body?: string };

export default function Home() {
  const [checks, setChecks] = useState<Check[]>([
    { name: "SaaS (Tier 2)", url: `${SAAS}/api/v1/health`, ok: null },
    { name: "Collector (Tier 1)", url: `${COLLECTOR}/local/status`, ok: null },
  ]);

  useEffect(() => {
    const run = () =>
      Promise.all(
        checks.map(async (c) => {
          try {
            const r = await fetch(c.url, { cache: "no-store" });
            return { ...c, ok: r.ok, body: JSON.stringify(await r.json(), null, 2) };
          } catch {
            return { ...c, ok: false, body: "unreachable" };
          }
        }),
      ).then(setChecks);
    run();
    const t = setInterval(run, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Velocity Cicada</h1>
      <p className="mt-1 text-slate-400">Secure two-tier AIOps observability: skeleton status page</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {checks.map((c) => (
          <div key={c.name} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.name}</span>
              <span className={c.ok === null ? "text-slate-400" : c.ok ? "text-emerald-400" : "text-rose-400"}>
                {c.ok === null ? "checking…" : c.ok ? "online" : "offline"}
              </span>
            </div>
            <pre className="mt-3 overflow-x-auto text-xs text-slate-400">{c.body}</pre>
          </div>
        ))}
      </div>
    </main>
  );
}
