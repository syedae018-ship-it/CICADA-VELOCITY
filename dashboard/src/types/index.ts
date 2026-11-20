export type TenantId = "t_acme" | "t_globex";

export type HealthState = "excellent" | "good" | "fair" | "poor";

export type SourceType = "server" | "network" | "security" | "app";

export type TimeRange = "15m" | "1h" | "6h" | "24h" | "7d";

export interface MetricPoint {
  time: string;
  cpu: number;
  memory: number;
  latency: number;
  network_mbps?: number;
}

export interface MetricValues {
  cpu_pct?: number;
  mem_pct?: number;
  disk_pct?: number;
  latency_ms?: number;
  packet_loss_pct?: number;
  bandwidth_mbps?: number;
  service_up?: boolean;
  connectivity_ok?: boolean;
}

export interface MonitoredSource {
  source_id: string;
  service: string;
  source_type: SourceType;
  region: string;
  state: HealthState;
  reason: string;
  is_stale: boolean;
  last_seen_utc: string;
  last_heartbeat_utc: string;
  collector_id: string;
  metrics: MetricValues;
  history: MetricPoint[];
  active_alerts_count: number;
}

export interface CollectorNode {
  collector_id: string;
  tenant_id: TenantId;
  region: string;
  version: string;
  status: "online" | "offline";
  state: HealthState;
  last_seen_utc: string;
  buffer_depth: number;
  cpu_pct: number;
  mem_pct: number;
  config_hash: string;
  uptime_s: number;
  ip_address?: string;
}

export interface AlertExplanation {
  why: string;
  observed: number;
  baseline: {
    mean: number;
    std: number;
    window_minutes: number;
    samples: number;
  };
  z_score: number;
  threshold_crossed: string;
  contributing_signals: {
    source_id: string;
    metric: string;
    deviation: string;
    weight: number;
  }[];
  confidence: number;
}

export interface Alert {
  alert_id: string;
  tenant_id: TenantId;
  source_id: string;
  service: string;
  kind: "anomaly" | "threshold" | "security" | "offline" | "stale";
  metric: string;
  severity: "low" | "medium" | "high" | "critical";
  state: HealthState;
  event_time_utc: string;
  created_at_utc: string;
  incident_id?: string;
  explanation: AlertExplanation;
}

export interface Incident {
  incident_id: string;
  tenant_id: TenantId;
  title: string;
  status: "open" | "acknowledged" | "resolved";
  severity: "low" | "medium" | "high" | "critical";
  started_utc: string;
  updated_utc: string;
  first_detected_utc: string;
  duration: string;
  alert_ids: string[];
  alert_count: number;
  suppressed_duplicates: number;
  affected_sources: string[];
  likely_cause: string;
  correlation_rule: string;
  suggested_resolution: string;
  alerts?: Alert[];
}

export interface Recommendation {
  rec_id: string;
  incident_id: string;
  action: string;
  reasoning_path: string[];
  contributing_signals: string[];
  confidence: number;
  risk: "low" | "medium" | "high";
  requires_approval: boolean;
  policy_check: {
    allowed: boolean;
    policy: string;
  };
  rollback_plan: string;
  status: "proposed" | "approved" | "executed_simulated" | "rolled_back" | "rejected";
}

export interface EgressPayloadEntry {
  payload_id: string;
  tenant_id: TenantId;
  seq: number;
  sent_at_utc: string;
  sha256: string;
  attempts: number;
  result: "delivered" | "buffered" | "duplicate_ack" | "failed";
  body: Record<string, unknown>;
  matches_saas: boolean;
}

export interface RawLogRecord {
  id: string;
  kind: "metric" | "log" | "auth" | "flow";
  ts: string;
  host: string;
  ip: string;
  service: string;
  source_type: string;
  level?: string;
  user?: string;
  src_ip?: string;
  message?: string;
  has_secret: boolean;
  secret_type?: string;
  secret_value?: string;
  redacted_message?: string;
  saas_ingested: {
    metrics_sent: Record<string, unknown> | null;
    event_sent: Record<string, unknown> | null;
    secrets_leaked_to_saas: number;
  };
}

export interface ReliabilityMetrics {
  tenant_id: TenantId;
  received_count: number;
  duplicates_rejected: number;
  seq_gaps: number;
  latency_p95_s: number;
  alert_latency_s_last: number;
  outage_buffer_history: { time: string; depth: number }[];
  replayed_after_outage?: number;
  max_replay_delay_s?: number;
}

export interface HealthHistoryRecord {
  id: string;
  at_utc: string;
  entity_type: "source" | "collector";
  entity_id: string;
  entity_name: string;
  prev_state: HealthState;
  state: HealthState;
  reason: string;
}

export interface AuditLogEntry {
  id: string;
  at_utc: string;
  actor: string;
  action: string;
  target: string;
  details: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "critical" | "warning" | "info" | "security";
  timestamp: string;
  read: boolean;
  linkTab?: DashboardTab;
}

export interface ActivityTimelineEvent {
  id: string;
  event_type:
    | "collector_connected"
    | "collector_disconnected"
    | "health_changed"
    | "anomaly_detected"
    | "incident_created"
    | "incident_resolved"
    | "metadata_transmitted";
  title: string;
  description: string;
  timestamp_utc: string;
  entity_id: string;
  severity: "info" | "warning" | "critical" | "success";
}

export type DashboardTab =
  | "overview"
  | "sources"
  | "fleet"
  | "incidents"
  | "ai_insights"
  | "egress"
  | "privacy"
  | "reliability"
  | "timeline"
  | "history"
  | "reports";

export type ScenarioId =
  | "normal"
  | "secret"
  | "cpu_spike"
  | "latency"
  | "correlation"
  | "logins"
  | "outage"
  | "duplicate"
  | "out_of_order";

export const SCENARIOS: { id: ScenarioId; label: string; tab: DashboardTab }[] = [
  { id: "normal", label: "Normal operations", tab: "overview" },
  { id: "secret", label: "Secret in a raw log", tab: "privacy" },
  { id: "cpu_spike", label: "CPU deviates from baseline", tab: "incidents" },
  { id: "latency", label: "Network latency rises", tab: "sources" },
  { id: "correlation", label: "Several alerts, one incident", tab: "incidents" },
  { id: "logins", label: "Repeated failed logins", tab: "incidents" },
  { id: "outage", label: "Collector loses SaaS (75 s)", tab: "fleet" },
  { id: "duplicate", label: "Duplicate delivery", tab: "reliability" },
  { id: "out_of_order", label: "Out-of-order events", tab: "reliability" },
];

export interface BackendStatus {
  live: boolean;
  storage: string | null; // "supabase" | "sqlite"
  collectorReachable: boolean;
  scenario: string | null;
  secondsLeft: number;
  lastResult: Record<string, unknown> | null;
}
