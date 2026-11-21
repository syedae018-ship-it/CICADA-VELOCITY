"""Ingest firewall: the gate between any collector (local collector, Prometheus bridge, anything)
and the SaaS receiver. Every request to /ingest and /heartbeat passes through here BEFORE
HMAC verification, schema validation or storage.

Rules, in order (first failing rule blocks the request):
  1. quarantine       source IP / collector auto-blocked after repeated auth failures
  2. ip_allowlist     source IP must be inside FIREWALL_ALLOWED_CIDRS
  3. content_type     only application/json
  4. size_limit       body <= FIREWALL_MAX_BODY_BYTES
  5. rate_limit       token bucket per collector (or per IP when no collector id)
  6. content_scan     deep scan of every string value for secrets / PII (contracts/redaction_rules.json)
Then, in the route:
  7. hmac_auth        HMAC-SHA256 + 300 s replay window (failures count toward quarantine)
  8. schema           allow-list JSON schema (additionalProperties=false everywhere)

Every decision is kept in an in-memory ring buffer + counters and exposed at
GET /api/v1/firewall/status so the dashboard can show the firewall working live.
"""
from __future__ import annotations

import ipaddress
import json
import os
import re
import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from saas import config

CONTRACTS_DIR = Path(__file__).resolve().parent.parent.parent / "contracts"

DEFAULT_CIDRS = "127.0.0.0/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
ALLOWED_NETS = [
    ipaddress.ip_network(c.strip(), strict=False)
    for c in os.getenv("FIREWALL_ALLOWED_CIDRS", DEFAULT_CIDRS).split(",")
    if c.strip()
]
MAX_BODY_BYTES = int(os.getenv("FIREWALL_MAX_BODY_BYTES", str(256 * 1024)))
RATE_PER_MIN = int(os.getenv("FIREWALL_RATE_PER_MIN", "120"))
AUTH_FAIL_LIMIT = 5            # failed HMAC attempts ...
AUTH_FAIL_WINDOW_S = 60        # ... within this window ...
QUARANTINE_S = 300             # ... quarantine the source for this long

# Keys whose values are machine identifiers/timestamps, not free text — skipped by the content scan.
_SKIP_KEYS = {"payload_id", "event_id", "source_id", "collector_id", "tenant_id", "config_hash", "region",
              "schema_version", "source_tz"}
# ipv6 is left out on purpose: it false-positives on "09:15:04"-style times inside summaries.
_SCAN_RULES = {"private_key", "jwt", "bearer_token", "aws_access_key", "api_key_kv", "password_kv",
               "credit_card", "email", "ipv4"}


def _load_patterns() -> list[tuple[str, re.Pattern]]:
    try:
        rules = json.loads((CONTRACTS_DIR / "redaction_rules.json").read_text())["rules"]
    except Exception:
        rules = []
    return [(r["name"], re.compile(r["pattern"])) for r in rules if r["name"] in _SCAN_RULES]


PATTERNS = _load_patterns()

RULES = [
    {"id": "quarantine", "name": "Auto-quarantine",
     "description": f"Sources with {AUTH_FAIL_LIMIT}+ failed signatures in {AUTH_FAIL_WINDOW_S}s are blocked for {QUARANTINE_S // 60} min"},
    {"id": "ip_allowlist", "name": "Source IP allow-list",
     "description": "Only " + ", ".join(str(n) for n in ALLOWED_NETS)},
    {"id": "content_type", "name": "Content-type lock", "description": "Only application/json is accepted"},
    {"id": "size_limit", "name": "Payload size cap", "description": f"Max {MAX_BODY_BYTES // 1024} KB per request"},
    {"id": "rate_limit", "name": "Rate limit", "description": f"{RATE_PER_MIN} requests/min per collector"},
    {"id": "content_scan", "name": "Deep content inspection",
     "description": "Blocks payloads carrying secrets, keys, tokens, emails, IPs or card numbers"},
    {"id": "hmac_auth", "name": "HMAC signature",
     "description": "HMAC-SHA256 per collector, 300 s replay window"},
    {"id": "schema", "name": "Schema allow-list", "description": "Unknown fields rejected (additionalProperties=false)"},
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


@dataclass
class _Bucket:
    tokens: float
    updated: float


class IngestFirewall:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._log: deque[dict] = deque(maxlen=200)
        self._counters = {"allowed": 0, "blocked": 0, "by_rule": {r["id"]: 0 for r in RULES}}
        self._buckets: dict[str, _Bucket] = {}
        self._auth_fails: dict[str, deque[float]] = {}
        self._quarantine: dict[str, float] = {}   # key -> until (epoch s)
        self.started_at = _now_iso()

    # ── decisions ────────────────────────────────────────────────────────────
    def _record(self, *, action: str, rule: Optional[str], ip: str, collector_id: Optional[str],
                endpoint: str, reason: str, synthetic: bool = False) -> None:
        tenant = (config.COLLECTORS.get(collector_id or "") or {}).get("tenant_id")
        with self._lock:
            if action == "allow":
                self._counters["allowed"] += 1
            else:
                self._counters["blocked"] += 1
                if rule:
                    self._counters["by_rule"][rule] = self._counters["by_rule"].get(rule, 0) + 1
            self._log.appendleft({"at_utc": _now_iso(), "action": action, "rule": rule, "ip": ip,
                                  "collector_id": collector_id, "tenant_id": tenant, "endpoint": endpoint,
                                  "reason": reason, "synthetic": synthetic})

    def _block(self, status_code: int, rule: str, reason: str, *, ip: str, collector_id: Optional[str],
               endpoint: str, synthetic: bool) -> HTTPException:
        self._record(action="block", rule=rule, ip=ip, collector_id=collector_id, endpoint=endpoint,
                     reason=reason, synthetic=synthetic)
        return HTTPException(status_code=status_code, detail={"status": "blocked_by_firewall", "rule": rule,
                                                              "reason": reason})

    def allow(self, ip: str, collector_id: Optional[str], endpoint: str, reason: str = "passed all rules",
              synthetic: bool = False) -> None:
        self._record(action="allow", rule=None, ip=ip, collector_id=collector_id, endpoint=endpoint, reason=reason,
                     synthetic=synthetic)

    def deny(self, rule: str, ip: str, collector_id: Optional[str], endpoint: str, reason: str,
             synthetic: bool = False) -> None:
        """Record a block decided later in the pipeline (HMAC / schema)."""
        self._record(action="block", rule=rule, ip=ip, collector_id=collector_id, endpoint=endpoint,
                     reason=reason, synthetic=synthetic)
        if rule == "hmac_auth" and not synthetic:
            self._note_auth_failure(ip, collector_id)

    # ── rule helpers ─────────────────────────────────────────────────────────
    def _note_auth_failure(self, ip: str, collector_id: Optional[str]) -> None:
        now = time.time()
        with self._lock:
            for key in filter(None, (f"ip:{ip}", f"c:{collector_id}" if collector_id else None)):
                q = self._auth_fails.setdefault(key, deque())
                q.append(now)
                while q and now - q[0] > AUTH_FAIL_WINDOW_S:
                    q.popleft()
                if len(q) >= AUTH_FAIL_LIMIT:
                    self._quarantine[key] = now + QUARANTINE_S
                    q.clear()

    def _quarantined(self, ip: str, collector_id: Optional[str]) -> Optional[str]:
        now = time.time()
        with self._lock:
            for key in (f"ip:{ip}", f"c:{collector_id}"):
                until = self._quarantine.get(key)
                if until and until > now:
                    return key
                if until:
                    self._quarantine.pop(key, None)
        return None

    def _take_token(self, key: str) -> bool:
        now = time.time()
        rate = RATE_PER_MIN / 60.0
        with self._lock:
            b = self._buckets.get(key) or _Bucket(tokens=float(RATE_PER_MIN), updated=now)
            b.tokens = min(float(RATE_PER_MIN), b.tokens + (now - b.updated) * rate)
            b.updated = now
            ok = b.tokens >= 1
            if ok:
                b.tokens -= 1
            self._buckets[key] = b
            return ok

    @staticmethod
    def _ip_allowed(ip: str) -> bool:
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            return ip == "testclient"   # FastAPI TestClient (unit tests)
        return any(addr in net for net in ALLOWED_NETS)

    @staticmethod
    def _scan(doc, path: str = "") -> Optional[str]:
        """Return 'rule at path' for the first secret/PII found in any string value, else None."""
        if isinstance(doc, dict):
            for k, v in doc.items():
                if k in _SKIP_KEYS or k.endswith("_utc"):
                    continue
                hit = IngestFirewall._scan(v, f"{path}.{k}" if path else k)
                if hit:
                    return hit
        elif isinstance(doc, list):
            for i, v in enumerate(doc):
                hit = IngestFirewall._scan(v, f"{path}[{i}]")
                if hit:
                    return hit
        elif isinstance(doc, str):
            for name, pat in PATTERNS:
                if pat.search(doc):
                    return f"{name} found in {path or 'body'}"
        return None

    # ── the gate ─────────────────────────────────────────────────────────────
    def inspect(self, *, ip: str, collector_id: Optional[str], content_type: Optional[str], body: bytes,
                endpoint: str, synthetic: bool = False) -> None:
        """Raise HTTPException if any pre-auth rule blocks the request."""
        kw = dict(ip=ip, collector_id=collector_id, endpoint=endpoint, synthetic=synthetic)
        q = self._quarantined(ip, collector_id)
        if q:
            raise self._block(403, "quarantine", f"{q} is quarantined after repeated signature failures", **kw)
        if not self._ip_allowed(ip):
            raise self._block(403, "ip_allowlist", f"source {ip} is not in the allow-list", **kw)
        if not (content_type or "").lower().startswith("application/json"):
            raise self._block(415, "content_type", f"content-type '{content_type or 'none'}' not allowed", **kw)
        if len(body) > MAX_BODY_BYTES:
            raise self._block(413, "size_limit", f"{len(body)} bytes exceeds {MAX_BODY_BYTES}", **kw)
        if not self._take_token(f"c:{collector_id}" if collector_id else f"ip:{ip}"):
            raise self._block(429, "rate_limit", f"over {RATE_PER_MIN}/min", **kw)
        try:
            doc = json.loads(body.decode("utf-8"))
        except Exception:
            return   # malformed JSON is rejected (and recorded) by the schema stage
        hit = self._scan(doc)
        if hit:
            raise self._block(422, "content_scan", hit, **kw)

    # ── status for the dashboard ─────────────────────────────────────────────
    def status(self, tenant_id: str) -> dict:
        now = time.time()
        with self._lock:
            # A tenant sees its own traffic plus unattributed attempts (unknown collector ids).
            recent = [e for e in self._log if e["tenant_id"] in (tenant_id, None)][:50]
            counters = json.loads(json.dumps(self._counters))
            quarantined = [{"key": k, "seconds_left": int(u - now)} for k, u in self._quarantine.items() if u > now]
        return {"enabled": True, "started_at_utc": self.started_at, "rules": RULES, "counters": counters,
                "quarantined": quarantined, "recent": recent}


FIREWALL = IngestFirewall()


def client_ip(request) -> str:
    return request.client.host if request.client else "unknown"
