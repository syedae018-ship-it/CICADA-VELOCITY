"""Person A's collector endpoints: POST/GET /local/raw, GET /local/detections (contracts/api.md §C)."""
from fastapi import APIRouter

router = APIRouter(prefix="/local", tags=["collector"])

# TODO(Person A): implement endpoints here


async def startup() -> None:
    """Called once when the collector starts. TODO(Person A): start the 5-s aggregation + retention tasks."""
    return None
