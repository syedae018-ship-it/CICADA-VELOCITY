"""Collector-side local endpoints owned by Person B, mounted on the collector app (port 8001).

/local/egress, /local/egress/{payload_id}, /local/buffer, /local/saas-link  (contracts/api.md §C)
Already wired into collector/app.py, so Person B never needs to edit Person A's file.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/local", tags=["transport"])

# TODO(Person B): implement endpoints here
