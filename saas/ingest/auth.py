"""Authentication helpers. Owner: Person B. Person C reuses get_tenant() on their endpoints.

  * Collectors → SaaS: HMAC-SHA256 (verify_collector_auth)
  * Dashboard → SaaS:  Supabase Auth JWT → user id → tenant_members → tenant_id (get_tenant)
                       `Bearer demo-<tenant_id>` is accepted ONLY when DEV_INSECURE=1 (local dev / tests).
There is NO default tenant: a missing or invalid token is always 401. Tenant isolation depends on it.
"""
import hashlib
import logging
import time
from typing import Optional

from fastapi import Header, HTTPException, status

from saas import config
from saas.db import get_store, get_supabase_client
from transport.signing import verify as verify_hmac

logger = logging.getLogger(__name__)


def verify_collector_auth(
    collector_id: str,
    raw_body: bytes,
    timestamp: str,
    signature: str,
) -> tuple[bool, Optional[str], Optional[dict]]:
    """Verify the HMAC signature of a collector request. Returns (is_valid, error_reason, collector_info)."""
    collector_info = config.COLLECTORS.get(collector_id or "")
    if not collector_info:
        return False, "Unknown or missing collector_id", None
    if not timestamp or not signature:
        return False, "Missing X-Timestamp or X-Signature header", None
    if not verify_hmac(secret=collector_info["secret"], body=raw_body, timestamp=timestamp, signature=signature):
        return False, "Invalid HMAC signature or timestamp outside 300s replay window", None
    return True, None, collector_info


def _unauthorized(reason: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=reason,
                         headers={"WWW-Authenticate": "Bearer"})


_TOKEN_CACHE: dict[str, tuple[float, str]] = {}   # sha256(token) -> (expires_at, user_id)
_TOKEN_TTL_S = 60


def _user_id_from_jwt(token: str) -> Optional[str]:
    """Validated user id for a Supabase access token, cached for 60 s (the dashboard polls often)."""
    key = hashlib.sha256(token.encode()).hexdigest()
    hit = _TOKEN_CACHE.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    user_id = _validate_jwt(token)
    if user_id:
        if len(_TOKEN_CACHE) > 1000:
            _TOKEN_CACHE.clear()
        _TOKEN_CACHE[key] = (time.time() + _TOKEN_TTL_S, user_id)
    return user_id


def _validate_jwt(token: str) -> Optional[str]:
    # 1. Legacy HS256 projects: verify locally with the JWT secret (fast, no network).
    if config.SUPABASE_JWT_SECRET:
        try:
            import jwt
            claims = jwt.decode(token, config.SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            return claims.get("sub")
        except Exception:
            pass
    # 2. Asymmetric-key projects (or no secret configured): ask Supabase Auth to validate the token.
    client = get_supabase_client()
    if client is not None:
        try:
            res = client.auth.get_user(token)
            return res.user.id if res and res.user else None
        except Exception as exc:
            logger.info("Supabase token rejected: %s", type(exc).__name__)
    return None


def tenant_from_authorization(authorization: Optional[str]) -> str:
    """Resolve the caller's tenant from an Authorization header or raise 401."""
    if not authorization:
        raise _unauthorized("Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized("Authorization must be 'Bearer <token>'")

    if token.startswith("demo-"):
        tenant_id = token[5:]
        if config.DEV_INSECURE and tenant_id in config.TENANTS:
            return tenant_id
        raise _unauthorized("Demo tokens are disabled (DEV_INSECURE=0) or tenant unknown")

    user_id = _user_id_from_jwt(token)
    if not user_id:
        raise _unauthorized("Invalid or expired token")
    tenant_id = get_store().tenant_for_user(user_id)
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a member of any tenant")
    return tenant_id


def get_tenant(authorization: Optional[str] = Header(None)) -> str:
    """FastAPI dependency: `tenant_id: str = Depends(get_tenant)`."""
    return tenant_from_authorization(authorization)
