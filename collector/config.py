"""Collector configuration (Person A). Values come from the environment (.env, see .env.example).

Two access styles are supported and always agree:
  * `from collector.config import settings` → settings.COLLECTOR_ID       (collector modules)
  * `from collector import config`          → config.COLLECTOR_ID         (collector/app.py, transport/)
"""
import hashlib
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class CollectorConfig:
    TENANT_ID: str = os.getenv("TENANT_ID", "t_acme")
    COLLECTOR_ID: str = os.getenv("COLLECTOR_ID", "c_blr01")
    REGION: str = os.getenv("REGION", "ap-south-1")
    SOURCE_TZ: str = os.getenv("SOURCE_TZ", "Asia/Kolkata")
    SITE_SALT: str = os.getenv("SITE_SALT", "dev-site-salt")                       # never leaves the collector
    # Must match the SaaS collector registry (saas/config.py) or every payload is rejected with 401.
    COLLECTOR_SECRET: str = os.getenv("COLLECTOR_SECRET", f"dev-secret-{os.getenv('COLLECTOR_ID', 'c_blr01')}")
    SAAS_URL: str = os.getenv("SAAS_URL", "http://localhost:8000")
    VERSION: str = "1.0.0"
    PORT: int = int(os.getenv("COLLECTOR_PORT", "8001"))
    LOCAL_RETENTION_HOURS: int = int(os.getenv("LOCAL_RETENTION_HOURS", "24"))
    # One data folder per collector process (run a second collector with COLLECTOR_DATA_DIR=collector/data-globex)
    DATA_DIR: Path = Path(os.getenv("COLLECTOR_DATA_DIR", str(BASE_DIR / "collector" / "data"))).resolve()
    DB_PATH: Path = DATA_DIR / "collector.db"
    PENDING_PAYLOADS_PATH: Path = DATA_DIR / "pending_payloads.jsonl"
    RULES_PATH: Path = BASE_DIR / "contracts" / "redaction_rules.json"
    SCHEMA_PATH: Path = BASE_DIR / "contracts" / "payload_schema.json"

    @classmethod
    def get_config_hash(cls) -> str:
        rules = cls.RULES_PATH.read_text(encoding="utf-8") if cls.RULES_PATH.exists() else ""
        content = f"{cls.TENANT_ID}:{cls.COLLECTOR_ID}:{cls.REGION}:{cls.SOURCE_TZ}:{cls.VERSION}:{rules}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


settings = CollectorConfig()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)

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
