import logging
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db, close_db, get_pool
from app.exceptions import LearnFlowError, learnflow_exception_handler, generic_exception_handler
from app.models import HealthResponse, ReadinessResponse
from app.routers import debug, events

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("debug_agent_starting", port=settings.service_port)
    await init_db()
    yield
    await close_db()
    logger.info("debug_agent_stopped")


app = FastAPI(
    title="LearnFlow Debug Agent",
    description="Analyzes code errors and performs code quality review",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(LearnFlowError, learnflow_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.include_router(debug.router)
app.include_router(events.router)


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    pool = await get_pool()
    return HealthResponse(status="ok", service="debug-agent", db_connected=pool is not None)


@app.get("/readiness", response_model=ReadinessResponse, tags=["health"])
async def readiness() -> ReadinessResponse:
    pool = await get_pool()
    db_ok = False
    if pool:
        try:
            await pool.fetchval("SELECT 1")
            db_ok = True
        except Exception:
            pass
    checks = {"database": db_ok, "openai_key_set": bool(settings.openai_api_key)}
    return ReadinessResponse(ready=all(checks.values()), checks=checks)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.service_port, reload=True)
