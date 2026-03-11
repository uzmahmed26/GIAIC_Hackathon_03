from collections import defaultdict
from datetime import datetime, timezone

import httpx
import structlog
from fastapi import APIRouter

from app.config import settings
from app.db import get_pool
from app.models import (
    LeaderboardEntry,
    LeaderboardResponse,
    ProgressReport,
    Severity,
    StruggleReason,
    TopicProgress,
    UpdateRequest,
    UpdateResponse,
)

logger = structlog.get_logger()
router = APIRouter(tags=["progress"])

# In-memory fallback store: user_id -> {topic -> TopicProgress}
_store: dict[str, dict[str, TopicProgress]] = defaultdict(dict)
_xp_store: dict[str, int] = defaultdict(int)
_streak_store: dict[str, int] = defaultdict(int)
_fail_store: dict[tuple[str, str], int] = defaultdict(int)  # (user_id, topic) -> count


def _calc_mastery(ex: float, quiz: float, code: float, streak: int) -> float:
    """Mastery = exercises(40%) + quizzes(30%) + code_quality(20%) + streak(10%)"""
    streak_score = min(streak * 10, 100)
    return round(ex * 0.4 + quiz * 0.3 + code * 0.2 + streak_score * 0.1, 1)


def _level_from_xp(xp: int) -> str:
    if xp < 500:
        return "Beginner"
    if xp < 1500:
        return "Elementary"
    if xp < 3000:
        return "Intermediate"
    if xp < 6000:
        return "Advanced"
    return "Expert"


async def _publish_struggle(user_id: str, reason: StruggleReason, severity: Severity, topic: str | None, detail: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{settings.dapr_base_url}/v1.0/publish/{settings.pubsub_name}/struggle.alerts",
                json={
                    "user_id": user_id,
                    "reason": reason.value,
                    "severity": severity.value,
                    "topic": topic,
                    "detail": detail,
                    "source": "progress-agent",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
        logger.info("struggle_alert_published", user_id=user_id, reason=reason, severity=severity)
    except Exception as e:
        logger.warning("struggle_publish_failed", error=str(e))


@router.get("/progress/{user_id}", response_model=ProgressReport)
async def get_progress(user_id: str) -> ProgressReport:
    log = logger.bind(user_id=user_id)
    log.info("progress_request")

    pool = await get_pool()
    topics: list[TopicProgress] = []

    if pool:
        rows = await pool.fetch(
            "SELECT * FROM user_progress WHERE user_id = $1 ORDER BY mastery DESC", user_id
        )
        for row in rows:
            tp = TopicProgress(
                topic=row["topic"],
                module_id=row["module_id"],
                mastery=float(row["mastery"]),
                exercises_score=float(row["exercises_score"]),
                quiz_score=float(row["quiz_score"]),
                code_quality_score=float(row["code_quality_score"]),
                streak_days=int(row["streak_days"]),
                total_xp=int(row["total_xp"]),
            )
            topics.append(tp)

        xp_row = await pool.fetchrow(
            "SELECT COALESCE(SUM(xp_delta), 0) as total FROM xp_events WHERE user_id = $1", user_id
        )
        total_xp = int(xp_row["total"]) if xp_row else 0
    else:
        # In-memory fallback
        topics = list(_store.get(user_id, {}).values())
        total_xp = _xp_store[user_id]

    overall_mastery = round(sum(t.mastery for t in topics) / max(len(topics), 1), 1)
    streak = max((t.streak_days for t in topics), default=0)
    struggle_topics = [t.topic for t in topics if t.mastery < 40]

    return ProgressReport(
        user_id=user_id,
        overall_mastery=overall_mastery,
        total_xp=total_xp,
        streak_days=streak,
        level=_level_from_xp(total_xp),
        topics=topics,
        exercises_completed=len([t for t in topics if t.exercises_score > 0]),
        quizzes_completed=len([t for t in topics if t.quiz_score > 0]),
        struggle_topics=struggle_topics,
    )


@router.post("/update", response_model=UpdateResponse)
async def update_progress(request: UpdateRequest) -> UpdateResponse:
    log = logger.bind(user_id=request.user_id, topic=request.topic)
    log.info("update_request")

    pool = await get_pool()

    if pool:
        # Upsert progress record
        existing = await pool.fetchrow(
            "SELECT * FROM user_progress WHERE user_id = $1 AND topic = $2",
            request.user_id, request.topic,
        )

        if existing:
            ex_score = float(request.exercises_score if request.exercises_score is not None else existing["exercises_score"])
            quiz_score = float(request.quiz_score if request.quiz_score is not None else existing["quiz_score"])
            code_score = float(request.code_quality_score if request.code_quality_score is not None else existing["code_quality_score"])
            streak = int(existing["streak_days"])
        else:
            ex_score = float(request.exercises_score or 0)
            quiz_score = float(request.quiz_score or 0)
            code_score = float(request.code_quality_score or 0)
            streak = _streak_store.get(request.user_id, 0)

        mastery = _calc_mastery(ex_score, quiz_score, code_score, streak)
        xp_delta = request.xp_delta or int(mastery)

        await pool.execute(
            """INSERT INTO user_progress (user_id, topic, module_id, exercises_score, quiz_score,
               code_quality_score, streak_days, total_xp, mastery, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
               ON CONFLICT (user_id, topic) DO UPDATE SET
                 exercises_score = EXCLUDED.exercises_score,
                 quiz_score = EXCLUDED.quiz_score,
                 code_quality_score = EXCLUDED.code_quality_score,
                 total_xp = user_progress.total_xp + $8,
                 mastery = EXCLUDED.mastery,
                 updated_at = NOW()""",
            request.user_id, request.topic, request.module_id,
            ex_score, quiz_score, code_score, streak, xp_delta, mastery,
        )
        await pool.execute(
            "INSERT INTO xp_events (user_id, event_type, xp_delta, topic) VALUES ($1, $2, $3, $4)",
            request.user_id, request.event_type, xp_delta, request.topic,
        )

        total_xp_row = await pool.fetchrow(
            "SELECT COALESCE(SUM(xp_delta), 0) as total FROM xp_events WHERE user_id = $1",
            request.user_id,
        )
        total_xp = int(total_xp_row["total"]) if total_xp_row else xp_delta
    else:
        # In-memory fallback
        existing_tp = _store[request.user_id].get(request.topic)
        ex_score = float(request.exercises_score if request.exercises_score is not None else (existing_tp.exercises_score if existing_tp else 0))
        quiz_score = float(request.quiz_score if request.quiz_score is not None else (existing_tp.quiz_score if existing_tp else 0))
        code_score = float(request.code_quality_score if request.code_quality_score is not None else (existing_tp.code_quality_score if existing_tp else 0))
        streak = _streak_store.get(request.user_id, 0)
        mastery = _calc_mastery(ex_score, quiz_score, code_score, streak)
        xp_delta = request.xp_delta or int(mastery)
        _xp_store[request.user_id] += xp_delta
        _store[request.user_id][request.topic] = TopicProgress(
            topic=request.topic, module_id=request.module_id,
            mastery=mastery, exercises_score=ex_score, quiz_score=quiz_score,
            code_quality_score=code_score, streak_days=streak, total_xp=_xp_store[request.user_id],
        )
        total_xp = _xp_store[request.user_id]

    # Struggle detection: low quiz score
    if request.quiz_score is not None and request.quiz_score < 50:
        await _publish_struggle(
            request.user_id, StruggleReason.LOW_QUIZ_SCORE, Severity.MEDIUM,
            request.topic, f"Quiz score {request.quiz_score:.0f}% on {request.topic}",
        )

    log.info("progress_updated", mastery=mastery, total_xp=total_xp)
    return UpdateResponse(
        user_id=request.user_id,
        topic=request.topic,
        mastery=mastery,
        total_xp=total_xp,
        message=f"Progress updated. Mastery: {mastery:.1f}%, Total XP: {total_xp}",
    )


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard() -> LeaderboardResponse:
    logger.info("leaderboard_request")

    pool = await get_pool()
    entries: list[LeaderboardEntry] = []

    if pool:
        rows = await pool.fetch("""
            SELECT user_id,
                   COALESCE(SUM(xp_delta), 0) as total_xp,
                   MAX(streak_days) as streak_days,
                   AVG(mastery) as avg_mastery
            FROM xp_events
            LEFT JOIN user_progress USING (user_id)
            GROUP BY user_id
            ORDER BY total_xp DESC
            LIMIT 10
        """)
        for i, row in enumerate(rows, 1):
            xp = int(row["total_xp"])
            entries.append(LeaderboardEntry(
                rank=i,
                user_id=row["user_id"],
                total_xp=xp,
                level=_level_from_xp(xp),
                streak_days=int(row["streak_days"] or 0),
                mastery=round(float(row["avg_mastery"] or 0), 1),
            ))
    else:
        # In-memory fallback
        all_users = sorted(_xp_store.items(), key=lambda x: x[1], reverse=True)[:10]
        for i, (uid, xp) in enumerate(all_users, 1):
            topics = list(_store.get(uid, {}).values())
            avg_mastery = sum(t.mastery for t in topics) / max(len(topics), 1)
            entries.append(LeaderboardEntry(
                rank=i, user_id=uid, total_xp=xp,
                level=_level_from_xp(xp),
                streak_days=_streak_store.get(uid, 0),
                mastery=round(avg_mastery, 1),
            ))

    return LeaderboardResponse(entries=entries, total_users=len(entries))
