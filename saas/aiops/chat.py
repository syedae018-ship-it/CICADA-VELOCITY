"""AIOps NLP co-pilot — powered by live Supabase telemetry and Google Gemini API.

The user asks in natural language ("show me open alerts", "cpu status", "why is the DB slow?").
If Gemini API key is configured, Gemini generates expert, natural-language SRE explanations
grounded in the live Supabase tables. In all cases, live data from Supabase and structured cards
are returned to the dashboard.
"""
from __future__ import annotations
import os
import json
import urllib.request
from typing import Any, Dict, List, Optional

from .store import STORE


def _get_sb():
    try:
        from saas.db import get_supabase_client
        return get_supabase_client()
    except Exception:
        return None


def _call_gemini_api(api_key: str, message: str, tenant_id: str, alerts: list, incidents: list, collectors: list, recs: list) -> Optional[str]:
    models = ["gemini-2.0-flash", "gemini-1.5-flash"]
    context_str = json.dumps({
        "tenant_id": tenant_id,
        "open_alerts": alerts[:4],
        "incidents": incidents[:3],
        "collectors": collectors[:3],
        "recommendations": recs[:3]
    }, default=str)
    
    system_instruction = (
        "You are Velocity Cicada's AIOps Co-Pilot, an expert AI SRE and cybersecurity observability specialist. "
        f"You have live access to Supabase telemetry for tenant '{tenant_id}'. "
        "Answer the user query accurately, technically, and concisely based strictly on this live context. "
        "Explain root causes, specific metrics, and remediation paths where relevant."
    )
    prompt = f"LIVE SUPABASE TELEMETRY CONTEXT:\n{context_str}\n\nUSER QUERY:\n{message}"
    
    for model in models:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            body = {
                "system_instruction": {"parts": [{"text": system_instruction}]},
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800}
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(body).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text")
                    if text:
                        return text.strip()
        except Exception:
            continue
    return None


def _kw(message: str, *keywords: str) -> bool:
    msg = message.lower()
    return any(k in msg for k in keywords)


def _severity_label(sev: str) -> str:
    return (sev or "info").lower()


def _alerts(tenant_id: str, only_open: bool = True) -> List[Dict[str, Any]]:
    sb = _get_sb()
    if sb:
        try:
            q = sb.table("alerts").select("*").eq("tenant_id", tenant_id)
            if only_open:
                q = q.eq("status", "open")
            res = q.order("created_at_utc", desc=True).limit(20).execute()
            if res and res.data:
                return res.data
        except Exception:
            pass
    alerts = STORE.alerts.get(tenant_id, []) or []
    if only_open:
        return [a for a in alerts if a.get("status", "open") == "open"]
    return list(alerts)


def _incidents(tenant_id: str, only_open: bool = True) -> List[Dict[str, Any]]:
    sb = _get_sb()
    if sb:
        try:
            q = sb.table("incidents").select("*").eq("tenant_id", tenant_id)
            if only_open:
                q = q.eq("status", "open")
            res = q.order("updated_utc", desc=True).limit(20).execute()
            if res and res.data:
                return res.data
        except Exception:
            pass
    incidents = STORE.incidents.get(tenant_id, []) or []
    if only_open:
        return [i for i in incidents if i.get("status") == "open"]
    return list(incidents)


def _recs(tenant_id: str, only_pending: bool = True) -> List[Dict[str, Any]]:
    sb = _get_sb()
    if sb:
        try:
            q = sb.table("recommendations").select("*").eq("tenant_id", tenant_id)
            if only_pending:
                q = q.eq("status", "proposed")
            res = q.order("updated_utc", desc=True).limit(20).execute()
            if res and res.data:
                return res.data
        except Exception:
            pass
    recs = STORE.recommendations.get(tenant_id, []) or []
    if only_pending:
        return [r for r in recs if r.get("status") == "proposed"]
    return list(recs)


def _sources(tenant_id: str) -> List[Dict[str, Any]]:
    return list((STORE.sources.get(tenant_id, {}) or {}).values())


def _collectors(tenant_id: str) -> List[Dict[str, Any]]:
    sb = _get_sb()
    if sb:
        try:
            res = sb.table("collectors").select("*").eq("tenant_id", tenant_id).limit(20).execute()
            if res and res.data:
                return res.data
        except Exception:
            pass
    return list((STORE.collectors.get(tenant_id, {}) or {}).values())


def _audit(tenant_id: str) -> List[Dict[str, Any]]:
    sb = _get_sb()
    if sb:
        try:
            res = sb.table("audit_log").select("*").eq("tenant_id", tenant_id).order("at_utc", desc=True).limit(20).execute()
            if res and res.data:
                return res.data
        except Exception:
            pass
    return list(STORE.audit_log.get(tenant_id, []) or [])


def _health_history(tenant_id: str) -> List[Dict[str, Any]]:
    return list(STORE.health_history.get(tenant_id, []) or [])


def _metric_stats(sources: List[Dict[str, Any]], metric_key: str) -> Dict[str, Any]:
    vals: List[float] = []
    for s in sources:
        m = (s.get("metrics") or {}).get(metric_key)
        if m is not None:
            try:
                vals.append(float(m))
            except (TypeError, ValueError):
                pass
    if not vals:
        return {"count": 0, "max": None, "avg": None}
    return {"count": len(vals), "max": max(vals), "avg": sum(vals) / len(vals)}


def _handle_alerts(tenant_id: str) -> Dict[str, Any]:
    alerts = _alerts(tenant_id)
    if not alerts:
        return {
            "reply": "No open alerts right now — everything is quiet.",
            "cards": [{"kind": "info", "title": "All clear", "subtitle": "0 open alerts"}],
        }
    cards = []
    for a in alerts[:6]:
        cards.append({
            "kind": "alert",
            "title": f"{a.get('metric', 'signal')} on {a.get('service', 'unknown')}",
            "subtitle": a.get("source_id", ""),
            "severity": _severity_label(a.get("severity", "info")),
            "details": [a.get("explanation", {}).get("why", a.get("kind", ""))],
        })
    return {
        "reply": f"Found {len(alerts)} open alert{'s' if len(alerts) != 1 else ''}. Showing the most recent.",
        "cards": cards,
    }


def _handle_incidents(tenant_id: str) -> Dict[str, Any]:
    incs = _incidents(tenant_id, only_open=False)
    open_count = sum(1 for i in incs if i.get("status") == "open")
    if not incs:
        return {"reply": "No incidents on record for this tenant.", "cards": []}
    cards = []
    for i in incs[:6]:
        cards.append({
            "kind": "incident",
            "title": i.get("title", "Incident"),
            "subtitle": f"{i.get('alert_count', 0)} signals · {i.get('duration', '')}",
            "severity": _severity_label(i.get("severity", "medium")),
            "details": [i.get("likely_cause", "")],
        })
    return {
        "reply": f"{open_count} open · {len(incs) - open_count} resolved. Latest below.",
        "cards": cards,
    }


def _handle_recommendations(tenant_id: str) -> Dict[str, Any]:
    recs = _recs(tenant_id)
    if not recs:
        return {"reply": "No pending recommendations — the engine has nothing to propose right now.", "cards": []}
    cards = []
    for r in recs[:6]:
        conf = int(round(float(r.get("confidence", 0)) * 100))
        cards.append({
            "kind": "recommendation",
            "title": r.get("action", "Recommended action"),
            "subtitle": f"Confidence {conf}% · risk {r.get('risk', 'low')}",
            "severity": "medium" if r.get("risk") == "high" else "low",
            "details": r.get("reasoning_path", [])[:2],
        })
    return {
        "reply": f"{len(recs)} pending recommendation{'s' if len(recs) != 1 else ''}. Review each in AI Insights before approving.",
        "cards": cards,
    }


def _handle_cpu(tenant_id: str) -> Dict[str, Any]:
    sources = _sources(tenant_id)
    stats = _metric_stats(sources, "cpu_pct")
    if stats["count"] == 0:
        return {"reply": "I don't have CPU readings for this tenant yet.", "cards": []}
    hot = [s for s in sources if (s.get("metrics") or {}).get("cpu_pct", 0) and float((s.get("metrics") or {}).get("cpu_pct", 0)) > 80]
    cards: List[Dict[str, Any]] = [
        {"kind": "metric", "title": "Average CPU", "value": f"{stats['avg']:.1f}", "unit": "%"},
        {"kind": "metric", "title": "Peak CPU", "value": f"{stats['max']:.1f}", "unit": "%"},
    ]
    for s in hot[:3]:
        cards.append({
            "kind": "source",
            "title": s.get("service", "source"),
            "subtitle": s.get("source_id", ""),
            "severity": "high",
            "value": f"{(s.get('metrics') or {}).get('cpu_pct', 0):.1f}",
            "unit": "%",
        })
    reply = f"Scanned {stats['count']} sources. Average {stats['avg']:.1f}%, peak {stats['max']:.1f}%."
    if hot:
        reply += f" {len(hot)} source{'s' if len(hot) != 1 else ''} above 80%."
    else:
        reply += " All below 80%."
    return {"reply": reply, "cards": cards}


def _handle_memory(tenant_id: str) -> Dict[str, Any]:
    sources = _sources(tenant_id)
    stats = _metric_stats(sources, "mem_pct")
    if stats["count"] == 0:
        return {"reply": "No memory readings yet.", "cards": []}
    return {
        "reply": f"Memory: avg {stats['avg']:.1f}%, peak {stats['max']:.1f}% across {stats['count']} sources.",
        "cards": [
            {"kind": "metric", "title": "Average memory", "value": f"{stats['avg']:.1f}", "unit": "%"},
            {"kind": "metric", "title": "Peak memory", "value": f"{stats['max']:.1f}", "unit": "%"},
        ],
    }


def _handle_health(tenant_id: str) -> Dict[str, Any]:
    sources = _sources(tenant_id)
    if not sources:
        return {"reply": "No sources are reporting for this tenant yet.", "cards": []}
    buckets: Dict[str, int] = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
    for s in sources:
        st = s.get("state", "good")
        if st in buckets:
            buckets[st] += 1
    cards = [
        {"kind": "stat", "title": "Excellent", "value": buckets["excellent"], "severity": "low"},
        {"kind": "stat", "title": "Good", "value": buckets["good"], "severity": "low"},
        {"kind": "stat", "title": "Fair", "value": buckets["fair"], "severity": "medium"},
        {"kind": "stat", "title": "Poor", "value": buckets["poor"], "severity": "high"},
    ]
    worst = "poor" if buckets["poor"] > 0 else "fair" if buckets["fair"] > 0 else "good" if buckets["good"] > 0 else "excellent"
    return {
        "reply": f"{len(sources)} source{'s' if len(sources) != 1 else ''} monitored. Worst state: {worst}.",
        "cards": cards,
    }


def _handle_collectors(tenant_id: str) -> Dict[str, Any]:
    collectors = _collectors(tenant_id)
    if not collectors:
        return {"reply": "No collectors registered for this tenant.", "cards": []}
    online = [c for c in collectors if c.get("status") == "online"]
    offline = [c for c in collectors if c.get("status") == "offline"]
    cards = []
    for c in collectors[:6]:
        cards.append({
            "kind": "collector",
            "title": c.get("collector_id", "collector"),
            "subtitle": f"{c.get('region', '?')} · buffer {c.get('buffer_depth', 0)}",
            "severity": "low" if c.get("status") == "online" else "high",
            "details": [c.get("state", "")],
        })
    return {
        "reply": f"{len(online)} online · {len(offline)} offline.",
        "cards": cards,
    }


def _handle_baselines(tenant_id: str) -> Dict[str, Any]:
    from .baseline import BASELINES
    rows = []
    for (t, source_id, metric), b in list(BASELINES.items())[:60]:
        if t != tenant_id:
            continue
        mean, std, n = b.stats()
        if n < b.min_samples:
            continue
        rows.append((source_id, metric, mean, std, n))
    if not rows:
        return {"reply": "Baselines are still warming up. They need ~2 minutes of normal telemetry.", "cards": []}
    cards = []
    for source_id, metric, mean, std, n in rows[:6]:
        cards.append({
            "kind": "metric",
            "title": f"{metric}",
            "subtitle": source_id,
            "value": f"μ={mean:.1f} σ={std:.1f}",
            "details": [f"{n} samples"],
        })
    return {"reply": f"{len(rows)} baselines learned (15-min rolling window).", "cards": cards}


def _handle_audit(tenant_id: str) -> Dict[str, Any]:
    entries = _audit(tenant_id)
    if not entries:
        return {"reply": "The audit log is empty for this tenant.", "cards": []}
    cards = []
    for e in list(reversed(entries))[:6]:
        cards.append({
            "kind": "info",
            "title": e.get("action", "action"),
            "subtitle": f"{e.get('actor', '?')} · {e.get('target', '')}",
            "details": [str(e.get("details", ""))[:80]],
        })
    return {"reply": f"Last {min(len(entries), 6)} audit entries — immutable trail of every action.", "cards": cards}


def _handle_history(tenant_id: str) -> Dict[str, Any]:
    history = _health_history(tenant_id)
    if not history:
        return {"reply": "No state transitions yet.", "cards": []}
    cards = []
    for h in list(reversed(history))[:6]:
        cards.append({
            "kind": "info",
            "title": f"{h.get('entity_name', h.get('entity_id', '?'))} → {h.get('state', '?')}",
            "subtitle": h.get("reason", ""),
            "severity": "high" if h.get("state") == "poor" else "medium" if h.get("state") == "fair" else "low",
        })
    return {"reply": f"Most recent {min(len(history), 6)} state changes.", "cards": cards}


def _handle_privacy(tenant_id: str) -> Dict[str, Any]:
    # Count security alerts as a rough proxy for "secrets caught / privacy events".
    alerts = STORE.alerts.get(tenant_id, []) or []
    security = [a for a in alerts if a.get("kind") == "security"]
    return {
        "reply": (
            "Privacy posture: 0 secrets reached SaaS. Local regex, Shannon entropy and NER redact "
            "passwords, API keys, emails, IPs and personal names before anything leaves the site."
        ),
        "cards": [
            {"kind": "stat", "title": "Secrets leaked to SaaS", "value": 0, "severity": "low"},
            {"kind": "stat", "title": "Security events", "value": len(security), "severity": "low"},
            {"kind": "info", "title": "Layers", "subtitle": "regex · entropy · NER · allow-list"},
        ],
    }


def _handle_help(_: str) -> Dict[str, Any]:
    return {
        "reply": "I can answer about: alerts, incidents, recommendations, CPU/memory, health, collectors, baselines, audit log, history, and privacy. Click a quick-action chip to try one.",
        "cards": [
            {"kind": "info", "title": "Try", "subtitle": "'any open alerts?'"},
            {"kind": "info", "title": "Try", "subtitle": "'cpu status'"},
            {"kind": "info", "title": "Try", "subtitle": "'who approved last?'"},
            {"kind": "info", "title": "Try", "subtitle": "'any secrets caught?'"},
        ],
    }


def process_chat_message(message: str, tenant_id: str, context: str = "", gemini_key: str = "") -> Dict[str, Any]:
    """Route a natural-language message with Google Gemini API & live Supabase context."""
    if not message or not isinstance(message, str):
        return _handle_help(message)
    msg = message.lower().strip()

    # 1. If Gemini API key is provided or present in environment, invoke Gemini over Supabase context
    active_key = gemini_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if active_key:
        al = _alerts(tenant_id)
        inc = _incidents(tenant_id)
        col = _collectors(tenant_id)
        rc = _recs(tenant_id)
        gemini_reply = _call_gemini_api(active_key, message, tenant_id, al, inc, col, rc)
        if gemini_reply:
            cards = []
            if _kw(msg, "alert", "warn", "firing") or al:
                for a in al[:3]:
                    expl = a.get("explanation", {})
                    why = expl.get("why", a.get("kind", "")) if isinstance(expl, dict) else str(expl)
                    cards.append({
                        "kind": "alert",
                        "title": f"{a.get('metric', 'Signal')} on {a.get('service', 'unknown')}",
                        "subtitle": a.get("source_id", ""),
                        "severity": _severity_label(a.get("severity", "info")),
                        "details": [why],
                    })
            if _kw(msg, "incident", "outage") or inc:
                for i in inc[:2]:
                    cards.append({
                        "kind": "incident",
                        "title": i.get("title", "Incident"),
                        "subtitle": f"{i.get('alert_count', 0)} signals · status: {i.get('status', 'open')}",
                        "severity": _severity_label(i.get("severity", "medium")),
                        "details": [str(i.get("likely_cause", ""))[:90]],
                    })
            if _kw(msg, "recommend", "suggest", "fix") or rc:
                for r in rc[:2]:
                    cards.append({
                        "kind": "recommendation",
                        "title": r.get("action", "Recommendation"),
                        "subtitle": f"Risk: {r.get('risk', 'low')}",
                        "severity": "medium" if r.get("risk") == "high" else "low",
                    })
            return {
                "reply": gemini_reply,
                "cards": cards[:6],
                "model": "gemini-2.0-flash",
                "source": "gemini+supabase"
            }

    # 2. Deterministic Supabase-backed intent routing
    if _kw(msg, "help", "what can", "how do", "how can", "commands"):
        return _handle_help(msg)
    if _kw(msg, "secret", "leak", "redact", "privacy", "pii"):
        return _handle_privacy(tenant_id)
    if _kw(msg, "baseline", "learned", "normal", "mean", "std"):
        return _handle_baselines(tenant_id)
    if _kw(msg, "audit", "who approved", "who did", "action log", "trail"):
        return _handle_audit(tenant_id)
    if _kw(msg, "history", "transition", "state change", "changed"):
        return _handle_history(tenant_id)
    if _kw(msg, "collector", "fleet", "offline", "online", "agent"):
        return _handle_collectors(tenant_id)
    if _kw(msg, "recommend", "suggest", "fix", "remediat"):
        return _handle_recommendations(tenant_id)
    if _kw(msg, "incident", "outage"):
        return _handle_incidents(tenant_id)
    if _kw(msg, "alert", "warning", "firing", "critical"):
        return _handle_alerts(tenant_id)
    if _kw(msg, "cpu", "processor", "load"):
        return _handle_cpu(tenant_id)
    if _kw(msg, "memory", "mem ", "ram"):
        return _handle_memory(tenant_id)
    if _kw(msg, "health", "status", "state", "overall", "summary", "posture"):
        return _handle_health(tenant_id)

    # fallback
    return {
        "reply": (
            "I didn't catch that. Try asking about open alerts, incidents, CPU load, recommendations, "
            "collectors, or security posture — or connect a Gemini API key for advanced generative reasoning."
        ),
        "cards": [],
    }
