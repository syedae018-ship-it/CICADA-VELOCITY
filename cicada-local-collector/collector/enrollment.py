"""Device Enrollment & Local Credential Module.

Manages secure device onboarding and association with a CICADA tenant.
Stores device credentials in persistent user AppData or reads from environment variables.
Never fakes successful enrollment.
"""

import json
import logging
import os
from typing import Any, Dict, Optional

from collector.paths import get_device_config_path

logger = logging.getLogger(__name__)


class DeviceEnrollmentManager:
    """Handles device enrollment status and token persistence."""

    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or get_device_config_path()

    def load_enrollment_data(self) -> Dict[str, Any]:
        """Load stored device credentials from local configuration file."""
        if not os.path.exists(self.config_path):
            return {}
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning("Could not load device enrollment configuration: %s", e)
            return {}

    def save_enrollment_data(
        self,
        tenant_id: str,
        device_id: str,
        device_token: str,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        consent_given: bool = True,
    ) -> bool:
        """Persist device credentials to user AppData config."""
        os.makedirs(os.path.dirname(self.config_path) or ".", exist_ok=True)
        data = {
            "tenant_id": tenant_id,
            "device_id": device_id,
            "device_token": device_token,
            "consent_given": consent_given,
        }
        if supabase_url:
            data["supabase_url"] = supabase_url
        if supabase_key:
            data["supabase_key"] = supabase_key

        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            return True
        except Exception as e:
            logger.error("Failed to save device credentials to %s: %s", self.config_path, e)
            return False

    def is_enrolled(self) -> bool:
        """Check if device has an enrollment token configured either in file or environment."""
        if os.getenv("SUPABASE_DEVICE_TOKEN"):
            return True
        data = self.load_enrollment_data()
        return bool(data.get("device_token"))

    def has_consent(self) -> bool:
        """Check if explicit user consent has been granted for cloud telemetry transmission."""
        if os.getenv("CICADA_CONSENT_GRANTED") == "1":
            return True
        data = self.load_enrollment_data()
        return bool(data.get("consent_given", False))

    def get_token(self) -> Optional[str]:
        """Retrieve active device token (prefers environment variable)."""
        env_token = os.getenv("SUPABASE_DEVICE_TOKEN")
        if env_token:
            return env_token
        data = self.load_enrollment_data()
        return data.get("device_token")

    def disconnect(self) -> bool:
        """Remove device credentials from local AppData configuration."""
        if os.path.exists(self.config_path):
            try:
                os.remove(self.config_path)
                return True
            except Exception as e:
                logger.error("Failed removing config %s: %s", self.config_path, e)
                return False
        return True
