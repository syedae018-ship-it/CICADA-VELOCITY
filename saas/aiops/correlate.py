import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from .recommend import generate_recommendations

class Correlator:
    def __init__(self, window_seconds: int = 120):
        self.window_seconds = window_seconds
        # Active incidents: tenant_id -> list of incident dicts
        self.active_incidents: Dict[str, List[Dict[str, Any]]] = {}
        # Duplicate alert suppression tracker: (tenant_id, source_id, metric, kind) -> last_seen_epoch
        self.recent_alerts: Dict[tuple, float] = {}

    def _parse_time(self, time_val: Any) -> float:
        if isinstance(time_val, (int, float)):
            return float(time_val)
        if isinstance(time_val, str):
            clean = time_val.replace("Z", "+00:00")
            return datetime.fromisoformat(clean).timestamp()
        return datetime.now(timezone.utc).timestamp()

    def process_alert(self, alert: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], bool, List[Dict[str, Any]]]:
        """
        Process an alert into correlated incidents with full investigation trail:
        - Maintains an incident timeline
        - Tracks contributing signals
        - Clearly separates earliest observed signal from hypothesized cause
        - Explains why signals were grouped
        - Suppresses exact duplicates within 30s
        """
        tenant_id = alert["tenant_id"]
        source_id = alert.get("source_id", "")
        service = alert.get("service", "")
        metric = alert.get("metric", "")
        kind = alert.get("kind", "")
        alert_time = self._parse_time(alert.get("event_time_utc"))

        # Duplicate suppression check (same source, metric, kind within 30s)
        dedupe_key = (tenant_id, source_id, metric, kind)
        if dedupe_key in self.recent_alerts:
            last_time = self.recent_alerts[dedupe_key]
            if alert_time - last_time < 30.0:
                for inc in self.active_incidents.get(tenant_id, []):
                    if service and service in inc["title"] or source_id in inc["affected_sources"]:
                        inc["suppressed_duplicates"] += 1
                        inc["updated_utc"] = datetime.now(timezone.utc).isoformat()
                        return inc, True, []
                return None, True, []

        self.recent_alerts[dedupe_key] = alert_time

        # Match to existing open incident within window
        # CRITERIA: same service name OR same source_id within correlation window
        tenant_incidents = self.active_incidents.setdefault(tenant_id, [])
        matched_incident = None

        for inc in tenant_incidents:
            if inc["status"] != "open":
                continue
            started = self._parse_time(inc["started_utc"])
            if abs(alert_time - started) <= self.window_seconds:
                # Correlate if same service (when service is defined and not unknown)
                if service and service != "unknown" and service == inc.get("service"):
                    matched_incident = inc
                    break
                # Or if same source
                if source_id and source_id in inc.get("affected_sources", []):
                    matched_incident = inc
                    break

        timeline_entry = {
            "timestamp_utc": alert.get("event_time_utc"),
            "alert_id": alert.get("alert_id"),
            "source_id": source_id,
            "service": service,
            "metric": metric,
            "kind": kind,
            "severity": alert.get("severity"),
            "observed": alert.get("explanation", {}).get("observed"),
            "description": alert.get("explanation", {}).get("why", "")
        }

        signal_ref = f"{metric}@{source_id}"

        new_recs = []
        if matched_incident:
            matched_incident["alert_ids"].append(alert["alert_id"])
            matched_incident["alert_count"] = len(matched_incident["alert_ids"])
            if source_id not in matched_incident["affected_sources"]:
                matched_incident["affected_sources"].append(source_id)
            matched_incident["updated_utc"] = datetime.now(timezone.utc).isoformat()
            alert["incident_id"] = matched_incident["incident_id"]

            if signal_ref not in matched_incident.get("contributing_signals", []):
                matched_incident["contributing_signals"].append(signal_ref)

            matched_incident["timeline"].append(timeline_entry)
            # Ensure timeline is chronologically sorted
            matched_incident["timeline"].sort(key=lambda x: self._parse_time(x["timestamp_utc"]))

            # Formulate clear grouping reason and hypothesis
            group_reason = (
                f"Signals correlated because they share service '{matched_incident['service']}' "
                f"or source within a {self.window_seconds}s temporal window."
            )
            matched_incident["correlation_explanation"] = group_reason

            # Hypothesized root cause vs earliest observed signal
            earliest = matched_incident["timeline"][0]
            matched_incident["earliest_signal"] = {
                "metric": earliest["metric"],
                "source_id": earliest["source_id"],
                "event_time_utc": earliest["timestamp_utc"],
                "description": earliest["description"]
            }
            matched_incident["likely_cause"] = (
                f"Hypothesized Root Cause: Initial anomaly observed on {earliest['metric']} at "
                f"{earliest['source_id']} preceded subsequent disruptions. "
                "(Note: Temporal precedence suggests correlation, which warrants investigation but does not prove causation.)"
            )

            metrics_in_inc = list(dict.fromkeys(
                [t["metric"].split("_")[0] for t in matched_incident["timeline"] if t.get("metric")]
            ))
            matched_incident["title"] = f"{matched_incident['service']} degradation: {' + '.join(metrics_in_inc)}"

            # Gather all alerts matching this incident for recommendation generation
            all_alerts_in_incident = [
                {
                    "alert_id": t.get("alert_id"),
                    "source_id": t.get("source_id"),
                    "service": t.get("service"),
                    "metric": t.get("metric"),
                    "kind": t.get("kind"),
                    "severity": t.get("severity"),
                    "event_time_utc": t.get("timestamp_utc"),
                    "explanation": {"observed": t.get("observed"), "why": t.get("description")}
                }
                for t in matched_incident["timeline"]
            ]
            new_recs = generate_recommendations(matched_incident, all_alerts_in_incident)
            return matched_incident, False, new_recs
        else:
            inc_id = f"in_{uuid.uuid4().hex[:12]}"
            alert["incident_id"] = inc_id
            new_incident = {
                "incident_id": inc_id,
                "tenant_id": tenant_id,
                "service": service,
                "title": f"{service} degradation: {metric}",
                "status": "open",
                "severity": alert.get("severity", "medium"),
                "started_utc": alert.get("event_time_utc"),
                "updated_utc": datetime.now(timezone.utc).isoformat(),
                "alert_ids": [alert["alert_id"]],
                "alert_count": 1,
                "suppressed_duplicates": 0,
                "affected_sources": [source_id] if source_id else [],
                "contributing_signals": [signal_ref],
                "timeline": [timeline_entry],
                "earliest_signal": {
                    "metric": metric,
                    "source_id": source_id,
                    "event_time_utc": alert.get("event_time_utc"),
                    "description": alert.get("explanation", {}).get("why", "")
                },
                "likely_cause": f"Initial {kind} on {metric} at {source_id} triggered the incident investigation.",
                "correlation_rule": f"same service or source within {self.window_seconds}s window; earliest anomaly = candidate trigger",
                "correlation_explanation": f"Incident initiated from initial anomalous breach on service '{service}'."
            }
            tenant_incidents.append(new_incident)
            new_recs = generate_recommendations(new_incident, [alert])
            return new_incident, False, new_recs

CORRELATOR = Correlator()
