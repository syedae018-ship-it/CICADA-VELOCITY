import os
import hashlib
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class CollectorConfig:
    TENANT_ID: str = os.getenv("TENANT_ID", "t_acme")
    COLLECTOR_ID: str = os.getenv("COLLECTOR_ID", "c_blr01")
    REGION: str = os.getenv("REGION", "ap-south-1")
    SOURCE_TZ: str = os.getenv("SOURCE_TZ", "Asia/Kolkata")
    SITE_SALT: str = os.getenv("SITE_SALT", "cicada_secure_local_salt_never_leaves_site_98765")
    COLLECTOR_SECRET: str = os.getenv("COLLECTOR_SECRET", "super_secret_collector_key")
    SAAS_URL: str = os.getenv("SAAS_URL", "http://localhost:8000")
    VERSION: str = "1.0.0"
    PORT: int = int(os.getenv("COLLECTOR_PORT", "8001"))
    LOCAL_RETENTION_HOURS: int = int(os.getenv("LOCAL_RETENTION_HOURS", "24"))
    DATA_DIR: Path = BASE_DIR / "collector" / "data"
    DB_PATH: Path = DATA_DIR / "collector.db"
    PENDING_PAYLOADS_PATH: Path = DATA_DIR / "pending_payloads.jsonl"
    RULES_PATH: Path = BASE_DIR / "contracts" / "redaction_rules.json"
    SCHEMA_PATH: Path = BASE_DIR / "contracts" / "payload_schema.json"

    @classmethod
    def get_config_hash(cls) -> str:
        rules_content = ""
        if cls.RULES_PATH.exists():
            try:
                rules_content = cls.RULES_PATH.read_text(encoding="utf-8")
            except Exception:
                rules_content = ""
        content = f"{cls.TENANT_ID}:{cls.COLLECTOR_ID}:{cls.REGION}:{cls.SOURCE_TZ}:{cls.VERSION}:{rules_content}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

settings = CollectorConfig()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
