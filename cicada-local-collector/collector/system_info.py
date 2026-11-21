"""System Information Module.

Collects non-sensitive system environment details:
- Operating system and release version
- CPU architecture and processor model
- Python runtime version

Explicitly supports Windows, macOS Intel (x86_64), macOS Apple Silicon (arm64), and Linux.
Does NOT collect hostname, usernames, or user paths.
"""

import platform
from typing import Any, Dict


def get_processor_name() -> str:
    """Retrieve a sanitized processor description across Windows, macOS, and Linux."""
    try:
        if platform.system() == "Darwin":
            machine = platform.machine()
            if "arm" in machine.lower():
                return f"Apple Silicon ({machine})"
            return f"Intel Mac ({machine})"

        proc = platform.processor()
        if proc and proc.strip():
            return proc.strip()
    except Exception:
        pass

    try:
        machine = platform.machine()
        if machine:
            return f"Generic {machine} Processor"
    except Exception:
        pass

    return "Unknown Processor"


def get_system_info() -> Dict[str, Any]:
    """Gather sanitized system hardware and platform specifications.

    Returns:
        Dictionary containing os_name, os_version, architecture,
        processor, and python_version.
    """
    sys_name = platform.system() or "Unknown"

    # macOS (Darwin) specific friendly enhancements
    if sys_name == "Darwin":
        os_name = "macOS"
        mac_ver = platform.mac_ver()
        os_version = mac_ver[0] if (mac_ver and mac_ver[0]) else (platform.release() or "Unknown")
        architecture = mac_ver[2] if (mac_ver and len(mac_ver) > 2 and mac_ver[2]) else (platform.machine() or "Unknown")
    else:
        os_name = sys_name
        os_version = platform.release() or platform.version() or "Unknown"
        architecture = platform.machine() or "Unknown"

    processor = get_processor_name()

    try:
        python_version = platform.python_version()
    except Exception:
        python_version = "Unknown"

    return {
        "os_name": os_name,
        "os_version": os_version,
        "architecture": architecture,
        "processor": processor,
        "python_version": python_version,
    }
