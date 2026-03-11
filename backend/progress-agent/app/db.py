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
            CREATE TABLE IF NOT EXISTS user_progress (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                module_id INTEGER NOT NULL DEFAULT 1,
                exercises_score REAL DEFAULT 0,
                quiz_score REAL DEFAULT 0,
                code_quality_score REAL DEFAULT 0,
                streak_days INTEGER DEFAULT 0,
                total_xp INTEGER DEFAULT 0,
                mastery REAL DEFAULT 0,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, topic)
            );
            CREATE TABLE IF NOT EXISTS xp_events (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                xp_delta INTEGER NOT NULL,
                topic TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS failed_submissions (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                topic TEXT,
                fail_count INTEGER DEFAULT 1,
                last_failed TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, topic)
            );
            CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
            CREATE INDEX IF NOT EXISTS idx_xp_events_user_id ON xp_events(user_id);
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
