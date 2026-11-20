"""Validate every sample payload against the shared schemas.

Run from repo root:  python contracts/validate.py
Exit code 0 = contracts are consistent. Run this before merging any change to /contracts.
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).parent
payload_schema = json.loads((HERE / "payload_schema.json").read_text())
heartbeat_schema = json.loads((HERE / "heartbeat_schema.json").read_text())

failures = 0
for path in sorted((HERE / "sample_payloads").glob("*.json")):
    doc = json.loads(path.read_text())
    schema = heartbeat_schema if path.name.startswith("heartbeat") else payload_schema
    errors = list(Draft202012Validator(schema).iter_errors(doc))
    expect_invalid = path.name.startswith("INVALID")
    ok = bool(errors) if expect_invalid else not errors
    status = "OK  " if ok else "FAIL"
    note = f"rejected as expected ({len(errors)} violations)" if expect_invalid and errors else ""
    print(f"{status} {path.name} {note}")
    if not ok:
        failures += 1
        for e in errors[:5]:
            print(f"     - {list(e.path)}: {e.message}")

sys.exit(1 if failures else 0)
