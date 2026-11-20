import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple
from .store import STORE

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

# ─────────────────────────────────────────────────────────────────────
# 1. INTENT CLASSIFICATION & GREETINGS
# ─────────────────────────────────────────────────────────────────────

GREETING_WORDS = {"hello", "hi", "hey", "good morning", "good afternoon", "good evening"}

def is_greeting(question: str) -> bool:
    """Check if the question is a friendly greeting."""
    clean = re.sub(r"[^\w\s]", "", question.strip().lower())
    return clean in GREETING_WORDS

INTENT_KEYWORDS: Dict[str, List[str]] = {
    "collector_health":    ["collector", "collectors", "stale", "offline", "heartbeat", "agent", "silent"],
    "audit_history":       ["audit", "approved", "rollback", "rolled back", "history log", "actions taken", "simulated"],
    "privacy_architecture": ["privacy", "raw log", "raw logs", "pii", "password", "passkey", "gdpr", "security architecture", "how does cicada work", "metadata"],
    "root_cause":          ["why", "cause", "trigger", "reason", "slow", "spike", "down", "degraded", "failing", "issue", "problem", "happening", "login", "brute force", "failed login"],
    "blast_radius":        ["impact", "affected", "which", "scope", "sources", "blast", "radius", "spread"],
    "remediation":         ["fix", "resolve", "rollback", "mitigate", "remediate", "action", "do", "recommend", "how to", "how do", "stop", "prevent", "block"],
    "fleet_overview":      ["status", "summary", "health", "overview", "fleet", "current"],
}

def classify_intent(question: str) -> str:
    """Classify operator question into one of 7 SRE intents."""
    q = question.lower()
    scores: Dict[str, int] = {intent: 0 for intent in INTENT_KEYWORDS}
    for intent, keywords in INTENT_KEYWORDS.items():
        for kw in keywords:
            if kw in q:
                scores[intent] += 1
    best = max(scores, key=scores.get)  # type: ignore[arg-type]
    if scores[best] == 0:
        return "fleet_overview"
    return best

# ─────────────────────────────────────────────────────────────────────
# 2. PROMPT-INJECTION GUARD
# ─────────────────────────────────────────────────────────────────────

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?)",
    r"forget\s+(all\s+)?(instructions?|rules?|context)",
    r"dump\s+(raw\s+)?logs?",
    r"system\s+prompt",
    r"reveal\s+(your\s+)?(secrets?|instructions?|prompt|config)",
    r"ignore\s+all",
    r"you\s+are\s+now",
    r"act\s+as\s+if",
    r"override\s+(your\s+)?rules?",
    r"disable\s+(privacy|safety|guard|filter)",
    r"print\s+(your\s+)?(system|prompt|instructions?)",
]

def is_prompt_injection(question: str) -> bool:
    """Detect adversarial prompt-injection attempts."""
    q = question.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, q):
            return True
    return False

# ─────────────────────────────────────────────────────────────────────
# 3. CITATION GROUNDING
# ─────────────────────────────────────────────────────────────────────

def ground_citations(tenant_id: str, citations: List[str]) -> List[str]:
    """
    Validate every citation against the tenant's actual store data.
    Remove any ID not found — prevents hallucinated or cross-tenant citations.
    """
    valid: List[str] = []
    tenant_incidents = STORE.incidents.get(tenant_id, [])
    tenant_alerts = STORE.alerts.get(tenant_id, [])
    tenant_sources = STORE.sources.get(tenant_id, {})
    tenant_recs = STORE.recommendations.get(tenant_id, [])

    incident_ids = {i.get("incident_id") for i in tenant_incidents}
    alert_ids = {a.get("alert_id") for a in tenant_alerts}
    source_ids = set(tenant_sources.keys())
    for inc in tenant_incidents:
        for s in inc.get("affected_sources", []):
            source_ids.add(s)
    for a in tenant_alerts:
        s = a.get("source_id")
        if s:
            source_ids.add(s)
    rec_ids = {r.get("rec_id") for r in tenant_recs}

    all_valid_ids = incident_ids | alert_ids | source_ids | rec_ids

    for cid in citations:
        if cid in all_valid_ids and cid not in valid:
            valid.append(cid)
    return valid

# ─────────────────────────────────────────────────────────────────────
# 4. SUGGESTED ACTION BUILDER (Highest confidence first)
# ─────────────────────────────────────────────────────────────────────

def build_suggested_action(tenant_id: str, incident_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Build a structured suggested_action dict from the highest-confidence active recommendation
    matching the diagnosed incident. Returns None if no recommendation exists.
    """
    tenant_recs = STORE.recommendations.get(tenant_id, [])
    if not tenant_recs:
        return None

    # Filter to proposed recommendations
    proposed = [r for r in tenant_recs if r.get("status") == "proposed"]
    if not proposed:
        return None

    # Filter by incident_id if provided
    matching_recs = proposed
    if incident_id:
        inc_recs = [r for r in proposed if r.get("incident_id") == incident_id]
        if inc_recs:
            matching_recs = inc_recs

    # Precision Fix #1: Sort by confidence descending
    matching_recs.sort(key=lambda r: float(r.get("confidence", 0.0)), reverse=True)
    matching = matching_recs[0]

    return {
        "rec_id": matching.get("rec_id"),
        "action": matching.get("action"),
        "approve_endpoint": f"/api/v1/recommendations/{matching.get('rec_id')}/approve",
        "rollback_plan": matching.get("rollback_plan"),
        "mode": "simulation_only"
    }

# ─────────────────────────────────────────────────────────────────────
# 5. HISTORY SANITIZER
# ─────────────────────────────────────────────────────────────────────

ALLOWED_HISTORY_KEYS = {"role", "content"}

def sanitize_history(history: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Sanitize and cap conversation history to last 4 turns, stripping non-allowlisted fields."""
    sanitized: List[Dict[str, str]] = []
    for turn in history[-4:]:
        clean: Dict[str, str] = {}
        for key in ALLOWED_HISTORY_KEYS:
            val = turn.get(key, "")
            if isinstance(val, str):
                clean[key] = val[:500]  # cap individual turn content length
        if clean.get("role") and clean.get("content"):
            sanitized.append(clean)
    return sanitized

# ─────────────────────────────────────────────────────────────────────
# 6. RESOLVE TARGET INCIDENT
# ─────────────────────────────────────────────────────────────────────

def resolve_target_incident(
    tenant_id: str,
    question: str,
    incident_id: Optional[str] = None,
    history: Optional[List[Dict[str, str]]] = None
) -> Optional[Dict[str, Any]]:
    """
    Identify if the question/context resolves to a specific single incident
    via explicit incident_id, service name keyword, security terms, or multi-turn history.
    """
    tenant_incidents = STORE.incidents.get(tenant_id, [])
    if not tenant_incidents:
        return None

    # 1. Explicit incident_id
    if incident_id:
        inc = next((i for i in tenant_incidents if i.get("incident_id") == incident_id), None)
        if inc:
            return inc

    # 2. Service name or title match in question
    q_lower = question.lower()
    for inc in tenant_incidents:
        svc = (inc.get("service") or "").lower()
        title = (inc.get("title") or "").lower()
        if svc and (svc in q_lower or any(word in q_lower for word in svc.split("-"))):
            return inc
        elif any(word in q_lower for word in title.split() if len(word) > 3):
            return inc

    # Check security terms (failed logins, auth)
    if any(k in q_lower for k in ("failed login", "login", "brute force", "auth")):
        for inc in tenant_incidents:
            svc = (inc.get("service") or "").lower()
            title = (inc.get("title") or "").lower()
            earliest = str(inc.get("earliest_signal") or "")
            if "auth" in svc or "login" in title or "failed_login" in earliest or "login" in str(inc.get("likely_cause", "")).lower():
                return inc

    # 3. History follow-up match
    if history:
        for turn in reversed(history):
            content = turn.get("content", "")
            for inc in tenant_incidents:
                inc_id = inc.get("incident_id")
                svc = (inc.get("service") or "").lower()
                if inc_id and inc_id in content:
                    return inc
                if svc and svc in content.lower():
                    return inc

    # 4. Fallback if single open incident exists
    open_incidents = [i for i in tenant_incidents if i.get("status") == "open"]
    if len(open_incidents) == 1:
        return open_incidents[0]

    return None

# ─────────────────────────────────────────────────────────────────────
# CONTEXT ASSEMBLER
# ─────────────────────────────────────────────────────────────────────

def assemble_tenant_metadata_context(
    tenant_id: str,
    incident_id: Optional[str] = None,
    target_incident: Optional[Dict[str, Any]] = None,
    intent: str = "fleet_overview"
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Assemble context strictly from tenant's allow-listed metadata in STORE.
    Explicitly enforces zero raw logs, unredacted usernames, passwords, or IPs.
    Returns:
        (sanitized_metadata_dict, list_of_citations)
    """
    citations: List[str] = []

    tenant_sources = STORE.sources.get(tenant_id, {})
    tenant_incidents = STORE.incidents.get(tenant_id, [])
    tenant_alerts = STORE.alerts.get(tenant_id, [])
    tenant_recs = STORE.recommendations.get(tenant_id, [])

    is_incident_scoped = (target_incident is not None and intent in ("root_cause", "remediation"))

    if is_incident_scoped and target_incident:
        target_incidents = [target_incident]
    elif incident_id:
        target_incidents = [i for i in tenant_incidents if i.get("incident_id") == incident_id]
    else:
        # Latest open or updated incidents
        target_incidents = [i for i in tenant_incidents if i.get("status") == "open"]
        if not target_incidents and tenant_incidents:
            target_incidents = tenant_incidents[-3:]

    # Collect matching alert IDs and source IDs
    relevant_alert_ids = set()
    relevant_source_ids = set()
    for inc in target_incidents:
        inc_id = inc.get("incident_id")
        if inc_id and inc_id not in citations:
            citations.append(inc_id)
        for a_id in inc.get("alert_ids", []):
            relevant_alert_ids.add(a_id)
            if a_id not in citations:
                citations.append(a_id)
        for s_id in inc.get("affected_sources", []):
            relevant_source_ids.add(s_id)
            if s_id not in citations:
                citations.append(s_id)

    # Sanitize and extract alert details
    sanitized_alerts = []
    for a in tenant_alerts:
        a_id = a.get("alert_id")
        s_id = a.get("source_id")
        is_relevant = a_id in relevant_alert_ids or (not is_incident_scoped and not incident_id and a.get("state") in ("fair", "poor"))
        if is_relevant:
            if a_id and a_id not in citations:
                citations.append(a_id)
            if s_id and s_id not in citations:
                citations.append(s_id)

            explanation = a.get("explanation", {})
            baseline = explanation.get("baseline", {})
            sanitized_alerts.append({
                "alert_id": a_id,
                "source_id": s_id,
                "service": a.get("service"),
                "metric": a.get("metric"),
                "severity": a.get("severity"),
                "state": a.get("state"),
                "event_time_utc": a.get("event_time_utc"),
                "observed": explanation.get("observed"),
                "z_score": explanation.get("z_score"),
                "baseline_mean": baseline.get("mean"),
                "baseline_std": baseline.get("std"),
                "why": explanation.get("why")
            })

    # Sanitize recommendations - confidence descending
    sanitized_recs = []
    target_inc_ids = {inc.get("incident_id") for inc in target_incidents if inc.get("incident_id")}
    for r in tenant_recs:
        r_inc = r.get("incident_id")
        if not is_incident_scoped or r_inc in target_inc_ids:
            rec_id = r.get("rec_id")
            if rec_id and rec_id not in citations:
                citations.append(rec_id)
            sanitized_recs.append({
                "rec_id": rec_id,
                "incident_id": r_inc,
                "action": r.get("action"),
                "reasoning_path": r.get("reasoning_path", []),
                "confidence": r.get("confidence"),
                "risk": r.get("risk"),
                "status": r.get("status"),
                "rollback_plan": r.get("rollback_plan")
            })

    sanitized_recs.sort(key=lambda r: float(r.get("confidence", 0.0)), reverse=True)

    # Sanitize sources
    sanitized_sources = []
    target_services = {inc.get("service") for inc in target_incidents if inc.get("service")}
    for s_id, s in tenant_sources.items():
        is_relevant_src = False
        if is_incident_scoped:
            if s_id in relevant_source_ids or s.get("service") in target_services:
                is_relevant_src = True
        else:
            if s.get("state") in ("fair", "poor") or s_id in relevant_source_ids:
                is_relevant_src = True

        if is_relevant_src:
            if s_id not in citations:
                citations.append(s_id)
            sanitized_sources.append({
                "source_id": s_id,
                "service": s.get("service"),
                "state": s.get("state"),
                "reason": s.get("reason"),
                "last_seen_utc": s.get("last_seen_utc")
            })

    sanitized_context = {
        "tenant_id": tenant_id,
        "active_incidents": [
            {
                "incident_id": inc.get("incident_id"),
                "title": inc.get("title"),
                "service": inc.get("service"),
                "severity": inc.get("severity"),
                "status": inc.get("status"),
                "started_utc": inc.get("started_utc"),
                "earliest_signal": inc.get("earliest_signal"),
                "likely_cause": inc.get("likely_cause"),
                "correlation_explanation": inc.get("correlation_explanation"),
                "affected_sources": inc.get("affected_sources", []),
                "alert_count": inc.get("alert_count", 0),
                "suppressed_duplicates": inc.get("suppressed_duplicates", 0),
                "timeline": inc.get("timeline", [])
            }
            for inc in target_incidents
        ],
        "alerts": sanitized_alerts,
        "recommendations": sanitized_recs,
        "degraded_sources": sanitized_sources
    }

    return sanitized_context, citations


# ─────────────────────────────────────────────────────────────────────
# DETERMINISTIC SYNTHESIZER (With all 7 intents + Cicada platform features)
# ─────────────────────────────────────────────────────────────────────

def synthesize_deterministic_answer(
    question: str,
    context: Dict[str, Any],
    citations: List[str],
    intent: str = "fleet_overview",
    history: Optional[List[Dict[str, str]]] = None,
    tenant_id: str = "t_acme"
) -> str:
    """
    Deterministic Natural-Language Synthesizer fallback.
    Supports all 7 intents: root_cause, blast_radius, remediation, fleet_overview,
    collector_health, audit_history, privacy_architecture.
    """
    tenant_sources = STORE.sources.get(tenant_id, {})
    tenant_audit = STORE.audit_log.get(tenant_id, [])
    tenant_recs_all = STORE.recommendations.get(tenant_id, [])

    # ── New Feature Intent 1: collector_health ──
    if intent == "collector_health":
        total_sources = len(tenant_sources)
        degraded_sources = []
        has_stale_or_offline = False

        for s_id, s in tenant_sources.items():
            state = (s.get("state") or "").lower()
            status = (s.get("status") or "").lower()
            reason = (s.get("reason") or "").lower()
            is_stale_or_offline = any(k in status or k in reason for k in ("stale", "offline", "silent"))
            if is_stale_or_offline:
                has_stale_or_offline = True
            if state in ("fair", "poor") or is_stale_or_offline:
                degraded_sources.append(s)

        if degraded_sources:
            summaries = [
                f"{s.get('source_id')} (Service: {s.get('service')}, State: {s.get('state')}, Reason: {s.get('reason')})"
                for s in degraded_sources
            ]
            if has_stale_or_offline:
                tail = ". Telemetry silence exceeded freshness thresholds."
            else:
                tail = ". All collectors are actively reporting within the 30s freshness window (no stale or offline collectors)."

            return (
                f"[Collector Health] Out of {total_sources} monitored source(s), {len(degraded_sources)} require attention: "
                + "; ".join(summaries)
                + tail
            )
        else:
            return (
                f"[Collector Health] All {total_sources} monitored collector(s) and source(s) are operating nominally "
                "within the 30-second freshness window. Heartbeats and telemetry stream are active."
            )

    # ── New Feature Intent 2: audit_history ──
    if intent == "audit_history":
        recent_audit = tenant_audit[-5:] if tenant_audit else []
        executed_or_rolled = [
            r for r in tenant_recs_all
            if r.get("status") in ("executed_simulated", "rolled_back")
        ]
        proposed = [r for r in tenant_recs_all if r.get("status") == "proposed"]

        if not executed_or_rolled and not recent_audit:
            return (
                "[Audit Trail] No remediation actions have been executed yet. "
                f"There are currently {len(proposed)} proposed recommendation(s) awaiting operator review."
            )

        lines = []
        for r in executed_or_rolled:
            lines.append(f"Action '{r.get('action')}' (Status: {r.get('status')}, ID: {r.get('rec_id')})")
        for a in recent_audit:
            if a.get("action") in ("approve_recommendation", "rollback_recommendation"):
                lines.append(f"{a.get('action')} on target {a.get('target')} by {a.get('actor')}")

        return (
            f"[Audit Trail] Found {len(lines)} recorded remediation event(s): "
            + "; ".join(lines)
            + f". {len(proposed)} proposed action(s) remain pending review."
        )

    # ── New Feature Intent 3: privacy_architecture ──
    if intent == "privacy_architecture":
        return (
            "[Cicada Privacy Architecture] Velocity Cicada enforces a strict Tier 1 -> Tier 2 privacy boundary. "
            "Raw logs, plaintext passwords, credentials, IP addresses, and WebAuthn/passkey private keys never leave the customer boundary. "
            "Only allow-listed numerical metrics, UTC timestamps, pseudonymous source IDs (src_*), and 15-minute rolling statistical baselines "
            "reach Tier 2 SaaS. Furthermore, all automated remediations run strictly in simulated mode (simulation_only) and require explicit human operator approval."
        )

    incidents = context.get("active_incidents", [])
    alerts = context.get("alerts", [])
    recs = context.get("recommendations", [])
    degraded_sources = context.get("degraded_sources", [])

    sorted_recs = sorted(recs, key=lambda r: float(r.get("confidence", 0.0)), reverse=True)

    prior_incident_id = None
    prior_service = None
    if history:
        for turn in reversed(history):
            content = turn.get("content", "")
            for inc in incidents:
                if inc.get("incident_id") and inc["incident_id"] in content:
                    prior_incident_id = inc["incident_id"]
                if inc.get("service") and inc["service"].lower() in content.lower():
                    prior_service = inc["service"]

    if not incidents and not alerts and not degraded_sources:
        return (
            "All systems are currently nominal. No active incidents, degraded services, "
            "or anomalous metrics were detected for your infrastructure."
        )

    # Match specific service or security incident
    q_lower = question.lower()
    matching_incidents = []
    for inc in incidents:
        svc = (inc.get("service") or "").lower()
        title = (inc.get("title") or "").lower()
        if svc and (svc in q_lower or any(word in q_lower for word in svc.split("-"))):
            matching_incidents.append(inc)
        elif any(word in q_lower for word in title.split()):
            matching_incidents.append(inc)

    # Match security terms
    if not matching_incidents and any(k in q_lower for k in ("login", "failed login", "brute force", "auth")):
        for inc in incidents:
            svc = (inc.get("service") or "").lower()
            title = (inc.get("title") or "").lower()
            if "auth" in svc or "login" in title or "failed_login" in str(inc.get("earliest_signal") or ""):
                matching_incidents.append(inc)

    if not matching_incidents and prior_service:
        matching_incidents = [inc for inc in incidents if (inc.get("service") or "").lower() == prior_service.lower()]
    if not matching_incidents and prior_incident_id:
        matching_incidents = [inc for inc in incidents if inc.get("incident_id") == prior_incident_id]

    primary_inc = matching_incidents[0] if matching_incidents else (incidents[0] if incidents else None)

    # ── Intent 4: root_cause ──
    if intent == "root_cause":
        if primary_inc:
            svc_name = primary_inc.get("service") or "the affected service"
            earliest = primary_inc.get("earliest_signal") or {}
            earliest_metric = earliest.get("metric", "metric")
            earliest_src = earliest.get("source_id", "source")
            earliest_time = earliest.get("event_time_utc", "N/A")
            likely_cause = primary_inc.get("likely_cause", "")
            matching_rec = next((r for r in sorted_recs if r.get("incident_id") == primary_inc.get("incident_id")), None)
            rec_text = ""
            if matching_rec:
                rec_text = (
                    f" Recommended action: '{matching_rec.get('action')}'. "
                    f"Rollback plan: '{matching_rec.get('rollback_plan', 'None')}'. "
                    f"(Recommendation ID: {matching_rec.get('rec_id')})"
                )
            return (
                f"[Root Cause Analysis] {svc_name} degradation was triggered by an initial anomaly on {earliest_metric} "
                f"at source {earliest_src} (observed at {earliest_time}). {likely_cause} "
                f"This incident (ID: {primary_inc.get('incident_id')}) correlated {primary_inc.get('alert_count')} alert(s) "
                f"across affected sources {primary_inc.get('affected_sources')}.{rec_text}"
            )
        elif degraded_sources:
            src = degraded_sources[0]
            return (
                f"[Root Cause Analysis] Source {src.get('source_id')} in service '{src.get('service')}' is currently in state "
                f"'{src.get('state')}' due to: {src.get('reason')} (last seen: {src.get('last_seen_utc')})."
            )

    # ── Intent 5: blast_radius ──
    elif intent == "blast_radius":
        affected_srcs = set()
        affected_svcs = set()
        for inc in (matching_incidents or incidents):
            for s in inc.get("affected_sources", []):
                affected_srcs.add(s)
            svc = inc.get("service")
            if svc:
                affected_svcs.add(svc)
        for src in degraded_sources:
            affected_srcs.add(src.get("source_id", ""))
            svc = src.get("service")
            if svc:
                affected_svcs.add(svc)

        return (
            f"[Blast Radius] {len(affected_svcs)} service(s) affected: {', '.join(sorted(affected_svcs))}. "
            f"{len(affected_srcs)} source(s) impacted: {', '.join(sorted(affected_srcs))}. "
            f"{len(incidents)} open incident(s) total."
        )

    # ── Intent 6: remediation ──
    elif intent == "remediation":
        if sorted_recs:
            rec_summaries = []
            for r in sorted_recs[:2]:
                rec_summaries.append(
                    f"Action '{r.get('action')}' (Confidence: {r.get('confidence')}, Risk: {r.get('risk')}). "
                    f"Rollback plan: '{r.get('rollback_plan')}'. Status: {r.get('status')} (ID: {r.get('rec_id')})."
                )
            return "[Remediation] Recommended remediation plan: " + " | ".join(rec_summaries)
        elif primary_inc:
            return (
                f"[Remediation] For incident {primary_inc.get('incident_id')} on {primary_inc.get('service')}, "
                f"investigate earliest signal on {primary_inc.get('earliest_signal', {}).get('metric')} at "
                f"{primary_inc.get('earliest_signal', {}).get('source_id')}."
            )

    # ── Intent 7: fleet_overview (default) ──
    inc_summaries = [
        f"{inc.get('title')} [{inc.get('incident_id')}] - Severity: {inc.get('severity')}, Status: {inc.get('status')}"
        for inc in incidents
    ]
    summary_str = "; ".join(inc_summaries) if inc_summaries else "No active incidents."
    degraded_str = f" {len(degraded_sources)} degraded source(s) detected." if degraded_sources else ""
    return f"[Fleet Overview] Infrastructure Status: {summary_str}{degraded_str}"


# ─────────────────────────────────────────────────────────────────────
# MAIN COPILOT ENTRY POINT (v2.1 — Cicada Platform Expansion)
# ─────────────────────────────────────────────────────────────────────

def query_copilot(
    tenant_id: str,
    question: str,
    incident_id: Optional[str] = None,
    history: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Main entry point for Natural-Language Incident Copilot v2.1.
    - Handles friendly greetings with intro prefix
    - Classifies 7 SRE & Cicada platform intents
    - Guards against prompt injection
    - Resolves target incident
    - Assembles metadata context with confidence-sorted recommendations
    - Scopes citations to target incident on root_cause / remediation
    - Builds suggested_action with highest-confidence recommendation first
    - Grounds citations against tenant store
    - Logs query to tenant audit log
    """

    # ── Prompt-injection guard ──
    if is_prompt_injection(question):
        result = {
            "answer": "I'm unable to process that request. Please ask a question about your infrastructure's health, incidents, or recommendations.",
            "citations": [],
            "privacy_mode": "metadata_only",
            "tenant_id": tenant_id,
            "engine": "guard",
            "intent": "blocked",
            "suggested_action": None
        }
        STORE.log_audit(
            tenant_id=tenant_id,
            actor=f"copilot@{tenant_id}",
            action="copilot_query_blocked",
            target="prompt_injection_guard",
            details={"question_length": len(question), "reason": "prompt_injection_detected"}
        )
        return result

    # ── Check friendly greeting ──
    greeting_detected = is_greeting(question)

    # ── Classify intent ──
    intent = classify_intent(question)
    if greeting_detected:
        intent = "fleet_overview"

    # ── Sanitize history ──
    clean_history = sanitize_history(history) if history else []

    # ── Resolve target incident ──
    target_inc = resolve_target_incident(
        tenant_id=tenant_id,
        question=question,
        incident_id=incident_id,
        history=clean_history
    )
    resolved_incident_id = target_inc.get("incident_id") if target_inc else incident_id

    # ── Assemble metadata context ──
    context, citations = assemble_tenant_metadata_context(
        tenant_id=tenant_id,
        incident_id=resolved_incident_id,
        target_incident=target_inc,
        intent=intent
    )

    # Intent-specific citation handling for non-incident queries
    if intent == "privacy_architecture":
        citations = []
    elif intent == "collector_health":
        # Cite sources that are fair/poor/stale/offline
        tenant_sources = STORE.sources.get(tenant_id, {})
        citations = [
            s_id for s_id, s in tenant_sources.items()
            if s.get("state") in ("fair", "poor") or "stale" in str(s.get("reason", "")).lower() or "offline" in str(s.get("reason", "")).lower()
        ]
    elif intent == "audit_history":
        tenant_recs_all = STORE.recommendations.get(tenant_id, [])
        citations = [r.get("rec_id") for r in tenant_recs_all if r.get("rec_id")]

    if not resolved_incident_id and context.get("active_incidents"):
        resolved_incident_id = context["active_incidents"][0].get("incident_id")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    engine_used = "deterministic"
    answer = None

    if api_key and intent not in ("privacy_architecture", "collector_health", "audit_history"):
        try:
            intent_instructions = {
                "root_cause": "Focus on identifying the root cause. Cite the earliest signal, timeline, and contributing anomalies. Emphasize that correlation does not prove causation.",
                "blast_radius": "Focus on listing all affected services, sources, and downstream dependencies. Quantify the scope of impact.",
                "remediation": "Focus on actionable remediation steps. Cite recommendations, confidence levels, risks, and rollback plans. Emphasize simulation-only mode.",
                "fleet_overview": "Provide a concise fleet-wide status summary. List active incidents, degraded sources, and their severities.",
                "collector_health": "Summarize collector freshness and identify any stale or silent collectors.",
                "audit_history": "Summarize approved and rolled-back remediation actions from audit logs.",
                "privacy_architecture": "Explain Cicada's strict Tier 1 to Tier 2 privacy architecture where zero raw logs or passwords leave customer boundaries."
            }

            history_text = ""
            if clean_history:
                history_lines = []
                for turn in clean_history:
                    history_lines.append(f"{turn['role'].upper()}: {turn['content']}")
                history_text = "\nCONVERSATION HISTORY:\n" + "\n".join(history_lines) + "\n"

            prompt = (
                "You are the Velocity Cicada AIOps Copilot. You assist site reliability engineers "
                "in diagnosing and remediating infrastructure incidents using allow-listed metadata ONLY.\n"
                "Rules:\n"
                "1. Answer concisely, directly, and accurately based strictly on the provided JSON metadata context.\n"
                "2. Explicitly cite relevant incident IDs, alert IDs, source IDs, observed metrics, and rollback plans.\n"
                "3. Emphasize that correlation indicates temporal alignment, not absolute causation.\n"
                "4. Do NOT hallucinate raw logs, usernames, passwords, or IPs.\n"
                f"5. INTENT: {intent}. {intent_instructions.get(intent, '')}\n\n"
                f"{history_text}"
                f"CONTEXT (JSON):\n{json.dumps(context, indent=2)}\n\n"
                f"OPERATOR QUESTION: {question}\n"
            )

            req_body = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 500
                }
            }

            url = f"{GEMINI_API_URL}?key={api_key}"
            req_data = json.dumps(req_body).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=4.0) as resp:
                if resp.status == 200:
                    res_json = json.loads(resp.read().decode("utf-8"))
                    candidates = res_json.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            answer = parts[0].get("text", "").strip()
                            if answer:
                                engine_used = "gemini-2.5-flash"
        except Exception:
            answer = None

    if not answer:
        answer = synthesize_deterministic_answer(
            question,
            context,
            citations,
            intent=intent,
            history=clean_history,
            tenant_id=tenant_id
        )
        engine_used = "deterministic"

    # Prepend friendly greeting prefix if detected
    if greeting_detected:
        answer = "Hello! I'm the Velocity Cicada Infrastructure Copilot (Metadata-Only Mode). " + answer

    # ── Ground citations against tenant store ──
    grounded_citations = ground_citations(tenant_id, citations) if intent != "privacy_architecture" else []

    # ── Build suggested_action ──
    suggested_action = None
    if intent not in ("privacy_architecture", "collector_health", "audit_history"):
        suggested_action = build_suggested_action(tenant_id, incident_id=resolved_incident_id)

    # ── Audit log entry ──
    STORE.log_audit(
        tenant_id=tenant_id,
        actor=f"copilot@{tenant_id}",
        action="copilot_query",
        target=resolved_incident_id or "fleet",
        details={
            "intent": intent,
            "engine": engine_used,
            "citations_count": len(grounded_citations),
            "question_length": len(question),
            "has_history": len(clean_history) > 0
        }
    )

    return {
        "answer": answer,
        "citations": grounded_citations,
        "privacy_mode": "metadata_only",
        "tenant_id": tenant_id,
        "engine": engine_used,
        "intent": intent,
        "suggested_action": suggested_action
    }
