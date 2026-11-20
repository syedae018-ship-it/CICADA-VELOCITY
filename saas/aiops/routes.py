from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from .store import STORE
from .copilot import query_copilot

router = APIRouter(prefix="/api/v1")

def get_tenant(authorization: Optional[str] = Header(None)) -> str:
    """
    Enforce tenant isolation.
    Accepts:
      - 'Bearer demo-<tenant_id>'
      - Direct Supabase JWT Bearer
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    token = parts[1]
    if token.startswith("demo-"):
        return token.replace("demo-", "")
    return "t_acme"

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "saas-aiops"}

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

class CopilotAskRequest(BaseModel):
    question: str = Field(..., max_length=500)
    incident_id: Optional[str] = None
    history: List[Dict[str, Any]] = Field(default_factory=list)

class CopilotAskResponse(BaseModel):
    answer: str
    citations: List[str]
    privacy_mode: str = "metadata_only"
    tenant_id: str
    engine: str
    intent: str = "fleet_overview"
    suggested_action: Optional[Dict[str, Any]] = None

@router.post("/copilot/ask", response_model=CopilotAskResponse)
def ask_copilot(req: CopilotAskRequest, tenant_id: str = Depends(get_tenant)):
    """
    Natural-Language Incident Copilot v2.1 ("Ask your infrastructure").
    Answers questions using only allow-listed metadata for the caller's tenant.
    Supports multi-turn history, intent classification, and suggested actions.
    """
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    res = query_copilot(
        tenant_id=tenant_id,
        question=req.question.strip(),
        incident_id=req.incident_id,
        history=req.history
    )
    return res
