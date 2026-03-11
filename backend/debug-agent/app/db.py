import asyncpg
import structlog
from typing import Optional
from app.config import settings

logger = structlog.get_logger()
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> Optional[asyncpg.Pool]:
    return _pool


async def init_db() -> None:
    global _pool
    try:
        _pool = await asyncpg.create_pool(dsn=settings.database_url, min_size=2, max_size=10, command_timeout=30)
        await _pool.execute("""
            CREATE TABLE IF NOT EXISTS error_log (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                error_type TEXT NOT NULL,
                error_fingerprint TEXT NOT NULL,
                occurrence_count INTEGER DEFAULT 1,
                last_seen TIMESTAMPTZ DEFAULT NOW(),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_error_log_user_fingerprint
                ON error_log(user_id, error_fingerprint);
            CREATE TABLE IF NOT EXISTS debug_sessions (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                code TEXT NOT NULL,
                error TEXT,
                response TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        logger.info("db_connected")
    except Exception as e:
        logger.warning("db_unavailable", error=str(e))
        _pool = None


async def close_db() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
