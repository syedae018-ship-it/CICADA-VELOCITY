import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from .baseline import get_baseline
from .health import STATE_RANK, evaluate_metric_state
from .thresholds import THRESHOLDS

NOISE_FLOORS = {
    "cpu_pct": 2.0,
    "mem_pct": 2.0,
    "disk_pct": 1.0,
    "latency_ms": 5.0,
    "packet_loss_pct": 0.2
}

# Consecutive anomaly counter: (tenant_id, source_id, metric) -> int
CONSECUTIVE_ANOMALIES: Dict[tuple, int] = {}

def evaluate_metrics_and_detect_alerts(tenant_id: str, source: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], str, str]:
    source_id = source.get("source_id", "unknown")
    service = source.get("service", "unknown")
    event_time_utc = source.get("event_time_utc", datetime.now(timezone.utc).isoformat())
    metrics = source.get("metrics", {})

    alerts = []
    metric_states_and_reasons = []

    anomaly_cfg = THRESHOLDS.get("anomaly", {})
    z_good = anomaly_cfg.get("z_good", 2.0)
    z_fair = anomaly_cfg.get("z_fair", 3.0)
    z_poor = anomaly_cfg.get("z_poor", 4.5)

    for metric, value in metrics.items():
        if isinstance(value, bool):
            st, r = evaluate_metric_state(metric, value)
            metric_states_and_reasons.append((st, r))
            if st in ("fair", "poor"):
                alerts.append({
                    "alert_id": f"al_{uuid.uuid4().hex[:12]}",
                    "tenant_id": tenant_id,
                    "source_id": source_id,
                    "service": service,
                    "kind": "threshold",
                    "metric": metric,
                    "severity": "critical" if st == "poor" else "medium",
                    "state": st,
                    "event_time_utc": event_time_utc,
                    "created_at_utc": datetime.now(timezone.utc).isoformat(),
                    "incident_id": None,
                    "explanation": {
                        "why": f"{metric} boolean flag violated: observed {value} (state={st})",
                        "observed": value,
                        "threshold_crossed": f"{metric}=={value}",
                        "confidence": 0.95
                    }
                })
            continue

        if not isinstance(value, (int, float)):
            continue

        # Baseline & Anomaly
        baseline = get_baseline(tenant_id, source_id, metric)
        noise_floor = NOISE_FLOORS.get(metric, 1.0)
        z = baseline.zscore(value, noise_floor=noise_floor)
        is_anom = baseline.is_anomalous(z, threshold_z=z_good)

        counter_key = (tenant_id, source_id, metric)
        if is_anom:
            CONSECUTIVE_ANOMALIES[counter_key] = CONSECUTIVE_ANOMALIES.get(counter_key, 0) + 1
        else:
            CONSECUTIVE_ANOMALIES[counter_key] = 0
            # Only add non-anomalous samples to baseline
            baseline.add(event_time_utc, value)

        consecutive = CONSECUTIVE_ANOMALIES.get(counter_key, 0)

        # Static threshold check
        static_state, static_reason = evaluate_metric_state(metric, value)
        current_metric_state = static_state
        current_reason = static_reason

        # Anomaly elevation if consecutive >= 2
        if consecutive >= 2:
            mean, std, samples = baseline.stats()
            anom_state = "good"
            severity = "low"
            if abs(z) >= z_poor:
                anom_state = "poor"
                severity = "critical"
            elif abs(z) >= z_fair:
                anom_state = "fair"
                severity = "high"
            elif abs(z) >= z_good:
                anom_state = "good"
                severity = "medium"

            if STATE_RANK.get(anom_state, 0) > STATE_RANK.get(current_metric_state, 0):
                current_metric_state = anom_state
                current_reason = f"{metric} {value} is {z:+.1f}σ vs baseline ({mean:.1f}±{std:.1f})"

            why_text = f"{metric} {value} is {z:+.1f}σ above baseline (mean {mean:.1f}, σ {std:.1f})"
            alerts.append({
                "alert_id": f"al_{uuid.uuid4().hex[:12]}",
                "tenant_id": tenant_id,
                "source_id": source_id,
                "service": service,
                "kind": "anomaly",
                "metric": metric,
                "severity": severity,
                "state": current_metric_state,
                "event_time_utc": event_time_utc,
                "created_at_utc": datetime.now(timezone.utc).isoformat(),
                "incident_id": None,
                "explanation": {
                    "why": why_text,
                    "observed": value,
                    "baseline": {
                        "mean": round(mean, 2),
                        "std": round(std, 2),
                        "window_minutes": 15,
                        "samples": samples
                    },
                    "z_score": round(z, 2),
                    "threshold_crossed": static_reason or f"z >= {z_good}",
                    "contributing_signals": [
                        {"source_id": source_id, "metric": metric, "deviation": f"{z:+.1f}σ", "weight": 1.0}
                    ],
                    "confidence": min(0.95, round(0.5 + 0.1 * abs(z), 2))
                }
            })
        elif static_state in ("fair", "poor"):
            # Static threshold alert
            alerts.append({
                "alert_id": f"al_{uuid.uuid4().hex[:12]}",
                "tenant_id": tenant_id,
                "source_id": source_id,
                "service": service,
                "kind": "threshold",
                "metric": metric,
                "severity": "critical" if static_state == "poor" else "high",
                "state": static_state,
                "event_time_utc": event_time_utc,
                "created_at_utc": datetime.now(timezone.utc).isoformat(),
                "incident_id": None,
                "explanation": {
                    "why": static_reason or f"{metric} breached threshold",
                    "observed": value,
                    "threshold_crossed": static_reason,
                    "confidence": 0.85
                }
            })

        metric_states_and_reasons.append((current_metric_state, current_reason))

    # Overall source state
    from .health import get_worst_state
    src_state, src_reason = get_worst_state(metric_states_and_reasons)
    return alerts, src_state, src_reason

def evaluate_security_events(tenant_id: str, events: List[Dict[str, Any]], source_service_map: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """
    Unified signal processing for structured events across categories:
    auth, network, resource, availability, collector.
    Processes templated summaries without assuming unavailable trace/raw fields.
    """
    alerts = []
    sec_cfg = THRESHOLDS.get("security", {}).get("failed_login_burst", {})
    count_fair = sec_cfg.get("count_fair", 5)
    count_poor = sec_cfg.get("count_poor", 20)

    for ev in events:
        ev_type = ev.get("type", "unknown")
        category = ev.get("category", "general")
        count = ev.get("count", 1)
        source_id = ev.get("source_id", "unknown")
        service = (source_service_map or {}).get(source_id) or "auth-service" if category == "auth" else "infra-service"
        event_time_utc = ev.get("event_time_utc", datetime.now(timezone.utc).isoformat())
        summary = ev.get("summary", "")

        state = "good"
        severity = ev.get("severity", "low")

        if ev_type == "failed_login_burst":
            if count >= count_poor:
                state = "poor"
                severity = "critical"
            elif count >= count_fair:
                state = "fair"
                severity = "high"

            why_text = f"{count} failed logins detected in window (severity {severity})"
            if summary:
                why_text += f" | Summary: {summary}"

            alerts.append({
                "alert_id": f"al_{uuid.uuid4().hex[:12]}",
                "tenant_id": tenant_id,
                "source_id": source_id,
                "service": service,
                "kind": "security",
                "metric": "failed_login_count",
                "severity": severity,
                "state": state,
                "event_time_utc": event_time_utc,
                "created_at_utc": datetime.now(timezone.utc).isoformat(),
                "incident_id": None,
                "explanation": {
                    "why": why_text,
                    "observed": count,
                    "threshold_crossed": f"count_fair={count_fair}, count_poor={count_poor}",
                    "confidence": 0.9,
                    "event_summary": summary
                }
            })
        elif category in ("network", "availability", "resource"):
            # Process structured operational events
            state = "fair" if severity in ("medium", "high") else "poor" if severity == "critical" else "good"
            alerts.append({
                "alert_id": f"al_{uuid.uuid4().hex[:12]}",
                "tenant_id": tenant_id,
                "source_id": source_id,
                "service": service,
                "kind": "event",
                "metric": ev_type,
                "severity": severity,
                "state": state,
                "event_time_utc": event_time_utc,
                "created_at_utc": datetime.now(timezone.utc).isoformat(),
                "incident_id": None,
                "explanation": {
                    "why": f"Structured {category} event: {ev_type} ({summary or 'no summary'})",
                    "observed": count,
                    "threshold_crossed": f"severity={severity}",
                    "confidence": 0.85,
                    "event_summary": summary
                }
            })

    return alerts
