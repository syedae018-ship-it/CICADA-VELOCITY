"""Ingest API. Owner: M2. Routes: POST /ingest, POST /heartbeat, GET /collectors, /metrics, /reliability."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["ingest"])

# TODO(M2): implement endpoints per contracts/api.md section A
