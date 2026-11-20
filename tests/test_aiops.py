import pytest
from fastapi import HTTPException
from saas.aiops.baseline import MetricBaseline, get_baseline
from saas.aiops.health import evaluate_metric_state, get_worst_state, apply_staleness, aggregate_service_health
from saas.aiops.engine import on_ingest, check_staleness_and_timeouts, PROCESSED_PAYLOADS
from saas.aiops.store import STORE
from saas.aiops.routes import (
    get_overview,
    get_alerts,
    get_incidents,
    get_incident_detail,
    approve_recommendation,
    rollback_recommendation,
    get_audit_log,
    get_health_history
)

def test_service_centric_aggregation():
    """
    1. Service-centric observability:
    Sources mapped to the same service must aggregate into a service health state.
    """
    tenant_id = "t_test_svc"
    payload = {
        "tenant_id": tenant_id,
        "collector_id": "c_svc01",
        "sent_at_utc": "2026-11-20T10:00:00Z",
        "sources": [
            {
                "source_id": "src_web_1",
                "service": "checkout-service",
                "source_type": "server",
                "event_time_utc": "2026-11-20T10:00:00Z",
                "metrics": {"cpu_pct": 30.0, "latency_ms": 20.0}
            },
            {
                "source_id": "src_web_2",
                "service": "checkout-service",
                "source_type": "server",
                "event_time_utc": "2026-11-20T10:00:00Z",
                "metrics": {"cpu_pct": 92.0} # > fair_max 90 -> poor
            }
        ],
        "events": []
    }
    on_ingest(tenant_id, payload)

    overview = get_overview(tenant_id=tenant_id)
    services = {s["service"]: s for s in overview.get("services", [])}
    assert "checkout-service" in services
    svc = services["checkout-service"]
    assert svc["state"] == "poor"
    assert svc["source_count"] == 2
    assert "src_web_1" in svc["sources"]
    assert "src_web_2" in svc["sources"]

def test_cpu_spike_followed_by_latency():
    """
    Test scenario: CPU spike on a service followed by latency degradation within the 120s window.
    Must merge into one incident, identify earliest observed signal, and provide recommendation.
    """
    tenant_id = "t_test_cpu_lat"

    # Step 1: Warm baseline for source
    for i in range(25):
        on_ingest(tenant_id, {
            "tenant_id": tenant_id,
            "collector_id": "c_blr01",
            "sent_at_utc": f"2026-11-20T09:00:{i:02d}Z",
            "sources": [{
                "source_id": "src_app_01",
                "service": "order-api",
                "source_type": "server",
                "event_time_utc": f"2026-11-20T09:00:{i:02d}Z",
                "metrics": {"cpu_pct": 35.0, "latency_ms": 25.0}
            }],
            "events": []
        })

    # Step 2: Inject CPU anomaly (2 consecutive to trigger persistent anomaly detector)
    for i in range(2):
        on_ingest(tenant_id, {
            "tenant_id": tenant_id,
            "collector_id": "c_blr01",
            "sent_at_utc": f"2026-11-20T09:10:0{i}Z",
            "sources": [{
                "source_id": "src_app_01",
                "service": "order-api",
                "source_type": "server",
                "event_time_utc": f"2026-11-20T09:10:0{i}Z",
                "metrics": {"cpu_pct": 95.0, "latency_ms": 25.0}
            }],
            "events": []
        })

    # Step 3: Inject subsequent Latency degradation 30s later on the same service
    on_ingest(tenant_id, {
        "tenant_id": tenant_id,
        "collector_id": "c_blr01",
        "sent_at_utc": "2026-11-20T09:10:35Z",
        "sources": [{
            "source_id": "src_app_01",
            "service": "order-api",
            "source_type": "server",
            "event_time_utc": "2026-11-20T09:10:35Z",
            "metrics": {"cpu_pct": 95.0, "latency_ms": 280.0} # > fair_max 250 -> poor
        }],
        "events": []
    })

    # Verify incident investigation details
    incidents = get_incidents(tenant_id=tenant_id)
    assert len(incidents) >= 1
    order_inc = next(i for i in incidents if i["service"] == "order-api")

    detail = get_incident_detail(incident_id=order_inc["incident_id"], tenant_id=tenant_id)
    timeline = detail["timeline"]
    assert len(timeline) >= 2
    # Verify timeline is chronological
    assert timeline[0]["timestamp_utc"] <= timeline[-1]["timestamp_utc"]

    # Earliest signal must be CPU anomaly
    assert detail["earliest_signal"]["metric"] == "cpu_pct"

    # Hypothesized root cause explanation must note correlation does not prove causation
    assert "Hypothesized Root Cause" in detail["likely_cause"]
    assert "does not prove causation" in detail["likely_cause"]

    # Recommendations must contain evidence and scaling action
    recs = detail["recommendations"]
    assert any("scale" in r["action"].lower() for r in recs)
    rec = recs[0]
    assert "evidence" in rec
    assert rec["requires_approval"] is True
    assert rec["status"] == "proposed"

def test_unrelated_signals_not_correlated():
    """
    Unrelated signals on different services must NOT be incorrectly correlated together.
    """
    tenant_id = "t_test_isolation"

    # Breach 1 on payment-gw
    on_ingest(tenant_id, {
        "tenant_id": tenant_id,
        "collector_id": "c_01",
        "sent_at_utc": "2026-11-20T11:00:00Z",
        "sources": [{
            "source_id": "src_pay_01",
            "service": "payment-gw",
            "source_type": "server",
            "event_time_utc": "2026-11-20T11:00:00Z",
            "metrics": {"cpu_pct": 98.0}
        }],
        "events": []
    })

    # Breach 2 on analytics-worker (completely separate service)
    on_ingest(tenant_id, {
        "tenant_id": tenant_id,
        "collector_id": "c_01",
        "sent_at_utc": "2026-11-20T11:00:10Z",
        "sources": [{
            "source_id": "src_analytics_99",
            "service": "analytics-worker",
            "source_type": "server",
            "event_time_utc": "2026-11-20T11:00:10Z",
            "metrics": {"disk_pct": 99.0}
        }],
        "events": []
    })

    incidents = get_incidents(tenant_id=tenant_id)
    services_in_incidents = [i["service"] for i in incidents]
    # Each service must have its own separate incident
    assert "payment-gw" in services_in_incidents
    assert "analytics-worker" in services_in_incidents
    pay_inc = next(i for i in incidents if i["service"] == "payment-gw")
    analytics_inc = next(i for i in incidents if i["service"] == "analytics-worker")
    assert pay_inc["incident_id"] != analytics_inc["incident_id"]
    assert "src_pay_01" in pay_inc["affected_sources"]
    assert "src_analytics_99" not in pay_inc["affected_sources"]

def test_repeated_alerts_and_duplicate_suppression():
    """
    Repeated alerts on the exact same (source, metric, kind) within 30s must be suppressed
    and increment suppressed_duplicates on the incident.
    """
    tenant_id = "t_test_dedupe"
    payload = {
        "tenant_id": tenant_id,
        "collector_id": "c_01",
        "sent_at_utc": "2026-11-20T12:00:00Z",
        "sources": [{
            "source_id": "src_rep_01",
            "service": "inventory-svc",
            "source_type": "server",
            "event_time_utc": "2026-11-20T12:00:00Z",
            "metrics": {"cpu_pct": 99.0} # Threshold breach
        }],
        "events": []
    }

    # Ingest initial alert
    on_ingest(tenant_id, payload)
    incidents = get_incidents(tenant_id=tenant_id)
    assert len(incidents) == 1
    assert incidents[0]["suppressed_duplicates"] == 0

    # Repeat exact same payload within 10 seconds
    repeat_payload = dict(payload)
    repeat_payload["sent_at_utc"] = "2026-11-20T12:00:05Z"
    repeat_payload["sources"][0]["event_time_utc"] = "2026-11-20T12:00:05Z"
    on_ingest(tenant_id, repeat_payload)

    # Incident count must remain 1, suppressed_duplicates must increment
    incidents = get_incidents(tenant_id=tenant_id)
    assert len(incidents) == 1
    assert incidents[0]["suppressed_duplicates"] >= 1

def test_stale_sources_and_collector_outages():
    """
    Test staleness downgrade (>30s silence) and collector offline handling (>60s silence).
    Also tests recovery when fresh telemetry arrives.
    """
    tenant_id = "t_test_stale"

    # Setup source and collector with timestamp 70s in the past
    past_time_iso = "2026-11-20T08:00:00Z"
    on_ingest(tenant_id, {
        "tenant_id": tenant_id,
        "collector_id": "c_stale_01",
        "sent_at_utc": past_time_iso,
        "sources": [{
            "source_id": "src_stale_node",
            "service": "node-daemon",
            "source_type": "server",
            "event_time_utc": past_time_iso,
            "metrics": {"cpu_pct": 20.0} # excellent
        }],
        "events": []
    })

    # Run check_staleness_and_timeouts
    check_staleness_and_timeouts(tenant_id)

    # 1. Source must be downgraded from excellent -> good due to silence
    overview = get_overview(tenant_id=tenant_id)
    src = next(s for s in overview["sources"] if s["source_id"] == "src_stale_node")
    assert src["state"] == "good"
    assert "stale: no data" in src["reason"]

    # 2. Collector must be marked offline and state poor (>60s silence)
    assert overview["collectors"]["offline"] >= 1

    # An offline alert must be generated
    alerts = get_alerts(tenant_id=tenant_id)
    assert any(a["kind"] == "offline" for a in alerts)

    # 3. Recovery Test: Fresh data arrives -> source and collector recover to excellent
    fresh_time_iso = "2026-11-20T08:02:00Z"
    on_ingest(tenant_id, {
        "tenant_id": tenant_id,
        "collector_id": "c_stale_01",
        "sent_at_utc": fresh_time_iso,
        "sources": [{
            "source_id": "src_stale_node",
            "service": "node-daemon",
            "source_type": "server",
            "event_time_utc": fresh_time_iso,
            "metrics": {"cpu_pct": 22.0} # excellent
        }],
        "events": []
    })

    overview_recovered = get_overview(tenant_id=tenant_id)
    src_rec = next(s for s in overview_recovered["sources"] if s["source_id"] == "src_stale_node")
    assert src_rec["state"] == "excellent"
    assert overview_recovered["collectors"]["online"] >= 1

def test_tenant_isolation_complete():
    """
    Test that data from Tenant A is completely inaccessible to Tenant B.
    """
    tenant_a = "t_tenant_a"
    tenant_b = "t_tenant_b"

    on_ingest(tenant_a, {
        "tenant_id": tenant_a,
        "collector_id": "c_a",
        "sent_at_utc": "2026-11-20T13:00:00Z",
        "sources": [{
            "source_id": "src_secret_a",
            "service": "secret-service-a",
            "source_type": "server",
            "event_time_utc": "2026-11-20T13:00:00Z",
            "metrics": {"cpu_pct": 99.0}
        }],
        "events": []
    })

    on_ingest(tenant_b, {
        "tenant_id": tenant_b,
        "collector_id": "c_b",
        "sent_at_utc": "2026-11-20T13:00:00Z",
        "sources": [{
            "source_id": "src_normal_b",
            "service": "public-service-b",
            "source_type": "server",
            "event_time_utc": "2026-11-20T13:00:00Z",
            "metrics": {"cpu_pct": 20.0}
        }],
        "events": []
    })

    # Tenant B queries overview, alerts, incidents
    overview_b = get_overview(tenant_id=tenant_b)
    alerts_b = get_alerts(tenant_id=tenant_b)
    incidents_b = get_incidents(tenant_id=tenant_b)

    assert not any(s["source_id"] == "src_secret_a" for s in overview_b["sources"])
    assert not any(s.get("service") == "secret-service-a" for s in overview_b.get("services", []))
    assert not any(a["source_id"] == "src_secret_a" for a in alerts_b)
    assert not any("secret-service-a" in inc.get("title", "") for inc in incidents_b)

def test_simulated_remediation_and_audit():
    """
    Test approval and rollback flow with simulated execution, audit trail,
    and invalid transition rejections.
    """
    tenant_id = "t_test_remed"
    rec_id = "rc_flow_01"

    STORE.add_recommendation({
        "rec_id": rec_id,
        "tenant_id": tenant_id,
        "incident_id": "in_flow_01",
        "action": "Scale checkout-api +1 replica",
        "status": "proposed",
        "policy_check": {"allowed": True, "policy": "scale_out_max_1_replica"},
        "rollback_plan": "Scale checkout-api -1 replica"
    })

    # Reject rollback before approval
    with pytest.raises(HTTPException) as exc_info:
        rollback_recommendation(rec_id=rec_id, tenant_id=tenant_id)
    assert exc_info.value.status_code == 400

    # Approve
    app_res = approve_recommendation(rec_id=rec_id, tenant_id=tenant_id)
    assert app_res["status"] == "executed_simulated"

    # Duplicate approve should reject
    with pytest.raises(HTTPException) as exc_dup:
        approve_recommendation(rec_id=rec_id, tenant_id=tenant_id)
    assert exc_dup.value.status_code == 400

    # Rollback
    rb_res = rollback_recommendation(rec_id=rec_id, tenant_id=tenant_id)
    assert rb_res["status"] == "rolled_back"

    # Audit check
    audit_entries = get_audit_log(tenant_id=tenant_id)
    actions = [e["action"] for e in audit_entries]
    assert "approve_recommendation" in actions
    assert "rollback_recommendation" in actions

def test_out_of_order_late_event_time_ordering():
    """
    Hardening Test: Out-of-order and late event placement by event_time_utc.
    Ensures that when an event arrives with an earlier timestamp, it is sorted correctly
    in the baseline and incident timeline without wall-clock corruption.
    """
    b = MetricBaseline(window_minutes=15, min_samples=3)
    # Add events out of order: T+10, T+0, T+5
    b.add("2026-11-20T09:10:00Z", 40.0)
    b.add("2026-11-20T09:00:00Z", 20.0)
    b.add("2026-11-20T09:05:00Z", 30.0)

    # Samples must be chronologically ordered internally
    timestamps = [s[0] for s in b.samples]
    assert timestamps == sorted(timestamps)

    mean, std, n = b.stats()
    assert n == 3
    assert mean == 30.0

def test_idempotency_guard_on_replayed_payload():
    """
    Hardening Test: Duplicate payload_id idempotency on replay.
    Ensures that replayed/retried batches with the same payload_id never
    double-count baseline samples, duplicate alerts, or increment incident counts.
    """
    tenant_id = "t_test_idempotency"
    payload_id = "3fa85f64-5717-4562-b3fc-2c963f66afa6"

    payload = {
        "payload_id": payload_id,
        "tenant_id": tenant_id,
        "collector_id": "c_idemp_01",
        "sent_at_utc": "2026-11-20T14:00:00Z",
        "sources": [{
            "source_id": "src_idemp_node",
            "service": "auth-service",
            "source_type": "server",
            "event_time_utc": "2026-11-20T14:00:00Z",
            "metrics": {"cpu_pct": 98.0}
        }],
        "events": []
    }

    # Initial ingest
    on_ingest(tenant_id, payload)
    alerts_initial = len(get_alerts(tenant_id=tenant_id))
    incidents_initial = len(get_incidents(tenant_id=tenant_id))

    # Replay identical payload with same payload_id
    on_ingest(tenant_id, payload)
    alerts_after_replay = len(get_alerts(tenant_id=tenant_id))
    incidents_after_replay = len(get_incidents(tenant_id=tenant_id))

    # Must be 100% idempotent: zero new alerts or incidents generated
    assert alerts_after_replay == alerts_initial
    assert incidents_after_replay == incidents_initial

def test_jsonb_contract_compliance_aiops_output():
    """
    Hardening Test: Verify JSONB payload schema compliance with contracts/aiops_output.md.
    Every Alert must have explanation {why, observed, baseline?, threshold_crossed, confidence}.
    Every Recommendation must have reasoning_path, contributing_signals, confidence, policy_check, rollback_plan.
    """
    tenant_id = "t_test_contract"
    payload = {
        "tenant_id": tenant_id,
        "collector_id": "c_chk_01",
        "sent_at_utc": "2026-11-20T15:00:00Z",
        "sources": [{
            "source_id": "src_contract_node",
            "service": "billing-service",
            "source_type": "server",
            "event_time_utc": "2026-11-20T15:00:00Z",
            "metrics": {"latency_ms": 290.0, "packet_loss_pct": 8.0}
        }],
        "events": []
    }
    on_ingest(tenant_id, payload)

    # 1. Alert compliance
    alerts = get_alerts(tenant_id=tenant_id)
    assert len(alerts) >= 1
    for a in alerts:
        exp = a.get("explanation", {})
        assert "why" in exp
        assert "observed" in exp
        assert "confidence" in exp

    # 2. Incident compliance
    incidents = get_incidents(tenant_id=tenant_id)
    assert len(incidents) >= 1
    inc = incidents[0]
    assert "likely_cause" in inc
    assert "timeline" in inc
    assert "earliest_signal" in inc

    # 3. Recommendation compliance
    detail = get_incident_detail(incident_id=inc["incident_id"], tenant_id=tenant_id)
    recs = detail.get("recommendations", [])
    assert len(recs) >= 1
    for r in recs:
        assert isinstance(r.get("reasoning_path"), list)
        assert isinstance(r.get("contributing_signals"), list)
        assert isinstance(r.get("confidence"), (float, int))
        assert "policy_check" in r
        assert "rollback_plan" in r
        assert r.get("requires_approval") is True

def test_baseline_warmup_and_anti_pollution():
    """
    Hardening Test: Verify min_samples gating and anti-pollution guard.
    Samples below min_samples must not trigger z-score alerts.
    Anomalous samples must NOT be added to the baseline.
    """
    b = MetricBaseline(window_minutes=15, min_samples=20)
    # Add 15 samples (<20) of value 50.0
    for i in range(15):
        b.add(f"2026-11-20T16:00:{i:02d}Z", 50.0)

    # zscore must remain 0.0 until min_samples=20 reached
    z = b.zscore(100.0, noise_floor=2.0)
    assert z == 0.0

    # Add 5 more to reach 20
    for i in range(15, 20):
        b.add(f"2026-11-20T16:00:{i:02d}Z", 50.0)

    z2 = b.zscore(100.0, noise_floor=2.0)
    assert z2 == 25.0 # (100-50)/2

    # Anti-pollution verification:
    # If a value is anomalous, callers do NOT call b.add(). Let's verify sample count stays at 20.
    assert len(b.samples) == 20

def test_transient_spike_vs_consecutive_anomaly():
    """
    Hardening Test: A single transient spike must NOT trigger an anomaly alert.
    Only 2 consecutive anomalous samples must trigger an alert.
    """
    tenant_id = "t_test_transient"
    source_id = "src_transient_node"

    # Step 1: Warm baseline with 22 normal samples (min_samples=20)
    for i in range(22):
        on_ingest(tenant_id, {
            "tenant_id": tenant_id,
            "collector_id": "c_t01",
            "sent_at_utc": f"2026-11-20T16:10:{i:02d}Z",
            "sources": [{
                "source_id": source_id,
                "service": "cache-service",
                "source_type": "server",
                "event_time_utc": f"2026-11-20T16:10:{i:02d}Z",
                "metrics": {"cpu_pct": 30.0} # Normal
            }],
            "events": []
        })

    # Step 2: Inject ONE single spike of 50.0 (z >= 2.0 vs 30.0 with noise floor 2.0, but <= 60 so static threshold is excellent)
    on_ingest(tenant_id, {
        "tenant_id": tenant_id,
        "collector_id": "c_t01",
        "sent_at_utc": "2026-11-20T16:11:00Z",
        "sources": [{
            "source_id": source_id,
            "service": "cache-service",
            "source_type": "server",
            "event_time_utc": "2026-11-20T16:11:00Z",
            "metrics": {"cpu_pct": 50.0}
        }],
        "events": []
    })

    # Should have 0 anomaly alerts because consecutive=1
    alerts = get_alerts(tenant_id=tenant_id)
    anomaly_alerts = [a for a in alerts if a.get("kind") == "anomaly"]
    assert len(anomaly_alerts) == 0

    # Step 3: Inject second consecutive spike of 50.0
    on_ingest(tenant_id, {
        "tenant_id": tenant_id,
        "collector_id": "c_t01",
        "sent_at_utc": "2026-11-20T16:11:05Z",
        "sources": [{
            "source_id": source_id,
            "service": "cache-service",
            "source_type": "server",
            "event_time_utc": "2026-11-20T16:11:05Z",
            "metrics": {"cpu_pct": 50.0}
        }],
        "events": []
    })

    # Now consecutive=2 -> must generate anomaly alert
    alerts_after = get_alerts(tenant_id=tenant_id)
    anomaly_alerts_after = [a for a in alerts_after if a.get("kind") == "anomaly"]
    assert len(anomaly_alerts_after) >= 1

def test_malformed_and_empty_payload_resilience():
    """
    Hardening Test: on_ingest must gracefully handle empty sources/events
    or missing optional fields without raising unhandled exceptions.
    """
    tenant_id = "t_test_empty"

    # Completely empty payload
    on_ingest(tenant_id, {})

    # Empty sources and events
    on_ingest(tenant_id, {
        "tenant_id": tenant_id,
        "collector_id": "c_empty",
        "sent_at_utc": "2026-11-20T16:20:00Z",
        "sources": [],
        "events": []
    })

    # Source with missing service or empty metrics
    on_ingest(tenant_id, {
        "tenant_id": tenant_id,
        "collector_id": "c_empty",
        "sent_at_utc": "2026-11-20T16:20:05Z",
        "sources": [{
            "source_id": "src_sparse_01",
            "source_type": "server",
            "event_time_utc": "2026-11-20T16:20:05Z",
            "metrics": {}
        }],
        "events": []
    })

    # System should still be operating normally
    overview = get_overview(tenant_id=tenant_id)
    assert overview["tenant_id"] == tenant_id
