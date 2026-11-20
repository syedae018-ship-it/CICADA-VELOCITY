"""Collector → SaaS transport. Owner: M2 (see transport/README.md).

Public API used by the collector (M1):
    submit(payload: dict) -> str     # returns payload_id; never raises on SaaS outage
"""


def submit(payload: dict) -> str:
    """TODO(M2): assign payload_id/seq/sent_at_utc, validate, write outbox + egress_log."""
    raise NotImplementedError
