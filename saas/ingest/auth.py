"""Authentication and tenant isolation helpers for SaaS ingest and read APIs."""
import time
from typing import Optional

from saas import config
from saas.db import db_for_tenant
from transport.signing import verify as verify_hmac


def verify_collector_auth(
    collector_id: str,
    raw_body: bytes,
    timestamp: str,
    signature: str,
) -> tuple[bool, Optional[str], Optional[dict]]:
    """Verify HMAC signature for a collector request.
    
    Returns (is_valid, error_reason, collector_info).
    """
    if not collector_id or collector_id not in config.COLLECTORS:
        return False, "Unknown or missing collector_id", None

    collector_info = config.COLLECTORS[collector_id]
    secret = collector_info.get("secret", "")

    if not timestamp or not signature:
        return False, "Missing X-Timestamp or X-Signature header", None

    is_valid = verify_hmac(secret=secret, body=raw_body, timestamp=timestamp, signature=signature)
    if not is_valid:
        return False, "Invalid HMAC signature or timestamp outside 300s replay window", None

    return True, None, collector_info


def get_tenant_from_auth(auth_header: Optional[str]) -> str:
    """Extract tenant_id from Authorization header.
    
    Supports:
      1. Supabase JWT (Bearer <token>)
      2. Demo token: Bearer demo-<tenant_id> (e.g. demo-t_acme)
      3. Fallback: t_acme (for dev convenience when no auth header is provided)
    """
    if not auth_header:
        return "t_acme"

    parts = auth_header.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return "t_acme"

    token = parts[1]

    # Handle demo token
    if token.startswith("demo-"):
        tenant_id = token[5:]
        return tenant_id if tenant_id in config.TENANTS else "t_acme"

    # Handle Supabase JWT if jwt secret is set
    if config.SUPABASE_JWT_SECRET:
        try:
            import jwt
            payload = jwt.decode(token, config.SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            user_id = payload.get("sub")
            if user_id:
                # Look up tenant in tenant_members
                for region in config.REGIONS:
                    from saas.db import connect
                    conn = connect(region)
                    row = conn.execute("SELECT tenant_id FROM tenant_members WHERE user_id = ?", (user_id,)).fetchone()
                    if row:
                        return row["tenant_id"]
        except Exception:
            pass

    return "t_acme"
