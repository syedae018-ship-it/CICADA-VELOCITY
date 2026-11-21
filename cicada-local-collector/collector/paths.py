"""Storage and User Data Path Resolver.

Resolves persistent operating system-specific user data directories:
- Windows: %LOCALAPPDATA%\\CICADA-Collector\\
- macOS: ~/Library/Application Support/CICADA-Collector/
- Linux: ~/.config/cicada-collector/
- Fallback / Dev: ./data/

Ensures user configuration, persistent device IDs, and offline queues
survive application upgrades and are never written to Program Files.
"""

import os
import platform


def get_app_data_dir() -> str:
    """Return the platform-specific user application data directory."""
    custom_dir = os.getenv("CICADA_DATA_DIR")
    if custom_dir:
        os.makedirs(custom_dir, exist_ok=True)
        return custom_dir

    # If running from source repo and local 'data' folder exists, use it in dev mode
    # unless running as a frozen PyInstaller bundle
    is_frozen = getattr(os, "frozen", False) or hasattr(os, "_MEIPASS")
    if not is_frozen and os.path.exists("data"):
        return os.path.abspath("data")

    system = platform.system()
    if system == "Windows":
        base_dir = os.getenv("LOCALAPPDATA") or os.path.expanduser("~\\AppData\\Local")
        target_dir = os.path.join(base_dir, "CICADA-Collector")
    elif system == "Darwin":
        base_dir = os.path.expanduser("~/Library/Application Support")
        target_dir = os.path.join(base_dir, "CICADA-Collector")
    else:
        base_dir = os.getenv("XDG_CONFIG_HOME") or os.path.expanduser("~/.config")
        target_dir = os.path.join(base_dir, "cicada-collector")

    os.makedirs(target_dir, exist_ok=True)
    return target_dir


def get_collector_id_path() -> str:
    """Path to persistent device UUID."""
    return os.path.join(get_app_data_dir(), "collector_id.json")


def get_device_config_path() -> str:
    """Path to device credentials and enrollment settings."""
    return os.path.join(get_app_data_dir(), "device_config.json")


def get_buffer_db_path() -> str:
    """Path to offline SQLite database queue."""
    return os.path.join(get_app_data_dir(), "telemetry_buffer.db")


def get_local_snapshot_path() -> str:
    """Path to local JSON telemetry snapshot."""
    return os.path.join(get_app_data_dir(), "telemetry.json")
