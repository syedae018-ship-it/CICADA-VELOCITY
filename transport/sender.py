"""Background sender loop and heartbeat worker for the collector.

Features:
  * Drains local outbox oldest-first (seq order)
  * Transmits exact stored bytes over HTTPS/HTTP with HMAC-SHA256 headers
  * Handles responses:
      - 202 Accepted  -> mark sent, remove from active queue
      - 200 Duplicate -> mark sent (idempotent recovery)
      - 422 Rejected  -> move to dead_letter
      - 5xx / timeout -> exponential backoff (1 -> 2 -> 4 -> 8 -> 15s)
  * Periodic heartbeat every 10s
  * Link switch (/local/saas-link {"enabled": false}) simulates SaaS outage for Scenario #2
"""
import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from collector import config
from transport.db import (
    get_buffer_stats,
    get_pending_outbox,
    mark_outbox_dead_letter,
    mark_outbox_failure,
    mark_outbox_sent,
)
from transport.signing import sign

logger = logging.getLogger(__name__)

BACKOFF_STEPS = [1, 2, 4, 8, 15]

_saas_link_enabled: bool = True
_saas_reachable: Optional[bool] = None
_last_sent_utc: Optional[str] = None
_sender_task: Optional[asyncio.Task] = None
_heartbeat_task: Optional[asyncio.Task] = None


def is_saas_link_enabled() -> bool:
    return _saas_link_enabled


def set_saas_link(enabled: bool) -> bool:
    global _saas_link_enabled
    _saas_link_enabled = enabled
    return _saas_link_enabled


def get_saas_reachable() -> Optional[bool]:
    return _saas_reachable if _saas_link_enabled else False


def get_last_sent_utc() -> Optional[str]:
    return _last_sent_utc


def get_buffer_depth() -> int:
    stats = get_buffer_stats()
    return stats.get("depth", 0)


async def _send_one_payload(client: httpx.AsyncClient, row: dict) -> bool:
    global _saas_reachable, _last_sent_utc
    payload_id = row["payload_id"]
    attempts = row.get("attempts", 0) + 1
    body_str = row["body"]
    body_bytes = body_str.encode("utf-8")

    headers = {
        "X-Collector-Id": config.COLLECTOR_ID,
        "Content-Type": "application/json",
        **sign(config.COLLECTOR_SECRET, body_bytes),
    }

    url = f"{config.SAAS_URL.rstrip('/')}/api/v1/ingest"

    try:
        resp = await client.post(url, content=body_bytes, headers=headers, timeout=5.0)
        _saas_reachable = True

        if resp.status_code in (200, 202):
            result = resp.json().get("status", "accepted")
            mark_outbox_sent(payload_id, attempts, result)
            _last_sent_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            return True
        elif resp.status_code == 422:
            err_msg = resp.text
            mark_outbox_dead_letter(payload_id, attempts, err_msg)
            return False
        else:
            # 5xx, 401, 403, or other error
            delay_idx = min(attempts - 1, len(BACKOFF_STEPS) - 1)
            delay = BACKOFF_STEPS[delay_idx]
            next_retry = (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat().replace("+00:00", "Z")
            mark_outbox_failure(payload_id, attempts, next_retry, f"HTTP {resp.status_code}")
            return False
    except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
        _saas_reachable = False
        delay_idx = min(attempts - 1, len(BACKOFF_STEPS) - 1)
        delay = BACKOFF_STEPS[delay_idx]
        next_retry = (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat().replace("+00:00", "Z")
        mark_outbox_failure(payload_id, attempts, next_retry, f"Connection error: {type(exc).__name__}")
        return False
    except Exception as exc:
        # Unknown failure: back off like a network error instead of retrying in a tight loop
        logger.exception("Unexpected error sending payload %s", payload_id)
        delay = BACKOFF_STEPS[min(attempts - 1, len(BACKOFF_STEPS) - 1)]
        next_retry = (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat().replace("+00:00", "Z")
        mark_outbox_failure(payload_id, attempts, next_retry, f"Error: {type(exc).__name__}")
        return False


async def sender_loop() -> None:
    """Continuously drain the pending outbox in sequence order."""
    async with httpx.AsyncClient() as client:
        while True:
            try:
                if not _saas_link_enabled:
                    await asyncio.sleep(1)
                    continue

                rows = get_pending_outbox(limit=10)
                if not rows:
                    await asyncio.sleep(0.5)
                    continue

                for row in rows:
                    if not _saas_link_enabled:
                        break
                    success = await _send_one_payload(client, row)
                    if not success:
                        # Break out of batch on failure to maintain in-order draining with backoff
                        break
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Error in sender loop: %s", exc)
                await asyncio.sleep(1)


async def heartbeat_loop() -> None:
    """Send periodic heartbeat to SaaS every 10 seconds."""
    global _saas_reachable
    async with httpx.AsyncClient() as client:
        while True:
            try:
                await asyncio.sleep(10)
                if not _saas_link_enabled:
                    continue

                now_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                buffer_depth = get_buffer_depth()
                config_hash = hashlib.sha256(
                    f"{config.COLLECTOR_ID}:{config.TENANT_ID}:{config.REGION}:{config.VERSION}".encode()
                ).hexdigest()[:16]

                hb_data = {
                    "collector_id": config.COLLECTOR_ID,
                    "tenant_id": config.TENANT_ID,
                    "region": config.REGION,
                    "sent_at_utc": now_utc,
                    "version": config.VERSION,
                    "buffer_depth": buffer_depth,
                    "config_hash": config_hash,
                }
                body_bytes = json.dumps(hb_data, sort_keys=True, separators=(",", ":")).encode("utf-8")
                headers = {
                    "X-Collector-Id": config.COLLECTOR_ID,
                    "Content-Type": "application/json",
                    **sign(config.COLLECTOR_SECRET, body_bytes),
                }

                url = f"{config.SAAS_URL.rstrip('/')}/api/v1/heartbeat"
                try:
                    resp = await client.post(url, content=body_bytes, headers=headers, timeout=5.0)
                    _saas_reachable = resp.status_code < 500
                    if resp.status_code >= 400:
                        logger.warning("Heartbeat rejected: HTTP %s %s", resp.status_code, resp.text[:200])
                except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError):
                    _saas_reachable = False
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Error in heartbeat loop: %s", exc)


def start_workers() -> None:
    global _sender_task, _heartbeat_task
    if _sender_task is None or _sender_task.done():
        _sender_task = asyncio.create_task(sender_loop())
    if _heartbeat_task is None or _heartbeat_task.done():
        _heartbeat_task = asyncio.create_task(heartbeat_loop())
