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
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        await _pool.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
            CREATE TABLE IF NOT EXISTS routing_log (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                message TEXT NOT NULL,
                route TEXT NOT NULL,
                confidence REAL NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        logger.info("db_connected", dsn=settings.database_url.split("@")[-1])
    except Exception as e:
        logger.warning("db_unavailable", error=str(e), note="Running without persistent storage")
        _pool = None


async def close_db() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
