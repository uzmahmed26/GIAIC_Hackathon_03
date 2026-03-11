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
            CREATE TABLE IF NOT EXISTS exercises (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                starter_code TEXT NOT NULL,
                solution TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS submissions (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                exercise_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                score INTEGER NOT NULL,
                passed BOOLEAN NOT NULL,
                feedback TEXT,
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
