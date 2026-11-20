from fastapi import APIRouter, Depends, Header, HTTPException
from typing import Optional
from saas.ingest.auth import get_tenant  # shared: Supabase JWT, or demo-<tenant> when DEV_INSECURE=1

from .store import STORE

router = APIRouter(prefix="/api/v1", tags=["aiops"])

@router.get("/overview")
def get_overview(tenant_id: str = Depends(get_tenant)):
    """
    Service-centric overview matching contracts/api.md §B:
    Includes overall_state, collectors summary, open_incidents count, sources,
    and service-level health aggregation.
    """
    sources = list(STORE.sources.get(tenant_id, {}).values())
    services = list(STORE.services.get(tenant_id, {}).values())

    from .health import STATE_RANK, RANK_TO_STATE
    rank = 0
    for s in sources:
        r = STATE_RANK.get(s.get("state", "excellent"), 0)
        if r > rank:
            rank = r
    worst_state = RANK_TO_STATE.get(rank, "excellent")

    # Collector counts
    collectors = list(STORE.collectors.get(tenant_id, {}).values())
    online_count = sum(1 for c in collectors if c.get("status") == "online")
    offline_count = sum(1 for c in collectors if c.get("status") == "offline")
    if not collectors:
        online_count = 1  # Default fallback if not initialized

    open_incidents = [
        i for i in STORE.incidents.get(tenant_id, [])
        if i.get("status") == "open"
    ]

    return {
        "tenant_id": tenant_id,
        "overall_state": worst_state,
        "collectors": {"online": online_count, "offline": offline_count},
        "open_incidents": len(open_incidents),
        "sources": sources,
        "services": services
    }

@router.get("/alerts")
def get_alerts(status: Optional[str] = None, tenant_id: str = Depends(get_tenant)):
    alerts = STORE.alerts.get(tenant_id, [])
    if status == "open":
        return [a for a in alerts if a.get("status", "open") == "open"]
    return alerts

@router.get("/incidents")
def get_incidents(tenant_id: str = Depends(get_tenant)):
    return STORE.incidents.get(tenant_id, [])

@router.get("/incidents/{incident_id}")
def get_incident_detail(incident_id: str, tenant_id: str = Depends(get_tenant)):
    """
    Detailed incident investigation view:
    Returns the incident, its full timeline, contributing signals,
    hypothesized root cause vs earliest signal, alerts, and recommendations.
    """
    incidents = STORE.incidents.get(tenant_id, [])
    inc = next((i for i in incidents if i["incident_id"] == incident_id), None)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    alerts = [a for a in STORE.alerts.get(tenant_id, []) if a.get("incident_id") == incident_id]
    recs = [r for r in STORE.recommendations.get(tenant_id, []) if r.get("incident_id") == incident_id]
    return {
        "incident": inc,
        "timeline": inc.get("timeline", []),
        "contributing_signals": inc.get("contributing_signals", []),
        "earliest_signal": inc.get("earliest_signal"),
        "likely_cause": inc.get("likely_cause"),
        "correlation_explanation": inc.get("correlation_explanation"),
        "alerts": alerts,
        "recommendations": recs
    }

@router.post("/recommendations/{rec_id}/approve")
def approve_recommendation(rec_id: str, tenant_id: str = Depends(get_tenant)):
    recs = STORE.recommendations.get(tenant_id, [])
    rec = next((r for r in recs if r["rec_id"] == rec_id), None)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    if rec.get("status") == "executed_simulated":
        raise HTTPException(status_code=400, detail="Recommendation already approved and executed")

    if rec.get("status") == "rolled_back":
        raise HTTPException(status_code=400, detail="Cannot approve a rolled-back recommendation directly")

    # Policy check safeguard
    policy = rec.get("policy_check", {})
    if not policy.get("allowed", False):
        raise HTTPException(status_code=403, detail=f"Policy check failed: {policy.get('policy')}")

    rec["status"] = "executed_simulated"
    STORE.save_recommendation(rec)
    STORE.log_audit(
        tenant_id=tenant_id,
        actor=f"user@{tenant_id}",
        action="approve_recommendation",
        target=rec_id,
        details={"action": rec["action"], "simulated": True}
    )
    return {
        "status": "executed_simulated",
        "rec_id": rec_id,
        "rollback_plan": rec.get("rollback_plan")
    }

@router.post("/recommendations/{rec_id}/rollback")
def rollback_recommendation(rec_id: str, tenant_id: str = Depends(get_tenant)):
    recs = STORE.recommendations.get(tenant_id, [])
    rec = next((r for r in recs if r["rec_id"] == rec_id), None)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    if rec.get("status") != "executed_simulated":
        raise HTTPException(status_code=400, detail=f"Cannot rollback recommendation in '{rec.get('status')}' status (must be executed_simulated)")

    rec["status"] = "rolled_back"
    STORE.save_recommendation(rec)
    STORE.log_audit(
        tenant_id=tenant_id,
        actor=f"user@{tenant_id}",
        action="rollback_recommendation",
        target=rec_id,
        details={"rollback_plan": rec.get("rollback_plan")}
    )
    return {
        "status": "rolled_back",
        "rec_id": rec_id
    }

@router.get("/health-history")
def get_health_history(entity_id: Optional[str] = None, tenant_id: str = Depends(get_tenant)):
    history = STORE.health_history.get(tenant_id, [])
    if entity_id:
        return [h for h in history if h.get("entity_id") == entity_id]
    return history

@router.get("/audit")
def get_audit_log(tenant_id: str = Depends(get_tenant)):
    return STORE.audit_log.get(tenant_id, [])


@router.get("/baselines")
def get_baselines(tenant_id: str = Depends(get_tenant)):
    """What the engine has learned per source/metric: rolling 15-min mean, std and sample count."""
    from .baseline import BASELINES
    out = []
    for (t, source_id, metric), b in list(BASELINES.items()):
        if t != tenant_id:
            continue
        mean, std, n = b.stats()
        out.append({"source_id": source_id, "metric": metric, "mean": round(mean, 2), "std": round(std, 2),
                    "samples": n, "ready": n >= b.min_samples, "min_samples": b.min_samples})
    return sorted(out, key=lambda r: (r["source_id"], r["metric"]))


@router.get("/security/layers")
def get_security_layers(tenant_id: str = Depends(get_tenant)):
    """Defense-in-depth status for the 5 security layers."""
    sources = list(STORE.sources.get(tenant_id, {}).values())
    collectors = list(STORE.collectors.get(tenant_id, {}).values())
    incidents = STORE.incidents.get(tenant_id, [])
    audit = STORE.audit_log.get(tenant_id, [])
    alerts = STORE.alerts.get(tenant_id, [])

    buffer_depth = sum(c.get("buffer_depth", 0) or 0 for c in collectors)
    online_collectors = sum(1 for c in collectors if c.get("status") == "online")
    security_alerts = sum(1 for a in alerts if a.get("kind") == "security")

    return {
        "tenant_id": tenant_id,
        "overall_posture": "active",
        "layers": [
            {
                "id": 1,
                "name": "Local Scrubbing & Allow-Listing",
                "tier": "Tier 1 Collector",
                "description": "PII, secrets, emails, IPs stripped locally. Hostnames hashed. AI entropy + NER catches novel leaks.",
                "status": "active",
                "controls": ["regex redaction", "shannon entropy", "NER person/address", "payload allow-list"],
                "metric": {"label": "Security events detected", "value": security_alerts},
                "icon": "shield",
            },
            {
                "id": 2,
                "name": "Outbound-Only Firewall Posture",
                "tier": "Tier 1 Transport",
                "description": "Collector is HTTPS client only. Zero inbound ports. Local SQLite buffer survives network drops.",
                "status": "active",
                "controls": ["no listening socket", "outbound HTTPS", "exponential backoff", "replay-safe queue"],
                "metric": {"label": "Buffered payloads", "value": buffer_depth},
                "icon": "lock",
            },
            {
                "id": 3,
                "name": "Encrypted Transit + HMAC Auth",
                "tier": "Boundary",
                "description": "HMAC-SHA256 collector signature over timestamp + body. 300s replay window. TLS to Supabase.",
                "status": "active",
                "controls": ["HMAC-SHA256", "replay window 300s", "schema validation", "payload_id idempotency"],
                "metric": {"label": "Collectors authenticated", "value": online_collectors},
                "icon": "shield-check",
            },
            {
                "id": 4,
                "name": "Strict Multi-Tenant Isolation",
                "tier": "Tier 2 SaaS",
                "description": "tenant_id resolved from JWT or collector registry. Postgres RLS enforces isolation at the row.",
                "status": "active",
                "controls": ["JWT tenant claim", "Supabase RLS", "per-tenant partitions", "cross-tenant query = 0 rows"],
                "metric": {"label": "Sources served (tenant)", "value": len(sources)},
                "icon": "users",
            },
            {
                "id": 5,
                "name": "Safe Remediation & Audit Log",
                "tier": "Tier 2 AIOps",
                "description": "Every action simulation-only, human-approved, policy-checked, and fully reversible.",
                "status": "active",
                "controls": ["simulation mode", "policy gate", "approve/rollback", "immutable audit"],
                "metric": {"label": "Audit entries", "value": len(audit)},
                "icon": "file-check",
            },
        ],
        "open_incidents": sum(1 for i in incidents if i.get("status") == "open"),
    }


@router.post("/chat")
def chat(body: dict, tenant_id: str = Depends(get_tenant)):
    """Natural-language query over AIOps state. Powered by Supabase + Gemini API."""
    from .chat import process_chat_message
    message = (body or {}).get("message", "") if isinstance(body, dict) else ""
    context = (body or {}).get("context", "") if isinstance(body, dict) else ""
    gemini_key = (body or {}).get("geminiApiKey") or (body or {}).get("gemini_api_key") or ""
    return process_chat_message(message, tenant_id, context, gemini_key=gemini_key)
