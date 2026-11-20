"""Collector configuration (Person A & Enterprise Windows Agent).

Values come from:
  1. Environment variables (.env)
  2. Persistent JSON configuration (%PROGRAMDATA%\\VelocityCicada\\config.json or %LOCALAPPDATA%\\VelocityCicada\\config.json)

Two access styles are supported and always agree:
  * `from collector.config import settings` → settings.COLLECTOR_ID       (collector modules)
  * `from collector import config`          → config.COLLECTOR_ID         (collector/app.py, transport/)
"""
import hashlib
import json
import os
import platform
from pathlib import Path
from typing import Optional

from collector.dpapi import protect_secret, unprotect_secret

BASE_DIR = Path(__file__).resolve().parent.parent


def get_default_config_file_path() -> Optional[Path]:
    """Resolve standard configuration path for Windows service or user."""
    custom = os.getenv("VELOCITY_CICADA_CONFIG")
    if custom and Path(custom).exists():
        return Path(custom)

    if platform.system() == "Windows":
        prog_data = os.getenv("ProgramData", "C:\\ProgramData")
        p = Path(prog_data) / "VelocityCicada" / "config.json"
        if p.exists():
            return p
        local_app = os.getenv("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))
        p2 = Path(local_app) / "VelocityCicada" / "config.json"
        if p2.exists():
            return p2
    else:
        cfg = Path(os.path.expanduser("~/.config/velocity-cicada/config.json"))
        if cfg.exists():
            return cfg

    return None


class CollectorConfig:
    def __init__(self):
        # Default fallback values
        self.TENANT_ID: str = os.getenv("TENANT_ID", "t_acme")
        self.COLLECTOR_ID: str = os.getenv("COLLECTOR_ID", "c_blr01")
        self.REGION: str = os.getenv("REGION", "ap-south-1")
        self.SOURCE_TZ: str = os.getenv("SOURCE_TZ", "Asia/Kolkata")
        self.SITE_SALT: str = os.getenv("SITE_SALT", "dev-site-salt")
        self.COLLECTOR_SECRET: str = os.getenv("COLLECTOR_SECRET", f"dev-secret-{os.getenv('COLLECTOR_ID', 'c_blr01')}")
        self.SAAS_URL: str = os.getenv("SAAS_URL", "http://localhost:8000")
        self.VERSION: str = "1.0.0"
        self.PORT: int = int(os.getenv("COLLECTOR_PORT", "8001"))
        self.LOCAL_RETENTION_HOURS: int = int(os.getenv("LOCAL_RETENTION_HOURS", "24"))
        
        # Transmission interval: 60 seconds default as required by specification, 5s for fast demo controls
        default_interval = "5" if os.getenv("DEMO_CONTROLS") == "1" else "60"
        self.TRANSMISSION_INTERVAL_SECONDS: int = int(os.getenv("TRANSMISSION_INTERVAL_SECONDS", default_interval))
        self.COLLECTION_INTERVAL_SECONDS: int = int(os.getenv("COLLECTION_INTERVAL_SECONDS", "10"))
        self.SERVICE_NAME: str = os.getenv("SERVICE_NAME", "workstation-host")

        # Paths
        default_data_dir = str(BASE_DIR / "collector" / "data")
        if platform.system() == "Windows" and not os.getenv("COLLECTOR_DATA_DIR") and not os.path.exists("collector/data"):
            prog_data = os.getenv("ProgramData", "C:\\ProgramData")
            default_data_dir = str(Path(prog_data) / "VelocityCicada" / "data")

        self.DATA_DIR: Path = Path(os.getenv("COLLECTOR_DATA_DIR", default_data_dir)).resolve()
        self.DB_PATH: Path = self.DATA_DIR / "collector.db"
        self.PENDING_PAYLOADS_PATH: Path = self.DATA_DIR / "pending_payloads.jsonl"
        self.RULES_PATH: Path = BASE_DIR / "contracts" / "redaction_rules.json"
        self.SCHEMA_PATH: Path = BASE_DIR / "contracts" / "payload_schema.json"

        # Load from config file if available
        self.load_from_file()

    def load_from_file(self, config_path: Optional[Path] = None) -> bool:
        path = config_path or get_default_config_file_path()
        if not path or not path.exists():
            return False

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            if "tenant_id" in data:
                self.TENANT_ID = data["tenant_id"]
            if "collector_id" in data:
                self.COLLECTOR_ID = data["collector_id"]
            if "region" in data:
                self.REGION = data["region"]
            if "source_tz" in data:
                self.SOURCE_TZ = data["source_tz"]
            if "saas_url" in data:
                self.SAAS_URL = data["saas_url"]
            if "site_salt" in data:
                self.SITE_SALT = data["site_salt"]
            if "transmission_interval_seconds" in data:
                self.TRANSMISSION_INTERVAL_SECONDS = int(data["transmission_interval_seconds"])
            if "collection_interval_seconds" in data:
                self.COLLECTION_INTERVAL_SECONDS = int(data["collection_interval_seconds"])
            if "service_name" in data:
                self.SERVICE_NAME = data["service_name"]

            # Decrypt secret if protected
            if "collector_secret" in data:
                self.COLLECTOR_SECRET = unprotect_secret(data["collector_secret"])

            return True
        except Exception:
            return False

    def save_to_file(self, config_path: Path) -> bool:
        """Save current configuration to JSON file with DPAPI secret protection."""
        try:
            config_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "tenant_id": self.TENANT_ID,
                "collector_id": self.COLLECTOR_ID,
                "region": self.REGION,
                "source_tz": self.SOURCE_TZ,
                "saas_url": self.SAAS_URL,
                "site_salt": self.SITE_SALT,
                "collector_secret": protect_secret(self.COLLECTOR_SECRET),
                "transmission_interval_seconds": self.TRANSMISSION_INTERVAL_SECONDS,
                "collection_interval_seconds": self.COLLECTION_INTERVAL_SECONDS,
                "service_name": self.SERVICE_NAME,
            }
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            return True
        except Exception:
            return False

    def get_config_hash(self) -> str:
        rules = self.RULES_PATH.read_text(encoding="utf-8") if self.RULES_PATH.exists() else ""
        content = f"{self.TENANT_ID}:{self.COLLECTOR_ID}:{self.REGION}:{self.SOURCE_TZ}:{self.VERSION}:{rules}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


settings = CollectorConfig()
try:
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

# Module-level aliases (used by collector/app.py and transport/)
TENANT_ID = settings.TENANT_ID
COLLECTOR_ID = settings.COLLECTOR_ID
REGION = settings.REGION
SOURCE_TZ = settings.SOURCE_TZ
SITE_SALT = settings.SITE_SALT
COLLECTOR_SECRET = settings.COLLECTOR_SECRET
SAAS_URL = settings.SAAS_URL
VERSION = settings.VERSION
LOCAL_RETENTION_HOURS = settings.LOCAL_RETENTION_HOURS
TRANSMISSION_INTERVAL_SECONDS = settings.TRANSMISSION_INTERVAL_SECONDS
COLLECTION_INTERVAL_SECONDS = settings.COLLECTION_INTERVAL_SECONDS
SERVICE_NAME = settings.SERVICE_NAME


def reload_settings():
    """Sync module-level attributes with settings object."""
    global TENANT_ID, COLLECTOR_ID, REGION, SOURCE_TZ, SITE_SALT
    global COLLECTOR_SECRET, SAAS_URL, VERSION, LOCAL_RETENTION_HOURS
    global TRANSMISSION_INTERVAL_SECONDS, COLLECTION_INTERVAL_SECONDS, SERVICE_NAME
    TENANT_ID = settings.TENANT_ID
    COLLECTOR_ID = settings.COLLECTOR_ID
    REGION = settings.REGION
    SOURCE_TZ = settings.SOURCE_TZ
    SITE_SALT = settings.SITE_SALT
    COLLECTOR_SECRET = settings.COLLECTOR_SECRET
    SAAS_URL = settings.SAAS_URL
    VERSION = settings.VERSION
    LOCAL_RETENTION_HOURS = settings.LOCAL_RETENTION_HOURS
    TRANSMISSION_INTERVAL_SECONDS = settings.TRANSMISSION_INTERVAL_SECONDS
    COLLECTION_INTERVAL_SECONDS = settings.COLLECTION_INTERVAL_SECONDS
    SERVICE_NAME = settings.SERVICE_NAME
