// Live data adapter: fetches the real backends and maps them into the dashboard's existing types,
// so every view renders real data with zero UI changes. If the SaaS is unreachable, the dashboard keeps
// showing the mock data (useful for building UI offline).
//
//   SaaS (Tier 2, port 8000):      /api/v1/overview, collectors, metrics, alerts, incidents, audit, reliability…
//   Collector (Tier 1, port 8001): /local/egress, /local/raw, /local/status   (customer-side proof views)
//
// Auth: `Bearer demo-<tenant>` while the SaaS runs with DEV_INSECURE=1. For Supabase login, call
// setAccessToken(session.access_token) after sign-in.

import type {
  ActivityTimelineEvent,
  BackendStatus,
  ScenarioId,
  Alert,
  AlertExplanation,
  AuditLogEntry,
  CollectorNode,
  EgressPayloadEntry,
  HealthHistoryRecord,
  HealthState,
  Incident,
  MetricPoint,
  MonitoredSource,
  NotificationItem,
  RawLogRecord,
  Recommendation,
  ReliabilityMetrics,
  SourceType,
  TenantId,
} from "@/types";

export const SAAS_URL = process.env.NEXT_PUBLIC_SAAS_URL || "http://localhost:8000";
export const COLLECTOR_URL = process.env.NEXT_PUBLIC_COLLECTOR_URL || "http://localhost:8001";
// Each tenant has its own collector inside its own environment, e.g. "t_acme=http://localhost:8001,t_globex=http://localhost:8002"
const COLLECTOR_URLS: Record<string, string> = Object.fromEntries(
  (process.env.NEXT_PUBLIC_COLLECTOR_URLS || `t_acme=${COLLECTOR_URL},t_globex=http://localhost:8002`)
    .split(",")
    .map((kv) => kv.split("=").map((x) => x.trim()))
    .filter((kv) => kv.length === 2 && kv[0] && kv[1]),
);
export const collectorUrlFor = (tenantId: TenantId) => COLLECTOR_URLS[tenantId] ?? COLLECTOR_URL;
const TIMEOUT_MS = 2500;

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}
const authHeader = (tenantId: TenantId) => ({ Authorization: `Bearer ${accessToken ?? `demo-${tenantId}`}` });

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers, cache: "no-store", signal: ctrl.signal });
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function postJson(url: string, headers: Record<string, string>): Promise<Json> {
  const r = await fetch(url, { method: "POST", headers, cache: "no-store" });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

const STATES: HealthState[] = ["excellent", "good", "fair", "poor"];
const asState = (s: unknown): HealthState => (STATES.includes(s as HealthState) ? (s as HealthState) : "good");
const asSourceType = (s: unknown): SourceType =>
  (["server", "network", "security", "app"].includes(s as string) ? s : "server") as SourceType;
const iso = (s: unknown) => (typeof s === "string" && s ? s : new Date().toISOString());

function humanDuration(fromIso: string, toIso?: string): string {
  const ms = Math.max(0, new Date(toIso ?? Date.now()).getTime() - new Date(fromIso).getTime());
  const m = Math.floor(ms / 60000);
  if (m < 1) return `${Math.max(1, Math.floor(ms / 1000))}s`;
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function mapExplanation(e: Json | undefined): AlertExplanation {
  const x = e ?? {};
  return {
    why: x.why ?? "",
    observed: Number(x.observed ?? 0),
    baseline: {
      mean: Number(x.baseline?.mean ?? 0),
      std: Number(x.baseline?.std ?? 0),
      window_minutes: Number(x.baseline?.window_minutes ?? 15),
      samples: Number(x.baseline?.samples ?? 0),
    },
    z_score: Number(x.z_score ?? 0),
    threshold_crossed: x.threshold_crossed ?? "",
    contributing_signals: (x.contributing_signals ?? []).map((c: Json) => ({
      source_id: c.source_id ?? "",
      metric: c.metric ?? "",
      deviation: String(c.deviation ?? ""),
      weight: Number(c.weight ?? 0),
    })),
    confidence: Number(x.confidence ?? 0),
  };
}

function mapAlert(a: Json, tenantId: TenantId): Alert {
  return {
    alert_id: a.alert_id,
    tenant_id: tenantId,
    source_id: a.source_id ?? "",
    service: a.service ?? "unknown",
    kind: a.kind ?? "anomaly",
    metric: a.metric ?? "",
    severity: a.severity ?? "medium",
    state: asState(a.state),
    event_time_utc: iso(a.event_time_utc),
    created_at_utc: iso(a.created_at_utc),
    incident_id: a.incident_id ?? undefined,
    explanation: mapExplanation(a.explanation),
  };
}

function mapRecommendation(r: Json): Recommendation {
  return {
    rec_id: r.rec_id,
    incident_id: r.incident_id ?? "",
    action: r.action ?? "",
    reasoning_path: r.reasoning_path ?? [],
    contributing_signals: (r.contributing_signals ?? []).map(String),
    confidence: Number(r.confidence ?? 0),
    risk: r.risk ?? "low",
    requires_approval: r.requires_approval ?? true,
    policy_check: { allowed: !!r.policy_check?.allowed, policy: r.policy_check?.policy ?? "" },
    rollback_plan: r.rollback_plan ?? "",
    status: r.status ?? "proposed",
  };
}

function mapIncident(i: Json, tenantId: TenantId, alerts: Alert[], recs: Recommendation[]): Incident {
  const mine = alerts.filter((a) => a.incident_id === i.incident_id);
  const started = iso(i.started_utc);
  return {
    incident_id: i.incident_id,
    tenant_id: tenantId,
    title: i.title ?? "Incident",
    status: i.status ?? "open",
    severity: i.severity ?? "medium",
    started_utc: started,
    updated_utc: iso(i.updated_utc),
    first_detected_utc: i.earliest_signal?.time ?? started,
    duration: humanDuration(started, i.status === "resolved" ? i.updated_utc : undefined),
    alert_ids: i.alert_ids ?? mine.map((a) => a.alert_id),
    alert_count: Number(i.alert_count ?? mine.length),
    suppressed_duplicates: Number(i.suppressed_duplicates ?? 0),
    affected_sources: i.affected_sources ?? [],
    likely_cause: i.likely_cause ?? "",
    correlation_rule: i.correlation_rule ?? "",
    suggested_resolution: recs.find((r) => r.incident_id === i.incident_id)?.action ?? "",
    alerts: mine,
  };
}

const EGRESS_RESULT: Record<string, EgressPayloadEntry["result"]> = {
  accepted: "delivered",
  duplicate: "duplicate_ack",
};
function mapEgress(e: Json, tenantId: TenantId): EgressPayloadEntry {
  const result = typeof e.result === "string" ? e.result : null;
  const mapped: EgressPayloadEntry["result"] = result
    ? EGRESS_RESULT[result] ?? (result.startsWith("dead_letter") ? "failed" : "buffered")
    : "buffered";
  return {
    payload_id: e.payload_id,
    tenant_id: (e.body?.tenant_id as TenantId) ?? tenantId,
    seq: Number(e.seq ?? 0),
    sent_at_utc: iso(e.sent_at_utc ?? e.first_attempt_utc),
    sha256: e.sha256 ?? "",
    attempts: Number(e.attempts ?? 0),
    result: mapped,
    body: typeof e.body === "object" && e.body ? e.body : {},
    matches_saas: mapped === "delivered" || mapped === "duplicate_ack",
  };
}

function mapRaw(r: Json): RawLogRecord {
  const raw = r.raw ?? {};
  const red = r.redacted ?? {};
  const rawText = raw.message ?? (raw.kind === "auth" ? `login ${raw.outcome} user=${raw.user} from ${raw.src_ip}` : "");
  const redText =
    red.message ?? (red.kind === "auth" ? `login ${red.outcome} user=${red.user} from ${red.src_ip}` : "");
  // Only count secrets found in the log/auth content itself (the host IP field is local metadata, never sent)
  const scanned = [red.message, red.user, red.src_ip].filter(Boolean).join(" ");
  const types = Array.from(scanned.matchAll(/\[REDACTED:([a-z0-9_]+)\]/g)).map((m) => m[1]);
  const kind = (["metric", "log", "auth", "flow"].includes(raw.kind) ? raw.kind : "log") as RawLogRecord["kind"];
  return {
    id: String(r.id),
    kind,
    ts: iso(raw.ts ?? r.received_utc),
    host: raw.host ?? r.host ?? "",
    ip: raw.ip ?? "",
    service: raw.service ?? "",
    source_type: raw.source_type ?? "",
    level: raw.level,
    user: raw.user,
    src_ip: raw.src_ip,
    message: rawText || JSON.stringify(raw.metrics ?? raw),
    has_secret: types.length > 0,
    secret_type: types.length ? Array.from(new Set(types)).join(", ") : undefined,
    redacted_message: redText || JSON.stringify(red.metrics ?? red),
    saas_ingested: {
      metrics_sent: raw.metrics ? { source_id: r.source_id, ...raw.metrics } : null,
      event_sent:
        kind === "auth"
          ? { category: "auth", source_id: r.source_id, note: "counted into a failed_login_burst summary only" }
          : kind === "log" && ["WARN", "ERROR"].includes(raw.level)
            ? { category: "resource", source_id: r.source_id, note: "counted into warning_recurring only" }
            : null,
      secrets_leaked_to_saas: 0,
    },
  };
}

export interface LiveSnapshot {
  sources: MonitoredSource[];
  collectors: CollectorNode[];
  alerts: Alert[];
  incidents: Incident[];
  recommendations: Recommendation[];
  egress: EgressPayloadEntry[] | null; // null = collector not reachable (keep previous)
  raw: RawLogRecord[] | null;
  reliability: ReliabilityMetrics;
  healthHistory: HealthHistoryRecord[];
  audit: AuditLogEntry[];
  notifications: NotificationItem[];
  timeline: ActivityTimelineEvent[];
}

const bufferHistory: { time: string; depth: number }[] = [];

/** Fetch everything for one tenant. Throws if the SaaS itself is unreachable (caller keeps mocks). */
export async function fetchLiveSnapshot(tenantId: TenantId): Promise<LiveSnapshot> {
  const h = authHeader(tenantId);
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const [overview, collectorsRaw, metrics, alertsRaw, incidentsRaw, reliabilityRaw, historyRaw, auditRaw] =
    await Promise.all([
      getJson(`${SAAS_URL}/api/v1/overview`, h),
      getJson(`${SAAS_URL}/api/v1/collectors`, h),
      getJson(`${SAAS_URL}/api/v1/metrics?from=${encodeURIComponent(since)}`, h),
      getJson(`${SAAS_URL}/api/v1/alerts`, h),
      getJson(`${SAAS_URL}/api/v1/incidents`, h),
      getJson(`${SAAS_URL}/api/v1/reliability`, h),
      getJson(`${SAAS_URL}/api/v1/health-history`, h),
      getJson(`${SAAS_URL}/api/v1/audit`, h),
    ]);
  const details: Json[] = await Promise.all(
    (incidentsRaw as Json[]).map((i) =>
      getJson(`${SAAS_URL}/api/v1/incidents/${encodeURIComponent(i.incident_id)}`, h).catch(() => ({})),
    ),
  );

  // Customer-side views (collector). Optional: the SaaS can be demoed without them.
  let egress: EgressPayloadEntry[] | null = null;
  let raw: RawLogRecord[] | null = null;
  let localStatus: Json | null = null;
  try {
    const [eg, rw, st] = await Promise.all([
      getJson(`${collectorUrlFor(tenantId)}/local/egress?limit=50`),
      getJson(`${collectorUrlFor(tenantId)}/local/raw?limit=60`),
      getJson(`${collectorUrlFor(tenantId)}/local/status`),
    ]);
    localStatus = st;
    egress = (eg as Json[]).map((e) => mapEgress(e, tenantId)).filter((e) => e.tenant_id === tenantId);
    // Lines that carried secrets first: that is what the privacy proof is about
    raw = (rw as Json[]).map(mapRaw).sort((x, y) => Number(y.has_secret) - Number(x.has_secret));
    bufferHistory.push({ time: new Date().toLocaleTimeString(), depth: Number(st.buffer_depth ?? 0) });
    if (bufferHistory.length > 30) bufferHistory.shift();
  } catch {
    /* collector offline or on another machine */
  }

  const collectorsList = collectorsRaw as Json[];
  const collectors: CollectorNode[] = collectorsList.map((c) => ({
    collector_id: c.collector_id,
    tenant_id: tenantId,
    region: c.region ?? "",
    version: c.version ?? "",
    status: c.status === "online" ? "online" : "offline",
    state: c.status === "online" ? asState(c.state ?? "excellent") : "poor",
    last_seen_utc: iso(c.last_seen_utc),
    // During an outage the SaaS only knows the last reported depth; the collector itself knows the truth
    buffer_depth:
      localStatus && localStatus.collector_id === c.collector_id
        ? Number(localStatus.buffer_depth ?? 0)
        : Number(c.buffer_depth ?? 0),
    cpu_pct: Number(c.cpu_pct ?? 0),
    mem_pct: Number(c.mem_pct ?? 0),
    config_hash: c.config_hash ?? "",
    uptime_s:
      localStatus && localStatus.collector_id === c.collector_id ? Number(localStatus.uptime_s ?? 0) : 0,
  }));
  const primaryCollector = collectors[0];

  // metrics → latest values + 15-min history per source (by EVENT time)
  const bySource = new Map<string, Json[]>();
  for (const m of metrics as Json[]) {
    const list = bySource.get(m.source_id) ?? [];
    list.push(m);
    bySource.set(m.source_id, list);
  }

  const alerts = (alertsRaw as Json[]).map((a) => mapAlert(a, tenantId));
  const recommendations = details.flatMap((d) => (d.recommendations ?? []).map(mapRecommendation));
  const incidents = (incidentsRaw as Json[]).map((i) => mapIncident(i, tenantId, alerts, recommendations));

  const openIncidents = new Set(incidents.filter((i) => i.status !== "resolved").map((i) => i.incident_id));
  const sources: MonitoredSource[] = ((overview.sources ?? []) as Json[]).map((s) => {
    const pts = (bySource.get(s.source_id) ?? []).sort((a, b) => a.event_time_utc.localeCompare(b.event_time_utc));
    const latest: Record<string, number | boolean> = {};
    const buckets = new Map<string, MetricPoint>();
    for (const p of pts) {
      latest[p.metric] = p.metric === "service_up" || p.metric === "connectivity_ok" ? p.value >= 1 : p.value;
      const key = new Date(p.event_time_utc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const b = buckets.get(key) ?? { time: key, cpu: 0, memory: 0, latency: 0 };
      if (p.metric === "cpu_pct") b.cpu = p.value;
      if (p.metric === "mem_pct") b.memory = p.value;
      if (p.metric === "latency_ms") b.latency = p.value;
      if (p.metric === "bandwidth_mbps") b.network_mbps = p.value;
      buckets.set(key, b);
    }
    const reason: string = s.reason ?? "";
    return {
      source_id: s.source_id,
      service: s.service ?? "unknown",
      source_type: asSourceType(s.source_type),
      region: primaryCollector?.region ?? "",
      state: asState(s.state),
      reason,
      is_stale: reason.toLowerCase().includes("stale") || reason.toLowerCase().includes("silent"),
      last_seen_utc: iso(s.last_seen_utc),
      last_heartbeat_utc: primaryCollector?.last_seen_utc ?? iso(s.last_seen_utc),
      collector_id: s.collector_id ?? primaryCollector?.collector_id ?? "",
      metrics: latest,
      history: Array.from(buckets.values()).slice(-60),
      active_alerts_count: alerts.filter(
        (a) => a.source_id === s.source_id && (!a.incident_id || openIncidents.has(a.incident_id)),
      ).length,
    };
  });

  const nameOf = (id: string) => sources.find((s) => s.source_id === id)?.service ?? id;
  const healthHistory: HealthHistoryRecord[] = (historyRaw as Json[])
    .map((r, i) => ({
      id: String(r.id ?? `hh_${i}`),
      at_utc: iso(r.at_utc),
      entity_type: (r.entity_type === "collector" ? "collector" : "source") as HealthHistoryRecord["entity_type"],
      entity_id: r.entity_id,
      entity_name: r.entity_type === "service" ? r.entity_id : nameOf(r.entity_id),
      prev_state: asState(r.prev_state ?? "excellent"),
      state: asState(r.state),
      reason: r.reason ?? "",
    }))
    .reverse();

  const audit: AuditLogEntry[] = (auditRaw as Json[])
    .map((a, i) => ({
      id: String(a.id ?? `aud_${i}`),
      at_utc: iso(a.at_utc),
      actor: a.actor ?? "system",
      action: a.action ?? "",
      target: a.target ?? "",
      details: typeof a.details === "string" ? a.details : JSON.stringify(a.details ?? {}),
    }))
    .reverse();

  const gaps = Object.values((reliabilityRaw.seq_gaps ?? {}) as Record<string, number[]>).reduce(
    (n, g) => n + g.length,
    0,
  );
  const reliability: ReliabilityMetrics = {
    tenant_id: tenantId,
    received_count: Number(reliabilityRaw.received_count ?? 0),
    duplicates_rejected: Number(reliabilityRaw.duplicates_rejected ?? 0),
    seq_gaps: gaps,
    latency_p95_s: Number(reliabilityRaw.latency_p95_s ?? 0),
    alert_latency_s_last: Number(reliabilityRaw.alert_latency_s_last ?? 0),
    outage_buffer_history: [...bufferHistory],
    replayed_after_outage: Number(reliabilityRaw.replayed_after_outage ?? 0),
    max_replay_delay_s: Number(reliabilityRaw.max_replay_delay_s ?? 0),
  };

  const notifications: NotificationItem[] = [...alerts]
    .sort((a, b) => b.created_at_utc.localeCompare(a.created_at_utc))
    .slice(0, 20)
    .map((a) => ({
      id: a.alert_id,
      title: `${a.severity.toUpperCase()} · ${a.service}${a.metric ? ` · ${a.metric}` : ""}`,
      message: a.explanation.why,
      type: a.kind === "security" ? "security" : a.severity === "critical" ? "critical" : a.severity === "high" ? "warning" : "info",
      timestamp: a.created_at_utc,
      read: false,
    }));

  const timeline: ActivityTimelineEvent[] = [
    ...incidents.map((i) => ({
      id: `tl_${i.incident_id}`,
      event_type: (i.status === "resolved" ? "incident_resolved" : "incident_created") as ActivityTimelineEvent["event_type"],
      title: i.title,
      description: i.likely_cause,
      timestamp_utc: i.started_utc,
      entity_id: i.incident_id,
      severity: (i.severity === "critical" || i.severity === "high" ? "critical" : "warning") as ActivityTimelineEvent["severity"],
    })),
    ...alerts.map((a) => ({
      id: `tl_${a.alert_id}`,
      event_type: "anomaly_detected" as const,
      title: `${a.kind} · ${a.service}`,
      description: a.explanation.why,
      timestamp_utc: a.created_at_utc,
      entity_id: a.alert_id,
      severity: (a.severity === "critical" ? "critical" : a.severity === "high" ? "warning" : "info") as ActivityTimelineEvent["severity"],
    })),
    ...healthHistory.map((h) => ({
      id: `tl_${h.id}`,
      event_type: (h.entity_type === "collector"
        ? h.state === "poor"
          ? "collector_disconnected"
          : "collector_connected"
        : "health_changed") as ActivityTimelineEvent["event_type"],
      title: `${h.entity_name}: ${h.prev_state} → ${h.state}`,
      description: h.reason,
      timestamp_utc: h.at_utc,
      entity_id: h.entity_id,
      severity: (h.state === "poor" ? "critical" : h.state === "fair" ? "warning" : "success") as ActivityTimelineEvent["severity"],
    })),
  ]
    .sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc))
    .slice(0, 100);

  return {
    sources, collectors, alerts, incidents, recommendations, egress, raw,
    reliability, healthHistory, audit, notifications, timeline,
  };
}

export async function approveLive(recId: string, tenantId: TenantId) {
  return postJson(`${SAAS_URL}/api/v1/recommendations/${encodeURIComponent(recId)}/approve`, authHeader(tenantId));
}

export async function rollbackLive(recId: string, tenantId: TenantId) {
  return postJson(`${SAAS_URL}/api/v1/recommendations/${encodeURIComponent(recId)}/rollback`, authHeader(tenantId));
}

/** Natural-language query against the AIOps engine (connected to Supabase + Gemini API). */
export type ChatTurn = { role: "user" | "bot"; text: string };

export async function sendChatMessage(
  tenantId: TenantId,
  message: string,
  history: ChatTurn[] = []
): Promise<Json> {
  // 1. Next.js server route /api/chat (Supabase context + Gemini, key stays server-side)
  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ tenantId, message, history }),
    });
    if (r.ok) return await r.json();
  } catch {
    // If local /api/chat is unavailable, proceed to backend fallback
  }

  // 2. Fallback to SaaS FastAPI backend
  const r = await fetch(`${SAAS_URL}/api/v1/chat`, {
    method: "POST",
    headers: { ...authHeader(tenantId), "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
    body: JSON.stringify({ message, context: "" }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail ?? `HTTP ${r.status}`);
  return body;
}

/** Streams the assistant's reply chunk by chunk (like ChatGPT). Returns the full text and model name. */
export async function streamChatMessage(
  tenantId: TenantId,
  message: string,
  history: ChatTurn[],
  onText: (fullTextSoFar: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; model: string }> {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal,
    body: JSON.stringify({ tenantId, message, history, stream: true }),
  });
  // Guardrail refusals and errors come back as JSON instead of a stream.
  if ((r.headers.get("content-type") || "").includes("application/json")) {
    const body = await r.json().catch(() => ({}));
    const text = String(body.reply ?? `Something went wrong (HTTP ${r.status}).`);
    onText(text);
    return { text, model: String(body.model ?? "guardrail") };
  }
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  return { text, model: r.headers.get("X-Model") || "unknown" };
}

/** Ingest firewall (collector → receiver gate): rules, counters, recent decisions. Null when backend offline. */
export async function fetchFirewallStatus(tenantId: TenantId): Promise<Json | null> {
  try {
    return await getJson(`${SAAS_URL}/api/v1/firewall/status`, authHeader(tenantId));
  } catch {
    return null;
  }
}

/** Fire synthetic hostile requests at every firewall rule and report which were blocked. */
export async function runFirewallSelftest(tenantId: TenantId): Promise<Json> {
  const r = await fetch(`${SAAS_URL}/api/v1/firewall/selftest`, {
    method: "POST",
    headers: authHeader(tenantId),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail ?? `HTTP ${r.status}`);
  return body;
}

/** Defense-in-depth 5-layer status. Returns null when backend offline. */
export async function fetchSecurityLayers(tenantId: TenantId): Promise<Json | null> {
  try {
    return await getJson(`${SAAS_URL}/api/v1/security/layers`, authHeader(tenantId));
  } catch {
    return null;
  }
}

/** SaaS health (storage backend) + this tenant's collector demo-driver status. Never throws. */
export async function fetchBackendStatus(tenantId: TenantId): Promise<BackendStatus> {
  const out: BackendStatus = {
    live: false, storage: null, collectorReachable: false, scenario: null, secondsLeft: 0, lastResult: null,
  };
  try {
    const h = await getJson(`${SAAS_URL}/api/v1/health`);
    out.live = h.status === "ok";
    out.storage = h.storage ?? null;
  } catch {
    return out;
  }
  try {
    const d = await getJson(`${collectorUrlFor(tenantId)}/local/demo`);
    out.collectorReachable = true;
    out.scenario = d.scenario ?? null;
    out.secondsLeft = Number(d.seconds_left ?? 0);
    out.lastResult = d.last_result && Object.keys(d.last_result).length ? d.last_result : null;
  } catch {
    /* collector not reachable from this browser */
  }
  return out;
}

/** Inject a real scenario through the tenant's collector (demo driver). */
export async function triggerScenarioLive(tenantId: TenantId, scenario: ScenarioId): Promise<Json> {
  const r = await fetch(`${collectorUrlFor(tenantId)}/local/demo/${scenario}`, { method: "POST", cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail ?? `HTTP ${r.status}`);
  return body;
}
