"""CICADA Local Collector — v3.2 (fully-silent background edition)

A lightweight, privacy-first local telemetry collector built in Python.
Monitors real system metrics and outputs safe, allowlisted JSON snapshots.

v3.2 guarantees no console/terminal window ever appears on Windows,
even from transitive libraries (psutil, nvidia-smi, WMI probes), by
globally patching subprocess with CREATE_NO_WINDOW + SW_HIDE.
"""

import os as _os
import subprocess as _subprocess
import sys as _sys

__version__ = "3.2"
__app_name__ = "CICADA Local Collector"


# ---------------------------------------------------------------------------
# Global subprocess hardening (Windows only).
# Every Popen/run/call/check_output anywhere in this process will now be
# launched with CREATE_NO_WINDOW and a hidden STARTUPINFO. This eliminates
# the cmd.exe flash that appeared every few seconds — regardless of which
# module or third-party dep opens the child.
# ---------------------------------------------------------------------------
if _os.name == "nt":
    _CREATE_NO_WINDOW = 0x08000000
    _DETACHED_PROCESS = 0x00000008

    _startupinfo_hidden = _subprocess.STARTUPINFO()
    _startupinfo_hidden.dwFlags |= _subprocess.STARTF_USESHOWWINDOW
    _startupinfo_hidden.wShowWindow = _subprocess.SW_HIDE

    _original_popen_init = _subprocess.Popen.__init__

    def _silent_popen_init(self, *args, **kwargs):
        # Force CREATE_NO_WINDOW without clobbering flags the caller already set.
        flags = kwargs.get("creationflags", 0)
        kwargs["creationflags"] = flags | _CREATE_NO_WINDOW
        # Force hidden STARTUPINFO if the caller didn't supply one.
        if kwargs.get("startupinfo") is None:
            kwargs["startupinfo"] = _startupinfo_hidden
        return _original_popen_init(self, *args, **kwargs)

    _subprocess.Popen.__init__ = _silent_popen_init  # type: ignore[method-assign]
