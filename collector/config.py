"""Collector configuration, from environment (.env). Shared keys are documented in .env.example."""
import os

COLLECTOR_ID = os.getenv("COLLECTOR_ID", "c_blr01")
TENANT_ID = os.getenv("TENANT_ID", "t_acme")
REGION = os.getenv("REGION", "ap-south-1")
SOURCE_TZ = os.getenv("SOURCE_TZ", "Asia/Kolkata")
SAAS_URL = os.getenv("SAAS_URL", "http://localhost:8000")
COLLECTOR_SECRET = os.getenv("COLLECTOR_SECRET", "dev-secret-c_blr01")  # never leaves the collector
SITE_SALT = os.getenv("SITE_SALT", "dev-site-salt")                     # never leaves the collector
LOCAL_RETENTION_HOURS = int(os.getenv("LOCAL_RETENTION_HOURS", "24"))
VERSION = "0.1.0"
