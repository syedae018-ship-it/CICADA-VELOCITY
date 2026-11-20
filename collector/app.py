from contextlib import asynccontextmanager
from fastapi import FastAPI
import asyncio

from collector.routes import router, aggregation_loop, retention_cleanup_loop
from collector.store import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    agg_task = asyncio.create_task(aggregation_loop())
    cleanup_task = asyncio.create_task(retention_cleanup_loop())
    yield
    # Shutdown
    agg_task.cancel()
    cleanup_task.cancel()
    await asyncio.gather(agg_task, cleanup_task, return_exceptions=True)

app = FastAPI(
    title="CICADA-VELOCITY Collector & Privacy Service",
    description="Tier 1 customer-side collector: redacts secrets, generates pseudonymous IDs, detects security anomalies locally, and outputs allow-listed metadata.",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(router)
