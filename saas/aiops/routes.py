"""Read API for the dashboard. Owner: Person C. See contracts/api.md §B."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["aiops"])

# TODO(Person C): /overview, /alerts, /incidents, /incidents/{id}, /health-history, /audit,
#                 /recommendations/{id}/approve|rollback, /stream (SSE)
