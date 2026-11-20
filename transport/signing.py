"""HMAC request signing, shared by transport (collector side) and saas/ingest (verify side).

signature = hex(HMAC_SHA256(secret, f"{timestamp}.{raw_body}"))  — see contracts/api.md
"""
import hashlib
import hmac
import time

MAX_SKEW_S = 300


def sign(secret: str, body: bytes, timestamp: int | None = None) -> dict:
    ts = str(int(timestamp if timestamp is not None else time.time()))
    sig = hmac.new(secret.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    return {"X-Timestamp": ts, "X-Signature": sig}


def verify(secret: str, body: bytes, timestamp: str, signature: str, now: float | None = None) -> bool:
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    if abs((now if now is not None else time.time()) - ts) > MAX_SKEW_S:
        return False
    expected = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
