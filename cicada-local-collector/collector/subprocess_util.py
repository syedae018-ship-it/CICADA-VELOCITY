"""Safe Subprocess Execution Utility for Velocity CICADA Local Collector.

Guarantees that on Windows, NO console or terminal window is ever spawned or flashed
when running child processes (such as ping, powershell, nvidia-smi, or wevtutil).
"""

import os
import subprocess
from typing import Any, List, Optional


def safe_run_subprocess(
    cmd: List[str],
    timeout: Optional[float] = None,
    capture_output: bool = True,
    text: bool = True,
    **kwargs: Any,
) -> subprocess.CompletedProcess:
    """Run a child process safely without flashing a console or terminal window on Windows."""
    if os.name == "nt":
        # 0x08000000 = CREATE_NO_WINDOW: prevent Windows from creating a console window
        create_no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
        existing_flags = kwargs.get("creationflags", 0)
        kwargs["creationflags"] = existing_flags | create_no_window

        # Hide any window using STARTUPINFO
        startupinfo = kwargs.get("startupinfo")
        if startupinfo is None:
            startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE
        kwargs["startupinfo"] = startupinfo

    if capture_output:
        kwargs.setdefault("stdout", subprocess.PIPE)
        kwargs.setdefault("stderr", subprocess.PIPE)

    return subprocess.run(cmd, timeout=timeout, text=text, **kwargs)
