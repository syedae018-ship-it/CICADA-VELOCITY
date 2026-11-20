from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from .thresholds import THRESHOLDS

# State severity ordering: excellent (0) < good (1) < fair (2) < poor (3)
STATE_RANK = {
    "excellent": 0,
    "good": 1,
    "fair": 2,
    "poor": 3
}
RANK_TO_STATE = {v: k for k, v in STATE_RANK.items()}

def evaluate_metric_state(metric: str, value: Any) -> Tuple[str, Optional[str]]:
    if isinstance(value, bool):
        booleans = THRESHOLDS.get("booleans", {})
        if metric in booleans:
            rule = booleans[metric]
            if not value:
                return rule.get("false_state", "poor"), f"{metric} is False"
        return "excellent", None

    if not isinstance(value, (int, float)):
        return "excellent", None

    metrics_cfg = THRESHOLDS.get("metrics", {})
    if metric in metrics_cfg:
        cfg = metrics_cfg[metric]
        exc_max = cfg.get("excellent_max", float("inf"))
        good_max = cfg.get("good_max", float("inf"))
        fair_max = cfg.get("fair_max", float("inf"))

        if value <= exc_max:
            return "excellent", None
        elif value <= good_max:
            return "good", f"{metric} {value} > excellent_max {exc_max}"
        elif value <= fair_max:
            return "fair", f"{metric} {value} > good_max {good_max}"
        else:
            return "poor", f"{metric} {value} > fair_max {fair_max}"

    return "excellent", None

def get_worst_state(states_with_reasons: List[Tuple[str, Optional[str]]]) -> Tuple[str, str]:
    if not states_with_reasons:
        return "excellent", "nominal"

    worst_rank = -1
    worst_state = "excellent"
    reasons = []

    for state, reason in states_with_reasons:
        rank = STATE_RANK.get(state, 0)
        if rank > worst_rank:
            worst_rank = rank
            worst_state = state
        if reason:
            reasons.append(reason)

    combined_reason = "; ".join(reasons) if reasons else "nominal operations"
    return worst_state, combined_reason

def apply_staleness(current_state: str, seconds_since_seen: float) -> Tuple[str, str]:
    staleness_cfg = THRESHOLDS.get("staleness", {})
    source_stale_after = staleness_cfg.get("source_stale_after_s", 30)

    if seconds_since_seen > source_stale_after:
        rank = STATE_RANK.get(current_state, 0)
        downgraded_rank = min(rank + 1, 3)
        downgraded_state = RANK_TO_STATE[downgraded_rank]
        reason = f"stale: no data for {int(seconds_since_seen)}s"
        return downgraded_state, reason

    return current_state, ""

def aggregate_service_health(sources: List[Dict[str, Any]]) -> Tuple[str, str]:
    """
    Service-centric health: aggregates health states across all sources mapped to a service.
    Worst source state determines the overall service health.
    """
    if not sources:
        return "excellent", "no sources registered"

    states_with_reasons = []
    for s in sources:
        st = s.get("state", "excellent")
        reason = s.get("reason", "")
        source_id = s.get("source_id", "src")
        formatted_reason = f"{source_id}: {reason}" if reason else f"{source_id}: {st}"
        states_with_reasons.append((st, formatted_reason))

    return get_worst_state(states_with_reasons)
