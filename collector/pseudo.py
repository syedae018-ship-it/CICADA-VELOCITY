import hmac
import hashlib
from collector.config import settings

def source_id(host: str, salt: str = None) -> str:
    """
    Computes a pseudonymous source ID from a hostname:
    src_ + HMAC-SHA256(site_salt, host)[:12]
    The salt never leaves the collector site.
    """
    if not host:
        host = "unknown-host"
    effective_salt = (salt or settings.SITE_SALT).encode("utf-8")
    h = hmac.new(effective_salt, host.encode("utf-8"), hashlib.sha256).hexdigest()[:12]
    return f"src_{h}"
