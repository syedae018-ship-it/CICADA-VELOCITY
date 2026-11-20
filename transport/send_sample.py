"""Helper test script for Person B to test SaaS ingest directly with sample payloads.

Usage:
    .venv/bin/python transport/send_sample.py contracts/sample_payloads/01_normal.json
"""
import json
import sys
from pathlib import Path

import httpx

from transport.signing import sign

if len(sys.argv) < 2:
    print("Usage: python transport/send_sample.py <path_to_sample_payload.json> [saas_url]")
    sys.exit(1)

path = Path(sys.argv[1])
if not path.exists():
    print(f"Error: file {path} not found")
    sys.exit(1)

saas_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
raw_bytes = path.read_bytes()
payload = json.loads(raw_bytes)

collector_id = payload.get("collector_id", "c_blr01")
secret = f"dev-secret-{collector_id}"

headers = {
    "X-Collector-Id": collector_id,
    "Content-Type": "application/json",
    **sign(secret, raw_bytes),
}

url = f"{saas_url.rstrip('/')}/api/v1/ingest"
print(f"POSTing {path.name} to {url} (collector: {collector_id})...")

try:
    resp = httpx.post(url, content=raw_bytes, headers=headers, timeout=10.0)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Failed to connect: {e}")
    sys.exit(1)
