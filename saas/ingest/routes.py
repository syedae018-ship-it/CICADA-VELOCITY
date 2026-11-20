"""Owner: Person B. POST /ingest, POST /heartbeat, GET /collectors, /metrics, /reliability (contracts/api.md)."""
from fastapi import APIRouter

from saas.aiops import on_ingest  # noqa: F401  (call after a payload is accepted)

router = APIRouter(prefix="/api/v1", tags=["ingest"])

# TODO(Person B): implement endpoints here


async def startup() -> None:
    """Called once when SaaS starts. TODO(Person B): db.init_schema(), seed, offline-detector task."""
    return None
