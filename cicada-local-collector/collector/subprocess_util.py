"""Safe Subprocess Execution Utility for Velocity Cicada Local Collector.

Guarantees that on Windows, NO console window is ever spawned or flashed
when running child processes (such as ping, wevtutil, powershell, or nvidia-smi).
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
    """Run a subprocess safely without flashing terminal or console windows on Windows."""
    if os.name == "nt":
        # 0x08000000 = CREATE_NO_WINDOW
        kwargs.setdefault("creationflags", 0x08000000)

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
