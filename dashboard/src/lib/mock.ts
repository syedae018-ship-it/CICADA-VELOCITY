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
} from "@/types";

// ==========================================
// SOURCES WITH HISTORICAL METRICS
// ==========================================
export const mockSources: Record<TenantId, MonitoredSource[]> = {
  t_acme: [
    {
      source_id: "src_9f2c4a1b7e30",
      service: "payments-api",
      source_type: "server",
      region: "ap-south-1",
      state: "poor",
      reason: "CPU 91.4% (4.8σ above 15m baseline) + latency spike 180.2ms",
      is_stale: false,
      last_seen_utc: "2026-11-20T09:15:09Z",
      last_heartbeat_utc: "2026-11-20T09:15:10Z",
      collector_id: "c_blr01",
      active_alerts_count: 2,
      metrics: {
        cpu_pct: 91.4,
        mem_pct: 78.9,
        disk_pct: 61.0,
        latency_ms: 180.2,
        bandwidth_mbps: 284.0,
        packet_loss_pct: 0.2,
        service_up: true,
      },
      history: [
        { time: "09:00", cpu: 36.2, memory: 55.4, latency: 22.0, network_mbps: 180 },
        { time: "09:03", cpu: 37.8, memory: 56.1, latency: 21.8, network_mbps: 195 },
        { time: "09:06", cpu: 38.5, memory: 57.2, latency: 22.4, network_mbps: 210 },
        { time: "09:09", cpu: 42.1, memory: 59.8, latency: 25.1, network_mbps: 230 },
        { time: "09:12", cpu: 74.0, memory: 68.5, latency: 85.0, network_mbps: 260 },
        { time: "09:15", cpu: 91.4, memory: 78.9, latency: 180.2, network_mbps: 284 },
      ],
    },
    {
      source_id: "src_1a2b3c4d5e6f",
      service: "core-switch",
      source_type: "network",
      region: "ap-south-1",
      state: "good",
      reason: "Latency within target (4.1ms), 0.0% packet loss",
      is_stale: false,
      last_seen_utc: "2026-11-20T09:15:04Z",
      last_heartbeat_utc: "2026-11-20T09:15:10Z",
      collector_id: "c_blr01",
      active_alerts_count: 0,
      metrics: {
        latency_ms: 4.1,
        packet_loss_pct: 0.0,
        bandwidth_mbps: 412.0,
        connectivity_ok: true,
      },
      history: [
        { time: "09:00", cpu: 12.0, memory: 28.0, latency: 3.8, network_mbps: 390 },
        { time: "09:03", cpu: 12.5, memory: 28.2, latency: 4.0, network_mbps: 405 },
        { time: "09:06", cpu: 13.1, memory: 28.5, latency: 4.1, network_mbps: 412 },
        { time: "09:09", cpu: 13.4, memory: 28.6, latency: 3.9, network_mbps: 415 },
        { time: "09:12", cpu: 14.0, memory: 28.9, latency: 4.2, network_mbps: 410 },
        { time: "09:15", cpu: 13.8, memory: 28.7, latency: 4.1, network_mbps: 412 },
      ],
    },
    {
      source_id: "src_77aa88bb99cc",
      service: "vpn-gateway",
      source_type: "security",
      region: "ap-south-1",
      state: "fair",
      reason: "14 failed logins burst in 60s from 3 distinct origins",
      is_stale: false,
      last_seen_utc: "2026-11-20T09:15:58Z",
      last_heartbeat_utc: "2026-11-20T09:16:00Z",
      collector_id: "c_blr01",
      active_alerts_count: 1,
      metrics: {
        cpu_pct: 28.4,
        mem_pct: 44.0,
        latency_ms: 18.5,
        service_up: true,
        connectivity_ok: true,
      },
      history: [
        { time: "09:00", cpu: 15.0, memory: 40.0, latency: 14.0, network_mbps: 60 },
        { time: "09:03", cpu: 16.2, memory: 40.5, latency: 15.2, network_mbps: 65 },
        { time: "09:06", cpu: 15.8, memory: 41.0, latency: 14.8, network_mbps: 62 },
        { time: "09:09", cpu: 19.5, memory: 42.2, latency: 16.5, network_mbps: 78 },
        { time: "09:12", cpu: 25.1, memory: 43.1, latency: 17.8, network_mbps: 92 },
        { time: "09:15", cpu: 28.4, memory: 44.0, latency: 18.5, network_mbps: 104 },
      ],
    },
    {
      source_id: "src_db4455667788",
      service: "orders-db",
      source_type: "server",
      region: "ap-south-1",
      state: "excellent",
      reason: "Optimal parameters: CPU 32.1%, latency 12.0ms",
      is_stale: false,
      last_seen_utc: "2026-11-20T09:15:00Z",
      last_heartbeat_utc: "2026-11-20T09:15:10Z",
      collector_id: "c_blr01",
      active_alerts_count: 0,
      metrics: {
        cpu_pct: 32.1,
        mem_pct: 54.0,
        disk_pct: 59.5,
        latency_ms: 12.0,
        service_up: true,
      },
      history: [
        { time: "09:00", cpu: 31.0, memory: 53.0, latency: 11.5, network_mbps: 110 },
        { time: "09:03", cpu: 31.5, memory: 53.2, latency: 11.8, network_mbps: 115 },
        { time: "09:06", cpu: 32.0, memory: 53.8, latency: 12.1, network_mbps: 120 },
        { time: "09:09", cpu: 31.8, memory: 53.9, latency: 11.9, network_mbps: 118 },
        { time: "09:12", cpu: 32.4, memory: 54.1, latency: 12.2, network_mbps: 122 },
        { time: "09:15", cpu: 32.1, memory: 54.0, latency: 12.0, network_mbps: 121 },
      ],
    },
  ],
  t_globex: [
    {
      source_id: "src_abcdef012345",
      service: "web-frontend",
      source_type: "server",
      region: "eu-west-1",
      state: "excellent",
      reason: "All operational metrics nominal",
      is_stale: false,
      last_seen_utc: "2026-11-20T09:15:04Z",
      last_heartbeat_utc: "2026-11-20T09:15:05Z",
      collector_id: "c_fra01",
      active_alerts_count: 0,
      metrics: {
        cpu_pct: 22.0,
        mem_pct: 40.1,
        latency_ms: 35.0,
        service_up: true,
      },
      history: [
        { time: "09:00", cpu: 20.0, memory: 39.0, latency: 34.0, network_mbps: 140 },
        { time: "09:05", cpu: 21.2, memory: 39.5, latency: 34.5, network_mbps: 145 },
        { time: "09:10", cpu: 21.8, memory: 40.0, latency: 35.2, network_mbps: 148 },
        { time: "09:15", cpu: 22.0, memory: 40.1, latency: 35.0, network_mbps: 150 },
      ],
    },
    {
      source_id: "src_fedcba987654",
      service: "checkout-service",
      source_type: "app",
      region: "eu-west-1",
      state: "good",
      reason: "Operating within nominal standard bounds",
      is_stale: false,
      last_seen_utc: "2026-11-20T09:14:40Z",
      last_heartbeat_utc: "2026-11-20T09:15:05Z",
      collector_id: "c_fra01",
      active_alerts_count: 0,
      metrics: {
        cpu_pct: 48.0,
        mem_pct: 61.2,
        latency_ms: 55.4,
        service_up: true,
      },
      history: [
        { time: "09:00", cpu: 44.0, memory: 59.0, latency: 52.0, network_mbps: 90 },
        { time: "09:05", cpu: 46.1, memory: 60.1, latency: 53.5, network_mbps: 95 },
        { time: "09:10", cpu: 47.5, memory: 60.8, latency: 54.8, network_mbps: 98 },
        { time: "09:15", cpu: 48.0, memory: 61.2, latency: 55.4, network_mbps: 100 },
      ],
    },
  ],
};

// ==========================================
// FLEET COLLECTORS
// ==========================================
export const mockCollectors: Record<TenantId, CollectorNode[]> = {
  t_acme: [
    {
      collector_id: "c_blr01",
      tenant_id: "t_acme",
      region: "ap-south-1",
      version: "0.1.0",
      status: "online",
      state: "excellent",
      last_seen_utc: "2026-11-20T09:15:10Z",
      buffer_depth: 0,
      cpu_pct: 3.4,
      mem_pct: 9.9,
      config_hash: "a1b2c3d4e5f6",
      uptime_s: 3605,
      ip_address: "10.0.1.12",
    },
    {
      collector_id: "c_mum02",
      tenant_id: "t_acme",
      region: "ap-south-1",
      version: "0.1.0",
      status: "online",
      state: "excellent",
      last_seen_utc: "2026-11-20T09:15:08Z",
      buffer_depth: 0,
      cpu_pct: 2.8,
      mem_pct: 8.5,
      config_hash: "a1b2c3d4e5f6",
      uptime_s: 7200,
      ip_address: "10.0.2.15",
    },
  ],
  t_globex: [
    {
      collector_id: "c_fra01",
      tenant_id: "t_globex",
      region: "eu-west-1",
      version: "0.1.0",
      status: "online",
      state: "excellent",
      last_seen_utc: "2026-11-20T09:15:05Z",
      buffer_depth: 0,
      cpu_pct: 2.0,
      mem_pct: 8.0,
      config_hash: "ffee00112233",
      uptime_s: 120,
      ip_address: "10.10.1.5",
    },
  ],
};

// ==========================================
// ALERTS
// ==========================================
export const mockAlerts: Record<TenantId, Alert[]> = {
  t_acme: [
    {
      alert_id: "al_01J9X8K7M6N5P4",
      tenant_id: "t_acme",
      source_id: "src_9f2c4a1b7e30",
      service: "payments-api",
      kind: "anomaly",
      metric: "cpu_pct",
      severity: "critical",
      state: "poor",
      event_time_utc: "2026-11-20T09:15:02Z",
      created_at_utc: "2026-11-20T09:15:05Z",
      incident_id: "in_01J9X8K7M6N5P4INC",
      explanation: {
        why: "CPU 91.4% is 4.8σ above its 15-min baseline (mean 38.2%, σ 11.1)",
        observed: 91.4,
        baseline: {
          mean: 38.2,
          std: 11.1,
          window_minutes: 15,
          samples: 180,
        },
        z_score: 4.8,
        threshold_crossed: "fair_max=90 (escalated to Critical/Poor)",
        contributing_signals: [
          { source_id: "src_9f2c4a1b7e30", metric: "cpu_pct", deviation: "+4.8σ", weight: 0.6 },
          { source_id: "src_9f2c4a1b7e30", metric: "latency_ms", deviation: "+3.1σ", weight: 0.4 },
        ],
        confidence: 0.86,
      },
    },
    {
      alert_id: "al_01J9X8K7M6N5P5",
      tenant_id: "t_acme",
      source_id: "src_9f2c4a1b7e30",
      service: "payments-api",
      kind: "anomaly",
      metric: "latency_ms",
      severity: "high",
      state: "fair",
      event_time_utc: "2026-11-20T09:15:22Z",
      created_at_utc: "2026-11-20T09:15:25Z",
      incident_id: "in_01J9X8K7M6N5P4INC",
      explanation: {
        why: "Latency rose 180.2ms (+3.1σ above baseline 22.4ms)",
        observed: 180.2,
        baseline: {
          mean: 22.4,
          std: 5.2,
          window_minutes: 15,
          samples: 180,
        },
        z_score: 3.1,
        threshold_crossed: "good_max=100 (escalated to Fair)",
        contributing_signals: [
          { source_id: "src_9f2c4a1b7e30", metric: "latency_ms", deviation: "+3.1σ", weight: 0.7 },
          { source_id: "src_9f2c4a1b7e30", metric: "cpu_pct", deviation: "+4.8σ", weight: 0.3 },
        ],
        confidence: 0.82,
      },
    },
    {
      alert_id: "al_01J9X8K7M6N5P6",
      tenant_id: "t_acme",
      source_id: "src_77aa88bb99cc",
      service: "vpn-gateway",
      kind: "security",
      metric: "failed_login_burst",
      severity: "medium",
      state: "fair",
      event_time_utc: "2026-11-20T09:15:58Z",
      created_at_utc: "2026-11-20T09:16:00Z",
      explanation: {
        why: "14 failed logins in 60s from 3 distinct origins (threshold count_fair=5)",
        observed: 14,
        baseline: {
          mean: 0.4,
          std: 0.8,
          window_minutes: 60,
          samples: 60,
        },
        z_score: 4.1,
        threshold_crossed: "count_fair=5",
        contributing_signals: [
          { source_id: "src_77aa88bb99cc", metric: "failed_login_burst", deviation: "+4.1σ", weight: 1.0 },
        ],
        confidence: 0.94,
      },
    },
  ],
  t_globex: [],
};

// ==========================================
// INCIDENTS
// ==========================================
export const mockIncidents: Record<TenantId, Incident[]> = {
  t_acme: [
    {
      incident_id: "in_01J9X8K7M6N5P4INC",
      tenant_id: "t_acme",
      title: "payments-api degradation: Compute saturation & downstream latency",
      status: "open",
      severity: "critical",
      started_utc: "2026-11-20T09:15:02Z",
      updated_utc: "2026-11-20T09:15:25Z",
      first_detected_utc: "2026-11-20T09:15:02Z",
      duration: "14m 22s",
      alert_ids: ["al_01J9X8K7M6N5P4", "al_01J9X8K7M6N5P5"],
      alert_count: 2,
      suppressed_duplicates: 7,
      affected_sources: ["src_9f2c4a1b7e30"],
      likely_cause: "Resource saturation on src_9f2c4a1b7e30 preceded latency rise on dependent payments service",
      correlation_rule: "Same service within 120s window; earliest anomaly = likely cause",
      suggested_resolution: "Scale payments-api service replica count by +1 or redistribute active worker threads",
    },
  ],
  t_globex: [],
};

// ==========================================
// RECOMMENDATIONS
// ==========================================
export const mockRecommendations: Record<TenantId, Recommendation[]> = {
  t_acme: [
    {
      rec_id: "rc_01J9X8K7M6N5REC",
      incident_id: "in_01J9X8K7M6N5P4INC",
      action: "Investigate top CPU consumers on src_9f2c4a1b7e30; scale payments-api replica by +1 replica",
      reasoning_path: [
        "1. CPU anomaly first observed at 09:15:02Z (+4.8σ above 15-min baseline).",
        "2. Latency on payments-api rose 20 seconds later at 09:15:22Z (+3.1σ).",
        "3. Core switch (src_1a2b3c4d5e6f) reports 0.0% packet loss and 4.1ms latency, ruling out network layer issues.",
        "4. Conclusion: Local compute bottleneck on payments-api host. Scaling out replica will redistribute load.",
      ],
      contributing_signals: ["cpu_pct@src_9f2c4a1b7e30", "latency_ms@src_9f2c4a1b7e30"],
      confidence: 0.88,
      risk: "low",
      requires_approval: true,
      policy_check: {
        allowed: true,
        policy: "scale_out_max_1_replica (policy checks passed ✓)",
      },
      rollback_plan: "Scale payments-api back to original replica count (auto-snapshot saved)",
      status: "proposed",
    },
  ],
  t_globex: [],
};

// ==========================================
// EGRESS PROOF PAYLOADS
// ==========================================
export const mockEgressPayloads: Record<TenantId, EgressPayloadEntry[]> = {
  t_acme: [
    {
      payload_id: "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
      tenant_id: "t_acme",
      seq: 102,
      sent_at_utc: "2026-11-20T09:15:10Z",
      sha256: "b89d4f09a82e9f6bc06a4b12c8e3a24681c3d1e9f0a2b3c4d5e6f7a8b9c0d1e2",
      attempts: 1,
      result: "delivered",
      matches_saas: true,
      body: {
        schema_version: "1.0",
        payload_id: "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
        tenant_id: "t_acme",
        collector_id: "c_blr01",
        region: "ap-south-1",
        seq: 102,
        sent_at_utc: "2026-11-20T09:15:10Z",
        source_tz: "Asia/Kolkata",
        window: { start_utc: "2026-11-20T09:15:05Z", end_utc: "2026-11-20T09:15:10Z" },
        sources: [
          {
            source_id: "src_9f2c4a1b7e30",
            source_type: "server",
            service: "payments-api",
            event_time_utc: "2026-11-20T09:15:09Z",
            metrics: { cpu_pct: 91.4, mem_pct: 78.9, disk_pct: 61.0, latency_ms: 180.2, service_up: true },
          },
        ],
        events: [
          {
            event_id: "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
            event_time_utc: "2026-11-20T09:15:09Z",
            source_id: "src_9f2c4a1b7e30",
            category: "resource",
            severity: "high",
            type: "resource_pressure",
            count: 1,
            summary: "CPU above 90% on src_9f2c4a1b7e30 (payments-api)",
          },
        ],
        collector_health: { version: "0.1.0", cpu_pct: 3.4, mem_pct: 9.9, buffer_depth: 0, config_hash: "a1b2c3d4e5f6", uptime_s: 3605 },
        redaction_stats: { records_in: 40, secrets_redacted: 0, fields_dropped: 80 },
      },
    },
    {
      payload_id: "3f6c1e2a-8b4d-4c1e-9a7f-1d2e3f4a5b6c",
      tenant_id: "t_acme",
      seq: 101,
      sent_at_utc: "2026-11-20T09:15:05Z",
      sha256: "9e3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c",
      attempts: 1,
      result: "delivered",
      matches_saas: true,
      body: {
        schema_version: "1.0",
        payload_id: "3f6c1e2a-8b4d-4c1e-9a7f-1d2e3f4a5b6c",
        tenant_id: "t_acme",
        collector_id: "c_blr01",
        region: "ap-south-1",
        seq: 101,
        sent_at_utc: "2026-11-20T09:15:05Z",
        source_tz: "Asia/Kolkata",
        window: { start_utc: "2026-11-20T09:15:00Z", end_utc: "2026-11-20T09:15:05Z" },
        sources: [
          {
            source_id: "src_9f2c4a1b7e30",
            source_type: "server",
            service: "payments-api",
            event_time_utc: "2026-11-20T09:15:04Z",
            metrics: { cpu_pct: 38.5, mem_pct: 57.2, disk_pct: 61.0, latency_ms: 22.4, service_up: true },
          },
          {
            source_id: "src_1a2b3c4d5e6f",
            source_type: "network",
            service: "core-switch",
            event_time_utc: "2026-11-20T09:15:04Z",
            metrics: { latency_ms: 4.1, packet_loss_pct: 0.0, bandwidth_mbps: 412.0, connectivity_ok: true },
          },
        ],
        events: [],
        collector_health: { version: "0.1.0", cpu_pct: 3.2, mem_pct: 9.8, buffer_depth: 0, config_hash: "a1b2c3d4e5f6", uptime_s: 3600 },
        redaction_stats: { records_in: 42, secrets_redacted: 0, fields_dropped: 84 },
      },
    },
    {
      payload_id: "c4d5e6f7-a8b9-4c0d-9e1f-2a3b4c5d6e7f",
      tenant_id: "t_acme",
      seq: 103,
      sent_at_utc: "2026-11-20T09:16:00Z",
      sha256: "4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
      attempts: 1,
      result: "delivered",
      matches_saas: true,
      body: {
        schema_version: "1.0",
        payload_id: "c4d5e6f7-a8b9-4c0d-9e1f-2a3b4c5d6e7f",
        tenant_id: "t_acme",
        collector_id: "c_blr01",
        region: "ap-south-1",
        seq: 103,
        sent_at_utc: "2026-11-20T09:16:00Z",
        source_tz: "Asia/Kolkata",
        window: { start_utc: "2026-11-20T09:15:00Z", end_utc: "2026-11-20T09:16:00Z" },
        sources: [],
        events: [
          {
            event_id: "d5e6f7a8-b9c0-4d1e-8f2a-3b4c5d6e7f80",
            event_time_utc: "2026-11-20T09:15:58Z",
            source_id: "src_77aa88bb99cc",
            category: "auth",
            severity: "high",
            type: "failed_login_burst",
            count: 14,
            summary: "14 failed logins in 60s on src_77aa88bb99cc from 3 distinct origins",
          },
        ],
        collector_health: { version: "0.1.0", cpu_pct: 3.1, mem_pct: 9.8, buffer_depth: 0, config_hash: "a1b2c3d4e5f6", uptime_s: 3655 },
        redaction_stats: { records_in: 14, secrets_redacted: 2, fields_dropped: 56 },
      },
    },
  ],
  t_globex: [
    {
      payload_id: "0a1b2c3d-4e5f-4061-8273-8495a6b7c8d9",
      tenant_id: "t_globex",
      seq: 1,
      sent_at_utc: "2026-11-20T09:15:05Z",
      sha256: "7f8e9d0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e",
      attempts: 1,
      result: "delivered",
      matches_saas: true,
      body: {
        schema_version: "1.0",
        payload_id: "0a1b2c3d-4e5f-4061-8273-8495a6b7c8d9",
        tenant_id: "t_globex",
        collector_id: "c_fra01",
        region: "eu-west-1",
        seq: 1,
        sent_at_utc: "2026-11-20T09:15:05Z",
        source_tz: "Europe/Berlin",
        sources: [
          {
            source_id: "src_abcdef012345",
            source_type: "server",
            service: "web-frontend",
            event_time_utc: "2026-11-20T09:15:04Z",
            metrics: { cpu_pct: 22.0, mem_pct: 40.1, latency_ms: 35.0, service_up: true },
          },
        ],
        events: [],
      },
    },
  ],
};

// ==========================================
// PRIVACY PROOF: RAW RECORDS VS REDACTED VS SAAS
// ==========================================
export const mockRawRecords: RawLogRecord[] = [
  {
    id: "raw_01",
    kind: "log",
    ts: "2026-11-20T09:15:05Z",
    host: "db-prod-01.acme.local",
    ip: "10.0.4.17",
    service: "payments-api",
    source_type: "app",
    level: "ERROR",
    message: "DB connect failed user=admin password=hunter2 Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.abcdefghijk",
    has_secret: true,
    secret_type: "password & bearer_token",
    secret_value: "password=hunter2, Bearer eyJhbGci...",
    redacted_message: "DB connect failed user=admin password=[REDACTED] Authorization: Bearer [REDACTED]",
    saas_ingested: {
      metrics_sent: { cpu_pct: 38.5, mem_pct: 57.2, latency_ms: 22.4 },
      event_sent: null,
      secrets_leaked_to_saas: 0,
    },
  },
  {
    id: "raw_02",
    kind: "auth",
    ts: "2026-11-20T09:15:30Z",
    host: "vpn-gw-01.acme.local",
    ip: "10.0.9.2",
    service: "vpn",
    source_type: "security",
    user: "alice@acme.com",
    src_ip: "203.0.113.9",
    message: "Auth failure for user alice@acme.com from 203.0.113.9 - Invalid password attempt",
    has_secret: true,
    secret_type: "PII (email & public IP)",
    secret_value: "alice@acme.com, 203.0.113.9",
    redacted_message: "Auth failure for user [REDACTED_USER] from [REDACTED_IP] - Invalid password attempt",
    saas_ingested: {
      metrics_sent: null,
      event_sent: { category: "auth", type: "failed_login_burst", count: 14, summary: "14 failed logins in 60s on src_77aa88bb99cc from 3 distinct origins" },
      secrets_leaked_to_saas: 0,
    },
  },
  {
    id: "raw_03",
    kind: "flow",
    ts: "2026-11-20T09:15:31Z",
    host: "core-sw-01",
    ip: "10.0.0.1",
    service: "core-switch",
    source_type: "network",
    src_ip: "10.0.4.17",
    message: "Flow session: 10.0.4.17 -> 10.0.8.3 bytes=48211 latency=4.1ms loss=0.0%",
    has_secret: false,
    redacted_message: "Flow session: [INTERNAL_NET] -> [INTERNAL_NET] bytes=48211 latency=4.1ms loss=0.0%",
    saas_ingested: {
      metrics_sent: { latency_ms: 4.1, packet_loss_pct: 0.0, bandwidth_mbps: 412.0, connectivity_ok: true },
      event_sent: null,
      secrets_leaked_to_saas: 0,
    },
  },
];

// ==========================================
// RELIABILITY METRICS
// ==========================================
export const mockReliability: Record<TenantId, ReliabilityMetrics> = {
  t_acme: {
    tenant_id: "t_acme",
    received_count: 1420,
    duplicates_rejected: 12,
    seq_gaps: 0,
    latency_p95_s: 4.2,
    alert_latency_s_last: 2.8,
    outage_buffer_history: [
      { time: "09:00", depth: 0 },
      { time: "09:05", depth: 0 },
      { time: "09:10", depth: 4 },
      { time: "09:11", depth: 8 },
      { time: "09:12", depth: 12 },
      { time: "09:13", depth: 5 },
      { time: "09:14", depth: 1 },
      { time: "09:15", depth: 0 },
    ],
  },
  t_globex: {
    tenant_id: "t_globex",
    received_count: 380,
    duplicates_rejected: 1,
    seq_gaps: 0,
    latency_p95_s: 3.1,
    alert_latency_s_last: 1.9,
    outage_buffer_history: [
      { time: "09:00", depth: 0 },
      { time: "09:05", depth: 0 },
      { time: "09:10", depth: 0 },
      { time: "09:15", depth: 0 },
    ],
  },
};

// ==========================================
// HEALTH HISTORY (TRANSITIONS)
// ==========================================
export const mockHealthHistory: Record<TenantId, HealthHistoryRecord[]> = {
  t_acme: [
    {
      id: "hh_01",
      at_utc: "2026-11-20T09:15:09Z",
      entity_type: "source",
      entity_id: "src_9f2c4a1b7e30",
      entity_name: "payments-api",
      prev_state: "fair",
      state: "poor",
      reason: "CPU rose to 91.4% (exceeded fair_max=90% threshold, z-score +4.8σ)",
    },
    {
      id: "hh_02",
      at_utc: "2026-11-20T09:15:02Z",
      entity_type: "source",
      entity_id: "src_9f2c4a1b7e30",
      entity_name: "payments-api",
      prev_state: "good",
      state: "fair",
      reason: "CPU exceeded baseline z-score anomaly threshold (z > 3.0)",
    },
    {
      id: "hh_03",
      at_utc: "2026-11-20T09:14:50Z",
      entity_type: "source",
      entity_id: "src_77aa88bb99cc",
      entity_name: "vpn-gateway",
      prev_state: "excellent",
      state: "fair",
      reason: "Failed login burst exceeded 5 attempts in 60s window (count=14)",
    },
    {
      id: "hh_04",
      at_utc: "2026-11-20T08:30:00Z",
      entity_type: "collector",
      entity_id: "c_blr01",
      entity_name: "c_blr01 (ap-south-1)",
      prev_state: "poor",
      state: "excellent",
      reason: "Heartbeat re-established and buffer fully drained (buffer_depth=0)",
    },
  ],
  t_globex: [
    {
      id: "hh_g01",
      at_utc: "2026-11-20T09:10:00Z",
      entity_type: "source",
      entity_id: "src_abcdef012345",
      entity_name: "web-frontend",
      prev_state: "good",
      state: "excellent",
      reason: "Latency decreased to 35ms, resource load nominal",
    },
  ],
};

// ==========================================
// AUDIT LOG
// ==========================================
export const mockAuditLog: Record<TenantId, AuditLogEntry[]> = {
  t_acme: [
    {
      id: "aud_01",
      at_utc: "2026-11-20T09:16:10Z",
      actor: "system@velocity.cicada",
      action: "recommendation.proposed",
      target: "payments-api (src_9f2c4a1b7e30)",
      details: "Proposed scale-out recommendation rc_01J9X8K7M6N5REC",
    },
    {
      id: "aud_00",
      at_utc: "2026-11-20T08:00:00Z",
      actor: "admin@acme.com",
      action: "collector.registered",
      target: "c_blr01",
      details: "Collector authenticated with HMAC key in ap-south-1",
    },
  ],
  t_globex: [],
};

// ==========================================
// NOTIFICATIONS
// ==========================================
export const mockNotifications: Record<TenantId, NotificationItem[]> = {
  t_acme: [
    {
      id: "notif_01",
      title: "Critical Anomaly: payments-api",
      message: "CPU utilization spiked to 91.4% (+4.8σ above baseline). Incident opened.",
      type: "critical",
      timestamp: "2 mins ago",
      read: false,
      linkTab: "incidents",
    },
    {
      id: "notif_02",
      title: "Security Alert: VPN Burst",
      message: "14 failed logins detected on vpn-gateway. Local IP redacted.",
      type: "security",
      timestamp: "8 mins ago",
      read: false,
      linkTab: "privacy",
    },
    {
      id: "notif_03",
      title: "Collector Heartbeat Re-established",
      message: "Collector c_blr01 buffer drained successfully. 0 drops recorded.",
      type: "info",
      timestamp: "45 mins ago",
      read: true,
      linkTab: "fleet",
    },
  ],
  t_globex: [
    {
      id: "notif_g1",
      title: "Collector Online",
      message: "c_fra01 active in eu-west-1. Ingestion verified.",
      type: "info",
      timestamp: "10 mins ago",
      read: true,
      linkTab: "fleet",
    },
  ],
};

// ==========================================
// ACTIVITY TIMELINE EVENTS
// ==========================================
export const mockTimelineEvents: Record<TenantId, ActivityTimelineEvent[]> = {
  t_acme: [
    {
      id: "act_01",
      event_type: "anomaly_detected",
      title: "Compute Anomaly Detected",
      description: "payments-api CPU utilization reached 91.4% (z-score +4.8σ). Escalated to Poor.",
      timestamp_utc: "2026-11-20T09:15:02Z",
      entity_id: "src_9f2c4a1b7e30",
      severity: "critical",
    },
    {
      id: "act_02",
      event_type: "incident_created",
      title: "Incident in_01J9X8K7M6N5P4INC Opened",
      description: "Correlated CPU saturation and downstream latency rise. Recommended scale-out generated.",
      timestamp_utc: "2026-11-20T09:15:05Z",
      entity_id: "in_01J9X8K7M6N5P4INC",
      severity: "critical",
    },
    {
      id: "act_03",
      event_type: "metadata_transmitted",
      title: "Payload Seq #102 Exported",
      description: "Egress verified: 40 records processed, 0 secrets crossed trust boundary. SHA-256 confirmed.",
      timestamp_utc: "2026-11-20T09:15:10Z",
      entity_id: "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
      severity: "info",
    },
    {
      id: "act_04",
      event_type: "anomaly_detected",
      title: "Security Brute-force Burst",
      description: "14 failed logins detected on vpn-gateway. Local tier redacted usernames and client IPs.",
      timestamp_utc: "2026-11-20T09:15:58Z",
      entity_id: "src_77aa88bb99cc",
      severity: "warning",
    },
    {
      id: "act_05",
      event_type: "collector_connected",
      title: "Collector c_blr01 Initialized",
      description: "HMAC-SHA256 handshake successful in ap-south-1. Local SQLite outbox verified clean.",
      timestamp_utc: "2026-11-20T08:00:00Z",
      entity_id: "c_blr01",
      severity: "success",
    },
  ],
  t_globex: [
    {
      id: "act_g1",
      event_type: "collector_connected",
      title: "Collector c_fra01 Connected",
      description: "Initial registration in eu-west-1. Baseline monitoring commenced.",
      timestamp_utc: "2026-11-20T09:10:00Z",
      entity_id: "c_fra01",
      severity: "success",
    },
    {
      id: "act_g2",
      event_type: "metadata_transmitted",
      title: "Telemetry Batch Ingested",
      description: "Payload Seq #1 delivered with 0 errors.",
      timestamp_utc: "2026-11-20T09:15:05Z",
      entity_id: "0a1b2c3d-4e5f-4061-8273-8495a6b7c8d9",
      severity: "info",
    },
  ],
};
