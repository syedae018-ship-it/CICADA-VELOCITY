"""AIOps engine entrypoint. Owner: Person C."""


def on_ingest(tenant_id: str, payload: dict) -> None:
    """Called by ingest (Person B) for every ACCEPTED payload (never for duplicates).

    TODO(Person C): update baselines → detect anomalies → health states → correlate → recommend.
    """
    return None


async def startup() -> None:
    """Called once when SaaS starts. TODO(Person C): staleness timer, SSE broker."""
    return None
