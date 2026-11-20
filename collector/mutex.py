"""Single-Instance Process Protection Utility.

Guarantees that only a single instance of the Velocity Cicada Collector
runs on the system at any time, preventing resource contention, SQLite lock collisions,
and duplicate network traffic.
"""

import os
import sys
import logging
from typing import Optional

logger = logging.getLogger(__name__)

ERROR_ALREADY_EXISTS = 183


class SingleInstanceLock:
    """Manages an OS-level named mutex or lockfile to guarantee single instance."""

    def __init__(self, lock_name: str = "VelocityCicadaCollector_Mutex", lock_dir: Optional[str] = None):
        self.lock_name = lock_name
        self.lock_dir = lock_dir or os.path.expanduser("~")
        self._mutex_handle = None
        self._lock_file_fd = None
        self._lock_file_path = None
        self.acquired = False

    def acquire(self) -> bool:
        """Attempt to acquire the single-instance lock. Returns True if acquired, False if another instance exists."""
        if os.name == "nt":
            import ctypes
            from ctypes import wintypes

            CreateMutexW = ctypes.windll.kernel32.CreateMutexW
            CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
            CreateMutexW.restype = wintypes.HANDLE

            GetLastError = ctypes.windll.kernel32.GetLastError
            GetLastError.argtypes = []
            GetLastError.restype = wintypes.DWORD

            # Create or open named mutex in Global namespace (covers services and user sessions)
            mutex_name = f"Global\\{self.lock_name}"
            self._mutex_handle = CreateMutexW(None, True, mutex_name)
            last_err = GetLastError()

            if last_err == ERROR_ALREADY_EXISTS or not self._mutex_handle:
                logger.warning("Another instance of Velocity Cicada Collector is already running.")
                self.acquired = False
                return False

            self.acquired = True
            return True
        else:
            # Unix / macOS lockfile mechanism
            self._lock_file_path = os.path.join(self.lock_dir, f".{self.lock_name}.lock")
            try:
                import fcntl
                self._lock_file_fd = open(self._lock_file_path, "a+")
                fcntl.flock(self._lock_file_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                self.acquired = True
                return True
            except (IOError, OSError):
                logger.warning("Another instance of Velocity Cicada Collector is already running (locked %s).", self._lock_file_path)
                self.acquired = False
                return False

    def release(self) -> None:
        """Release the mutex or lock file."""
        if os.name == "nt" and self._mutex_handle:
            import ctypes
            from ctypes import wintypes
            CloseHandle = ctypes.windll.kernel32.CloseHandle
            CloseHandle.argtypes = [wintypes.HANDLE]
            CloseHandle.restype = wintypes.BOOL
            CloseHandle(self._mutex_handle)
            self._mutex_handle = None
        elif self._lock_file_fd:
            try:
                import fcntl
                fcntl.flock(self._lock_file_fd, fcntl.LOCK_UN)
                self._lock_file_fd.close()
                if self._lock_file_path and os.path.exists(self._lock_file_path):
                    os.unlink(self._lock_file_path)
            except Exception:
                pass
            self._lock_file_fd = None
        self.acquired = False
