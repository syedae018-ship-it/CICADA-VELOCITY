import {
  TenantId,
  MonitoredSource,
  CollectorNode,
  Incident,
  Alert,
  Recommendation,
  EgressPayloadEntry,
  RawLogRecord,
  ReliabilityMetrics,
  HealthHistoryRecord,
  AuditLogEntry,
  NotificationItem,
  ActivityTimelineEvent,
  TimeRange,
} from "@/types";
import {
  mockSources,
  mockCollectors,
  mockAlerts,
  mockIncidents,
  mockRecommendations,
  mockEgressPayloads,
  mockRawRecords,
  mockReliability,
  mockHealthHistory,
  mockAuditLog,
  mockNotifications,
  mockTimelineEvents,
} from "./mock";
import {
  approveLive,
  fetchBackendStatus,
  fetchLiveSnapshot,
  rollbackLive,
  triggerScenarioLive,
  type LiveSnapshot,
} from "./live";
import type { BackendStatus, ScenarioId } from "@/types";

export const SAAS_URL = process.env.NEXT_PUBLIC_SAAS_URL || "http://localhost:8000";
export const COLLECTOR_URL = process.env.NEXT_PUBLIC_COLLECTOR_URL || "http://localhost:8001";

class DashboardDataStore {
  private sources = JSON.parse(JSON.stringify(mockSources)) as Record<TenantId, MonitoredSource[]>;
  private collectors = JSON.parse(JSON.stringify(mockCollectors)) as Record<TenantId, CollectorNode[]>;
  private alerts = JSON.parse(JSON.stringify(mockAlerts)) as Record<TenantId, Alert[]>;
  private incidents = JSON.parse(JSON.stringify(mockIncidents)) as Record<TenantId, Incident[]>;
  private recommendations = JSON.parse(JSON.stringify(mockRecommendations)) as Record<TenantId, Recommendation[]>;
  private egress = JSON.parse(JSON.stringify(mockEgressPayloads)) as Record<TenantId, EgressPayloadEntry[]>;
  private raw = JSON.parse(JSON.stringify(mockRawRecords)) as RawLogRecord[];
  private reliability = JSON.parse(JSON.stringify(mockReliability)) as Record<TenantId, ReliabilityMetrics>;
  private healthHistory = JSON.parse(JSON.stringify(mockHealthHistory)) as Record<TenantId, HealthHistoryRecord[]>;
  private audit = JSON.parse(JSON.stringify(mockAuditLog)) as Record<TenantId, AuditLogEntry[]>;
  private notifications = JSON.parse(JSON.stringify(mockNotifications)) as Record<TenantId, NotificationItem[]>;
  private timeline = JSON.parse(JSON.stringify(mockTimelineEvents)) as Record<TenantId, ActivityTimelineEvent[]>;

  public timeRange: TimeRange = "15m";
  public useMocks = true;
  /** true once real data has been loaded from the SaaS; false = offline, showing mock data */
  public isLive = false;
  public backend: BackendStatus = {
    live: false, storage: null, collectorReachable: false, scenario: null, secondsLeft: 0, lastResult: null,
  };
  private readNotifications = new Set<string>();

  /** Pull real data from the SaaS + collector into this store. Returns false (and keeps mocks) if unreachable. */
  async syncLive(tenantId: TenantId): Promise<boolean> {
    this.backend = await fetchBackendStatus(tenantId);
    if (!this.backend.live) {
      this.isLive = false;
      return false;
    }
    try {
      const snap: LiveSnapshot = await fetchLiveSnapshot(tenantId);
      this.sources[tenantId] = snap.sources;
      this.collectors[tenantId] = snap.collectors;
      this.alerts[tenantId] = snap.alerts;
      this.incidents[tenantId] = snap.incidents;
      this.recommendations[tenantId] = snap.recommendations;
      if (snap.egress) this.egress[tenantId] = snap.egress;
      if (snap.raw) this.raw = snap.raw;
      this.reliability[tenantId] = snap.reliability;
      this.healthHistory[tenantId] = snap.healthHistory;
      this.audit[tenantId] = snap.audit;
      this.notifications[tenantId] = snap.notifications.map((n) => ({ ...n, read: this.readNotifications.has(n.id) }));
      this.timeline[tenantId] = snap.timeline;
      this.isLive = true;
      this.useMocks = false;
      return true;
    } catch {
      this.isLive = false;
      return false;
    }
  }

  getSources(tenantId: TenantId): MonitoredSource[] {
    return this.sources[tenantId] || [];
  }

  getSourceById(tenantId: TenantId, sourceId: string): MonitoredSource | undefined {
    return (this.sources[tenantId] || []).find((s) => s.source_id === sourceId);
  }

  getCollectors(tenantId: TenantId): CollectorNode[] {
    return this.collectors[tenantId] || [];
  }

  getAlerts(tenantId: TenantId): Alert[] {
    return this.alerts[tenantId] || [];
  }

  getIncidents(tenantId: TenantId): Incident[] {
    return this.incidents[tenantId] || [];
  }

  getRecommendations(tenantId: TenantId): Recommendation[] {
    return this.recommendations[tenantId] || [];
  }

  getEgress(tenantId: TenantId): EgressPayloadEntry[] {
    return this.egress[tenantId] || [];
  }

  getRaw(): RawLogRecord[] {
    return this.raw;
  }

  getReliability(tenantId: TenantId): ReliabilityMetrics {
    return this.reliability[tenantId];
  }

  getHealthHistory(tenantId: TenantId): HealthHistoryRecord[] {
    return this.healthHistory[tenantId] || [];
  }

  getAudit(tenantId: TenantId): AuditLogEntry[] {
    return this.audit[tenantId] || [];
  }

  getNotifications(tenantId: TenantId): NotificationItem[] {
    return this.notifications[tenantId] || [];
  }

  markNotificationRead(tenantId: TenantId, id: string) {
    const list = this.notifications[tenantId] || [];
    const item = list.find((n) => n.id === id);
    if (item) item.read = true;
    this.readNotifications.add(id);
  }

  markAllNotificationsRead(tenantId: TenantId) {
    const list = this.notifications[tenantId] || [];
    list.forEach((n) => {
      n.read = true;
      this.readNotifications.add(n.id);
    });
  }

  getTimeline(tenantId: TenantId): ActivityTimelineEvent[] {
    return this.timeline[tenantId] || [];
  }

  approveRecommendation(recId: string, tenantId: TenantId): Recommendation | null {
    if (this.isLive) {
      // Real approval: SaaS runs the policy check and writes the audit entry; the next sync shows the result.
      approveLive(recId, tenantId).catch((e) => console.error("approve failed", e));
      const rec = (this.recommendations[tenantId] || []).find((r) => r.rec_id === recId) ?? null;
      if (rec) rec.status = "executed_simulated";
      return rec;
    }
    const list = this.recommendations[tenantId];
    const rec = list.find((r) => r.rec_id === recId);
    if (!rec) return null;

    rec.status = "executed_simulated";

    // Add audit entry
    const newAudit: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      at_utc: new Date().toISOString(),
      actor: "secops.operator@cicada.internal (Judge Demo)",
      action: "recommendation.approved_and_executed",
      target: rec.action,
      details: "Policy check passed: scale_out_max_1_replica executed. Replica count incremented.",
    };
    this.audit[tenantId] = [newAudit, ...this.audit[tenantId]];

    // Add timeline event
    this.timeline[tenantId] = [
      {
        id: `act_${Date.now()}`,
        event_type: "incident_resolved",
        title: "Remediation Executed",
        description: `Approved and simulated remediation for ${rec.rec_id}: Replica count scaled.`,
        timestamp_utc: new Date().toISOString(),
        entity_id: rec.rec_id,
        severity: "success",
      },
      ...this.timeline[tenantId],
    ];

    const inc = this.incidents[tenantId].find((i) => i.incident_id === rec.incident_id);
    if (inc) {
      inc.status = "acknowledged";
    }

    return rec;
  }

  rollbackRecommendation(recId: string, tenantId: TenantId): Recommendation | null {
    if (this.isLive) {
      rollbackLive(recId, tenantId).catch((e) => console.error("rollback failed", e));
      const rec = (this.recommendations[tenantId] || []).find((r) => r.rec_id === recId) ?? null;
      if (rec) rec.status = "rolled_back";
      return rec;
    }
    const list = this.recommendations[tenantId];
    const rec = list.find((r) => r.rec_id === recId);
    if (!rec) return null;

    rec.status = "rolled_back";

    const newAudit: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      at_utc: new Date().toISOString(),
      actor: "secops.operator@cicada.internal (Judge Demo)",
      action: "recommendation.rolled_back",
      target: rec.rollback_plan,
      details: "Rollback executed: payments-api reverted to previous replica configuration.",
    };
    this.audit[tenantId] = [newAudit, ...this.audit[tenantId]];

    this.timeline[tenantId] = [
      {
        id: `act_${Date.now()}`,
        event_type: "incident_resolved",
        title: "Remediation Rolled Back",
        description: `Rollback applied for ${rec.rec_id}. Baseline config restored.`,
        timestamp_utc: new Date().toISOString(),
        entity_id: rec.rec_id,
        severity: "warning",
      },
      ...this.timeline[tenantId],
    ];

    return rec;
  }

  /** Live: inject the scenario into the real pipeline. Offline: animate the sample data. */
  async runScenario(scenario: ScenarioId, tenantId: TenantId): Promise<string> {
    if (this.isLive) {
      await triggerScenarioLive(tenantId, scenario);
      return "live";
    }
    if (["normal", "secret", "cpu_spike", "correlation", "logins", "outage"].includes(scenario)) {
      this.applyScenario(scenario as "normal" | "secret" | "cpu_spike" | "correlation" | "logins" | "outage", tenantId);
    }
    return "sample";
  }

  applyScenario(scenario: "normal" | "secret" | "cpu_spike" | "correlation" | "logins" | "outage", tenantId: TenantId) {
    if (scenario === "normal") {
      this.sources[tenantId] = this.sources[tenantId].map((s) => ({
        ...s,
        state: "excellent",
        reason: "All operational metrics nominal",
        active_alerts_count: 0,
        metrics: {
          ...s.metrics,
          cpu_pct: 32.0,
          latency_ms: 18.0,
        },
      }));
      this.incidents[tenantId] = [];
      this.alerts[tenantId] = [];
    } else if (scenario === "cpu_spike") {
      const src = this.sources[tenantId].find((s) => s.service === "payments-api");
      if (src) {
        src.state = "poor";
        src.reason = "CPU 94.2% (+5.1σ above 15m baseline)";
        src.active_alerts_count = 1;
        if (src.metrics) src.metrics.cpu_pct = 94.2;
      }
    } else if (scenario === "outage") {
      const col = this.collectors[tenantId][0];
      if (col) {
        col.buffer_depth = 14;
        col.status = "online";
      }
    }
  }

  // Global search across entities
  search(query: string, tenantId: TenantId) {
    const q = query.trim().toLowerCase();
    if (!q) return { sources: [], collectors: [], incidents: [], recommendations: [] };

    const sources = this.getSources(tenantId).filter(
      (s) =>
        s.service.toLowerCase().includes(q) ||
        s.source_id.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q)
    );

    const collectors = this.getCollectors(tenantId).filter(
      (c) =>
        c.collector_id.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q) ||
        c.version.toLowerCase().includes(q)
    );

    const incidents = this.getIncidents(tenantId).filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.incident_id.toLowerCase().includes(q) ||
        i.likely_cause.toLowerCase().includes(q)
    );

    const recommendations = this.getRecommendations(tenantId).filter(
      (r) =>
        r.action.toLowerCase().includes(q) ||
        r.rec_id.toLowerCase().includes(q) ||
        r.contributing_signals.some((sig) => sig.toLowerCase().includes(q))
    );

    return { sources, collectors, incidents, recommendations };
  }

  // CSV Report Generator
  generateSourcesCsv(tenantId: TenantId): string {
    const sources = this.getSources(tenantId);
    const headers = ["Source ID", "Service", "Type", "Region", "State", "CPU %", "RAM %", "Latency ms", "Last Seen UTC"];
    const rows = sources.map((s) => [
      s.source_id,
      s.service,
      s.source_type,
      s.region,
      s.state,
      s.metrics.cpu_pct ?? "N/A",
      s.metrics.mem_pct ?? "N/A",
      s.metrics.latency_ms ?? "N/A",
      s.last_seen_utc,
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  generateIncidentsCsv(tenantId: TenantId): string {
    const incidents = this.getIncidents(tenantId);
    const headers = ["Incident ID", "Title", "Severity", "Status", "Duration", "Started UTC", "Likely Cause"];
    const rows = incidents.map((i) => [
      i.incident_id,
      `"${i.title.replace(/"/g, '""')}"`,
      i.severity,
      i.status,
      i.duration,
      i.started_utc,
      `"${i.likely_cause.replace(/"/g, '""')}"`,
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  resetStore() {
    this.sources = JSON.parse(JSON.stringify(mockSources));
    this.collectors = JSON.parse(JSON.stringify(mockCollectors));
    this.alerts = JSON.parse(JSON.stringify(mockAlerts));
    this.incidents = JSON.parse(JSON.stringify(mockIncidents));
    this.recommendations = JSON.parse(JSON.stringify(mockRecommendations));
    this.egress = JSON.parse(JSON.stringify(mockEgressPayloads));
    this.raw = JSON.parse(JSON.stringify(mockRawRecords));
    this.reliability = JSON.parse(JSON.stringify(mockReliability));
    this.healthHistory = JSON.parse(JSON.stringify(mockHealthHistory));
    this.audit = JSON.parse(JSON.stringify(mockAuditLog));
    this.notifications = JSON.parse(JSON.stringify(mockNotifications));
    this.timeline = JSON.parse(JSON.stringify(mockTimelineEvents));
  }
}

export const dataStore = new DashboardDataStore();
