import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from .health import aggregate_service_health

logger = logging.getLogger(__name__)

# Write-through persistence to the shared SaaS store (Supabase when configured, else SQLite).
# Off by default so unit tests stay in-memory; engine.startup() switches it on in the running app.
PERSIST_ENABLED = False


def _persist(kind: str, tenant_id: str, row: Dict[str, Any]) -> None:
    """Best effort: a storage outage must never break detection. The in-memory state stays authoritative."""
    if not PERSIST_ENABLED:
        return
    try:
        from saas.db import get_store
        store = get_store()
        if kind == "health":
            store.insert_health(tenant_id, {k: row.get(k) for k in
                                            ("entity_type", "entity_id", "prev_state", "state", "reason", "at_utc")})
        elif kind == "audit":
            store.insert_audit(tenant_id, {k: row.get(k) for k in ("actor", "action", "target", "details", "at_utc")})
        else:
            store.upsert_row(kind, row)
    except Exception:
        logger.exception("Persisting %s for %s failed", kind, tenant_id)

class InMemoryStore:
    def __init__(self):
        # tenant_id -> list of records
        self.alerts: Dict[str, List[Dict[str, Any]]] = {}
        self.incidents: Dict[str, List[Dict[str, Any]]] = {}
        self.recommendations: Dict[str, List[Dict[str, Any]]] = {}
        self.health_history: Dict[str, List[Dict[str, Any]]] = {}
        self.audit_log: Dict[str, List[Dict[str, Any]]] = {}
        self.sources: Dict[str, Dict[str, Dict[str, Any]]] = {}  # tenant_id -> source_id -> info
        self.services: Dict[str, Dict[str, Dict[str, Any]]] = {}  # tenant_id -> service_name -> info
        self.collectors: Dict[str, Dict[str, Dict[str, Any]]] = {}

    # ───────── ADAPTER METHODS FOR PERSISTENCE (PERSON B MERGE READY) ─────────
    # When Person B merges saas/db.py with db_for_tenant() / tenant_query(),
    # these 5 save_* methods route directly into Supabase Postgres service client.

    def save_alert(self, alert: Dict[str, Any]):
        """
        Persist alert row.
        # TODO(Person-B-merge):
        # from saas.db import db_for_tenant
        # db_for_tenant(alert['tenant_id']).table('alerts').insert(alert).execute()
        """
        tenant_id = alert["tenant_id"]
        self.alerts.setdefault(tenant_id, []).append(alert)
        _persist("alerts", tenant_id, alert)

    def persist_alert(self, alert: Dict[str, Any]):
        """Re-save an alert after correlation filled in its incident_id (persistence only, no duplicate in memory)."""
        _persist("alerts", alert["tenant_id"], alert)

    def save_incident(self, incident: Dict[str, Any]):
        """
        Persist incident row.
        # TODO(Person-B-merge):
        # from saas.db import db_for_tenant
        # db_for_tenant(incident['tenant_id']).table('incidents').upsert(incident).execute()
        """
        tenant_id = incident["tenant_id"]
        _persist("incidents", tenant_id, incident)
        incidents = self.incidents.setdefault(tenant_id, [])
        for i, existing in enumerate(incidents):
            if existing["incident_id"] == incident["incident_id"]:
                incidents[i] = incident
                return
        incidents.append(incident)

    def save_recommendation(self, rec: Dict[str, Any]):
        """
        Persist recommendation row.
        # TODO(Person-B-merge):
        # from saas.db import db_for_tenant
        # db_for_tenant(rec['tenant_id']).table('recommendations').upsert(rec).execute()
        """
        tenant_id = rec["tenant_id"]
        _persist("recommendations", tenant_id, rec)
        recs = self.recommendations.setdefault(tenant_id, [])
        for i, existing in enumerate(recs):
            if existing["rec_id"] == rec["rec_id"]:
                recs[i] = rec
                return
        recs.append(rec)

    def save_health_history(self, tenant_id: str, entry: Dict[str, Any]):
        """
        Persist health history row.
        # TODO(Person-B-merge):
        # from saas.db import db_for_tenant
        # db_for_tenant(tenant_id).table('health_history').insert(entry).execute()
        """
        self.health_history.setdefault(tenant_id, []).append(entry)
        # Collector liveness history is written by ingest (Person B) from real heartbeats; avoid duplicates.
        if entry.get("entity_type") != "collector":
            _persist("health", tenant_id, entry)

    def save_audit_log(self, tenant_id: str, entry: Dict[str, Any]):
        """
        Persist audit log row.
        # TODO(Person-B-merge):
        # from saas.db import db_for_tenant
        # db_for_tenant(tenant_id).table('audit_log').insert(entry).execute()
        """
        self.audit_log.setdefault(tenant_id, []).append(entry)
        _persist("audit", tenant_id, entry)

    # ──────────────────────────────────────────────────────────────────────────

    def record_health(self, tenant_id: str, entity_type: str, entity_id: str, prev_state: str, new_state: str, reason: str, at_utc: Optional[str] = None):
        if prev_state != new_state:
            entry = {
                "id": f"hh_{len(self.health_history.get(tenant_id, [])) + 1}",
                "tenant_id": tenant_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "prev_state": prev_state,
                "state": new_state,
                "reason": reason,
                "at_utc": at_utc or datetime.now(timezone.utc).isoformat()
            }
            self.save_health_history(tenant_id, entry)

    def update_source_status(self, tenant_id: str, source_id: str, service: str, source_type: str, state: str, reason: str, event_time_utc: str):
        tenant_sources = self.sources.setdefault(tenant_id, {})
        current = tenant_sources.get(source_id)
        prev_state = current.get("state", "excellent") if current else "excellent"

        tenant_sources[source_id] = {
            "source_id": source_id,
            "service": service,
            "source_type": source_type,
            "state": state,
            "reason": reason,
            "last_seen_utc": event_time_utc
        }

        if prev_state != state:
            self.record_health(tenant_id, "source", source_id, prev_state, state, reason, event_time_utc)

        # Update service-level aggregation
        self.refresh_service_health(tenant_id, service)

    def refresh_service_health(self, tenant_id: str, service: str):
        if not service or service == "unknown":
            return
        tenant_services = self.services.setdefault(tenant_id, {})
        service_sources = [
            s for s in self.sources.get(tenant_id, {}).values()
            if s.get("service") == service
        ]
        prev_svc = tenant_services.get(service)
        prev_state = prev_svc.get("state", "excellent") if prev_svc else "excellent"

        new_state, aggregated_reason = aggregate_service_health(service_sources)
        tenant_services[service] = {
            "service": service,
            "state": new_state,
            "reason": aggregated_reason,
            "source_count": len(service_sources),
            "sources": [s["source_id"] for s in service_sources],
            "updated_at_utc": datetime.now(timezone.utc).isoformat()
        }

        if prev_state != new_state:
            self.record_health(tenant_id, "service", service, prev_state, new_state, aggregated_reason)

    def update_collector_status(self, tenant_id: str, collector_id: str, status: str, state: str, reason: str, timestamp_utc: str):
        tenant_cols = self.collectors.setdefault(tenant_id, {})
        curr = tenant_cols.get(collector_id)
        prev_state = curr.get("state", "excellent") if curr else "excellent"

        tenant_cols[collector_id] = {
            "collector_id": collector_id,
            "tenant_id": tenant_id,
            "status": status,
            "state": state,
            "reason": reason,
            "last_seen_utc": timestamp_utc
        }

        if prev_state != state:
            self.record_health(tenant_id, "collector", collector_id, prev_state, state, reason, timestamp_utc)

    def add_alert(self, alert: Dict[str, Any]):
        self.save_alert(alert)

    def add_incident(self, incident: Dict[str, Any]):
        self.save_incident(incident)

    def add_recommendation(self, rec: Dict[str, Any]):
        self.save_recommendation(rec)

    def log_audit(self, tenant_id: str, actor: str, action: str, target: str, details: Dict[str, Any]):
        entry = {
            "id": f"aud_{len(self.audit_log.get(tenant_id, [])) + 1}",
            "tenant_id": tenant_id,
            "actor": actor,
            "action": action,
            "target": target,
            "details": details,
            "at_utc": datetime.now(timezone.utc).isoformat()
        }
        self.save_audit_log(tenant_id, entry)

STORE = InMemoryStore()
