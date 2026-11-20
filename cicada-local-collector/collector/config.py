"""Configuration Loader Module.

Loads collector configuration from environment variables, local .env,
and user AppData device_config.json.
Provides safe validation without printing secrets or API keys.
"""

import json
import os
from typing import Optional

from collector.paths import get_device_config_path


def _load_env_file(filepath: str = ".env") -> None:
    """Simple, dependency-free .env file parser."""
    if not os.path.exists(filepath):
        return

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val
    except Exception:
        pass


class CollectorConfig:
    """Encapsulates verified configuration parameters."""

    def __init__(self, env_file: str = ".env"):
        _load_env_file(env_file)

        # 1. Base values from environment variables or .env
        self.supabase_url: Optional[str] = os.getenv("SUPABASE_URL")
        self.supabase_key: Optional[str] = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        self.supabase_token: Optional[str] = os.getenv("SUPABASE_DEVICE_TOKEN")
        self.tenant_id: str = os.getenv("CICADA_TENANT_ID", "00000000-0000-0000-0000-000000000000")
        self.consent_given: bool = (os.getenv("CICADA_CONSENT_GRANTED", "1") == "1")

        # 2. If present, load stored persistent device_config.json in user AppData
        cfg_path = get_device_config_path()
        if os.path.exists(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if not self.supabase_url and data.get("supabase_url"):
                        self.supabase_url = data.get("supabase_url")
                    if not self.supabase_key and data.get("supabase_key"):
                        self.supabase_key = data.get("supabase_key")
                    if not self.supabase_token and data.get("device_token"):
                        self.supabase_token = data.get("device_token")
                    if self.tenant_id == "00000000-0000-0000-0000-000000000000" and data.get("tenant_id"):
                        self.tenant_id = data.get("tenant_id")
                    if "consent_given" in data:
                        self.consent_given = bool(data["consent_given"])
            except Exception:
                pass

        # Collection settings
        try:
            self.interval_seconds: int = int(os.getenv("COLLECTION_INTERVAL_SECONDS", "10"))
        except ValueError:
            self.interval_seconds = 10

        self.probe_target: str = os.getenv("PROBE_TARGET", "1.1.1.1")

    @property
    def is_cloud_enabled(self) -> bool:
        """Return True if minimal Supabase cloud configuration is present."""
        return bool(self.supabase_url and self.supabase_key and self.supabase_url.startswith("https://"))

    @property
    def is_authenticated(self) -> bool:
        """Return True if the collector has enough credentials to upload to Supabase.

        Simplified flow: URL + Anon/Publishable Key is enough. A device token is
        optional (used only when RLS requires a per-device JWT). Consent is
        implicit once the user saves enrollment in the GUI.
        """
        return bool(self.is_cloud_enabled and self.consent_given)

    def sanitized_summary(self) -> dict:
        """Return non-sensitive configuration summary for terminal UI and logging."""
        url_display = self.supabase_url if self.supabase_url else "Not Configured (Local-Only Mode)"
        if not self.is_cloud_enabled:
            cloud_status = "LOCAL_ONLY"
        elif not self.supabase_token:
            cloud_status = "NEEDS_DEVICE_TOKEN"
        elif not self.consent_given:
            cloud_status = "NEEDS_CUSTOMER_CONSENT"
        else:
            cloud_status = "READY"

        return {
            "supabase_url": url_display,
            "cloud_status": cloud_status,
            "tenant_id": self.tenant_id,
            "interval_seconds": self.interval_seconds,
            "probe_target": self.probe_target,
            "consent_given": self.consent_given,
        }
