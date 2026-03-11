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
            CREATE TABLE IF NOT EXISTS concept_sessions (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                level TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS quiz_results (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                score INTEGER NOT NULL,
                total INTEGER NOT NULL,
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
