from typing import Any, Dict, List, Optional

def generate_recommendations(incident: Dict[str, Any], alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generate explainable recommendations backed by observed evidence.
    Every recommendation adheres to the guideline:
    'Never claim correlation proves causation - recommendations are hypothesis-driven.'
    """
    recs = []
    incident_id = incident.get("incident_id")
    tenant_id = incident.get("tenant_id")
    metrics_present = {a.get("metric") for a in alerts}
    services = {a.get("service") for a in alerts}
    earliest_signal = incident.get("earliest_signal", {})

    # Extract observed evidence items
    evidence = [
        {
            "alert_id": a.get("alert_id"),
            "metric": a.get("metric"),
            "source_id": a.get("source_id"),
            "event_time_utc": a.get("event_time_utc"),
            "observed": a.get("explanation", {}).get("observed"),
            "z_score": a.get("explanation", {}).get("z_score")
        }
        for a in alerts
    ]

    # 1. CPU / Memory anomaly leading to latency
    if ("cpu_pct" in metrics_present or "mem_pct" in metrics_present) and "latency_ms" in metrics_present:
        primary_svc = list(services)[0] if services else "service"
        recs.append({
            "rec_id": f"rc_{incident_id[-8:]}_01",
            "incident_id": incident_id,
            "tenant_id": tenant_id,
            "action": f"Investigate top resource consumers; scale {primary_svc} +1 replica",
            "reasoning_path": [
                f"Observed resource saturation (earliest: {earliest_signal.get('metric', 'resource')} at {earliest_signal.get('event_time_utc', 'N/A')})",
                "Subsequent latency elevation observed within correlation window",
                "Hypothesis: Local compute/memory constraint degraded response processing time (Note: correlation suggests temporal alignment, not absolute causation)",
                "Action: Scaling provides immediate capacity relief while investigating underlying process bottlenecks"
            ],
            "evidence": evidence,
            "contributing_signals": [f"{a.get('metric')}@{a.get('source_id')}" for a in alerts],
            "confidence": 0.75,
            "risk": "low",
            "requires_approval": True,
            "policy_check": {"allowed": True, "policy": "scale_out_max_1_replica"},
            "rollback_plan": f"Scale {primary_svc} back to previous replica count",
            "status": "proposed"
        })

    # 2. Latency + Packet Loss on network source
    elif "latency_ms" in metrics_present and "packet_loss_pct" in metrics_present:
        recs.append({
            "rec_id": f"rc_{incident_id[-8:]}_02",
            "incident_id": incident_id,
            "tenant_id": tenant_id,
            "action": "Check link/interface on affected switch; reroute traffic via secondary path",
            "reasoning_path": [
                "Simultaneous packet loss and latency escalation detected across network link",
                "Hypothesis: Link congestion or hardware interface degradation along transit route",
                "Action: Rerouting isolates faulty link segment to verify transport recovery"
            ],
            "evidence": evidence,
            "contributing_signals": [f"{a.get('metric')}@{a.get('source_id')}" for a in alerts],
            "confidence": 0.70,
            "risk": "medium",
            "requires_approval": True,
            "policy_check": {"allowed": True, "policy": "automated_reroute_v1"},
            "rollback_plan": "Revert routing table to primary gateway",
            "status": "proposed"
        })

    # 3. Failed login burst
    elif "failed_login_count" in metrics_present:
        recs.append({
            "rec_id": f"rc_{incident_id[-8:]}_03",
            "incident_id": incident_id,
            "tenant_id": tenant_id,
            "action": "Temporarily rate-limit / lock source; review auth logs locally",
            "reasoning_path": [
                "Failed login count breached security threshold in 60s observation window",
                "Hypothesis: Possible credential stuffing, automated scanning, or dictionary probe",
                "Action: Local-only log inspection keeps sensitive credentials and usernames strictly within customer boundary"
            ],
            "evidence": evidence,
            "contributing_signals": [f"failed_logins@{a.get('source_id')}" for a in alerts],
            "confidence": 0.80,
            "risk": "low",
            "requires_approval": True,
            "policy_check": {"allowed": True, "policy": "temp_rate_limit_auth"},
            "rollback_plan": "Remove rate-limiting block from IP/source filter",
            "status": "proposed"
        })

    # 4. Collector offline
    elif any(a.get("kind") == "offline" for a in alerts):
        recs.append({
            "rec_id": f"rc_{incident_id[-8:]}_04",
            "incident_id": incident_id,
            "tenant_id": tenant_id,
            "action": "Check collector host/network connectivity; local buffer guarantees replay",
            "reasoning_path": [
                "Collector missed heartbeats / data transmissions for > 60 seconds",
                "Hypothesis: Network transit interruption or collector process crash",
                "Action: Verify host daemon status; local collector outbox will automatically drain backlog upon reconnection"
            ],
            "evidence": evidence,
            "contributing_signals": ["collector_silence_timeout"],
            "confidence": 0.90,
            "risk": "low",
            "requires_approval": False,
            "policy_check": {"allowed": True, "policy": "collector_watchdog"},
            "rollback_plan": "N/A - autonomous recovery",
            "status": "proposed"
        })

    # 5. Standalone CPU/Memory or Disk anomaly
    elif "cpu_pct" in metrics_present or "disk_pct" in metrics_present:
        recs.append({
            "rec_id": f"rc_{incident_id[-8:]}_05",
            "incident_id": incident_id,
            "tenant_id": tenant_id,
            "action": "Investigate high resource consumption; clean temporary files or extend volume before saturation",
            "reasoning_path": [
                "Sustained statistical deviation observed against 15-minute historical baseline",
                "Hypothesis: Memory leak, unindexed batch job, or unbounded disk log accumulation",
                "Action: Preemptive resource audit prevents cascading service failures"
            ],
            "evidence": evidence,
            "contributing_signals": [f"{a.get('metric')}@{a.get('source_id')}" for a in alerts],
            "confidence": 0.65,
            "risk": "low",
            "requires_approval": True,
            "policy_check": {"allowed": True, "policy": "disk_cleanup_approval"},
            "rollback_plan": "Restore from volume snapshot if required",
            "status": "proposed"
        })

    return recs
