"""Security & Authentication Telemetry Module.

Monitors failed login attempts across operating systems while strictly
preserving user privacy:
- Windows: Checks Event ID 4625 (Failed Logon).
- macOS: Queries system unified log for authentication failure events.
- PRIVACY GUARANTEE: NEVER extracts, logs, or transmits usernames, passwords,
  domain names, account names, or IP addresses. Only returns numerical counts.
- Gracefully handles permission restrictions (e.g. non-elevated user accounts).
"""

import logging
import os
import subprocess
from typing import Any, Dict

from collector.subprocess_util import safe_run_subprocess

logger = logging.getLogger(__name__)


def count_windows_failed_logins() -> Dict[str, Any]:
    """Query Windows Security Event Log for Event ID 4625 (Failed Logon).

    Returns a count of failed logon attempts, or notes permission status
    if the terminal is running under a standard (non-elevated) account.
    """
    cmd = [
        "wevtutil",
        "qe",
        "Security",
        "/q:*[System[(EventID=4625)]]",
        "/c:50",
        "/rd:true",
        "/f:text",
    ]

    try:
        proc = safe_run_subprocess(
            cmd,
            timeout=4,
        )

        if proc.returncode != 0:
            err_msg = proc.stderr.lower()
            if "access is denied" in err_msg or "privilege" in err_msg:
                return {
                    "recent_failed_logins_count": 0,
                    "audit_status": "REQUIRES_ELEVATION (Run as Admin for Windows Security Log)",
                }
            return {
                "recent_failed_logins_count": 0,
                "audit_status": "UNAVAILABLE",
            }

        # Count occurrences of Event[4625] without parsing any personal user data
        events = proc.stdout.count("Event[") or proc.stdout.count("EventID: 4625")
        return {
            "recent_failed_logins_count": events,
            "audit_status": "ACTIVE",
        }

    except Exception as e:
        logger.debug("Failed login check failed: %s", e)
        return {
            "recent_failed_logins_count": 0,
            "audit_status": "UNAVAILABLE",
        }


def count_macos_failed_logins() -> Dict[str, Any]:
    """Query macOS unified log for recent authentication failures (last 1 hour)."""
    cmd = [
        "log",
        "show",
        "--predicate",
        'eventMessage CONTAINS[c] "FAILED LOGIN" OR eventMessage CONTAINS[c] "Authentication failed"',
        "--last",
        "1h",
        "--style",
        "compact",
    ]

    try:
        proc = safe_run_subprocess(
            cmd,
            timeout=4,
        )

        if proc.returncode != 0:
            return {
                "recent_failed_logins_count": 0,
                "audit_status": "REQUIRES_PERMISSION",
            }

        # Count lines matching failures without logging user details
        lines = [line for line in proc.stdout.splitlines() if line.strip() and not line.startswith("Filtering")]
        return {
            "recent_failed_logins_count": len(lines),
            "audit_status": "ACTIVE",
        }

    except Exception as e:
        logger.debug("macOS login check failed: %s", e)
        return {
            "recent_failed_logins_count": 0,
            "audit_status": "UNAVAILABLE",
        }


def get_failed_login_telemetry() -> Dict[str, Any]:
    """Collect privacy-safe failed login count across Windows and macOS.

    Returns:
        Dictionary with recent_failed_logins_count and audit_status.
    """
    if os.name == "nt":
        return count_windows_failed_logins()
    elif os.uname().sysname == "Darwin":
        return count_macos_failed_logins()
    else:
        return {
            "recent_failed_logins_count": 0,
            "audit_status": "UNSUPPORTED_OS",
        }
