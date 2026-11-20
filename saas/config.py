"""SaaS configuration. Regions and seeded demo tenants/collectors (dev only)."""
import os

REGIONS = ["ap-south-1", "eu-west-1", "us-east-1"]
DATA_DIR = os.getenv("SAAS_DATA_DIR", "saas/data")
DASHBOARD_ORIGIN = os.getenv("DASHBOARD_ORIGIN", "http://localhost:3000")

# Dev seed — in production this lives in a registry DB with hashed secrets.
TENANTS = {
    "t_acme": {"name": "Acme Corp", "home_region": "ap-south-1"},
    "t_globex": {"name": "Globex", "home_region": "eu-west-1"},
}
COLLECTORS = {
    "c_blr01": {"tenant_id": "t_acme", "region": "ap-south-1", "secret": "dev-secret-c_blr01"},
    "c_fra01": {"tenant_id": "t_globex", "region": "eu-west-1", "secret": "dev-secret-c_fra01"},
}
