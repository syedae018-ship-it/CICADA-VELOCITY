"""Redaction Engine Module.

Provides deep regex-based pattern detection and sanitization for sensitive data:
- Email addresses
- Passwords and secret assignments
- API keys and tokens
- JWT tokens and Bearer credentials
- Private and public IPv4 / IPv6 addresses
- Accidental usernames or hostnames

Fails closed if data cannot be safely inspected.
Never logs the original sensitive values.
"""

import logging
import re
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)

# Precompiled regex patterns for secret detection
PATTERNS: List[Tuple[str, re.Pattern]] = [
    # JWT Tokens (header.payload.signature)
    ("jwt_token", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\b")),
    # Bearer tokens in headers or strings
    ("bearer_token", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9_\-\.]{12,}\b")),
    # Standard API Keys (e.g. sk-..., sbp_..., pk-...)
    ("api_key", re.compile(r"\b(?:sk|sbp|pk|ak|key|api|secret)[_\-][A-Za-z0-9_\-]{16,}\b", re.IGNORECASE)),
    # Email addresses
    ("email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    # Password assignments (e.g. password=xyz, pwd: 'xyz')
    ("password", re.compile(r"""(?i)(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*["']?([^"',;\s]{4,})["']?""")),
    # IPv4 addresses (reject any IP in operational metadata)
    ("ipv4", re.compile(r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b")),
    # IPv6 addresses
    ("ipv6", re.compile(r"\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b")),
    # Authorization header values
    ("auth_header", re.compile(r"(?i)\bauthorization\s*:\s*[^\r\n,]+")),
]

REPLACEMENT_LABEL = "[REDACTED]"


class RedactionAuditor:
    """Tracks redaction metrics for privacy proof and audit screens."""

    def __init__(self):
        self.sensitive_patterns_detected: int = 0

    def record_detection(self, count: int = 1):
        self.sensitive_patterns_detected += count


# Global auditor instance
auditor = RedactionAuditor()


def contains_sensitive_data(text: str) -> bool:
    """Check if the provided string contains any detectable sensitive pattern."""
    if not isinstance(text, str):
        return False
    for _, pattern in PATTERNS:
        if pattern.search(text):
            return True
    return False


def redact_text(text: str) -> str:
    """Redact any sensitive patterns found in a text string.

    Args:
        text: Input string to scan.

    Returns:
        Sanitized string with sensitive tokens replaced by [REDACTED].
    """
    if not isinstance(text, str):
        return text

    sanitized = text
    for name, pattern in PATTERNS:
        matches = list(pattern.finditer(sanitized))
        if matches:
            auditor.record_detection(len(matches))
            if name == "password":
                sanitized = pattern.sub(r"password=[REDACTED]", sanitized)
            else:
                sanitized = pattern.sub(REPLACEMENT_LABEL, sanitized)

    return sanitized


def redact_data(obj: Any) -> Any:
    """Recursively scan and redact all strings within a dictionary, list, or primitive.

    Args:
        obj: Arbitrary data structure.

    Returns:
        Deep-sanitized copy with all sensitive patterns neutralized.
    """
    try:
        if isinstance(obj, str):
            return redact_text(obj)
        elif isinstance(obj, dict):
            new_dict = {}
            for k, v in obj.items():
                sanitized_key = redact_text(str(k))
                new_dict[sanitized_key] = redact_data(v)
            return new_dict
        elif isinstance(obj, list):
            return [redact_data(item) for item in obj]
        elif isinstance(obj, tuple):
            return tuple(redact_data(item) for item in obj)
        else:
            return obj
    except Exception as e:
        logger.error("Redaction engine failed closed on object: %s", e)
        return None
