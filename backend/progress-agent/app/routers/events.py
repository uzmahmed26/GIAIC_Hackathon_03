from collections import defaultdict
from datetime import datetime, timezone

import httpx
import structlog
from fastapi import APIRouter

from app.config import settings
from app.models import DaprEventEnvelope, DaprSubscription, Severity, StruggleReason

logger = structlog.get_logger()
router = APIRouter(tags=["events"])

# Failed execution tracking: (user_id, topic) -> count
_fail_counts: dict[tuple[str, str], int] = defaultdict(int)


@router.get("/dapr/subscribe")
def dapr_subscribe() -> list[DaprSubscription]:
    return [
        DaprSubscription(pubsubname="pubsub", topic="learning.response", route="/events"),
        DaprSubscription(pubsubname="pubsub", topic="code.submissions", route="/submission-events"),
    ]


@router.post("/events")
async def handle_learning_response(envelope: DaprEventEnvelope) -> dict:
    data = envelope.data
    user_id = data.get("user_id", "unknown")
    topic = data.get("topic", "")
    event_type = data.get("event_type", "")

    logger.info("learning_response_received", user_id=user_id, topic=topic, event_type=event_type)

    # Auto-update progress when quiz or exercise results arrive
    quiz_score = data.get("score") if event_type == "quiz_completed" else None
    if quiz_score is not None and topic:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    "http://localhost:8005/update",
                    json={
                        "user_id": user_id,
                        "topic": topic,
                        "quiz_score": float(quiz_score),
                        "event_type": event_type,
                    },
                )
        except Exception as e:
            logger.warning("self_update_failed", error=str(e))

    return {"status": "SUCCESS"}


@router.post("/submission-events")
async def handle_submission_event(envelope: DaprEventEnvelope) -> dict:
    data = envelope.data
    user_id = data.get("user_id", "unknown")
    topic = data.get("topic", "general")
    passed = bool(data.get("passed", False))
    score = int(data.get("score", 0))

    logger.info("submission_event", user_id=user_id, topic=topic, passed=passed, score=score)

    if not passed:
        key = (user_id, topic)
        _fail_counts[key] += 1
        fail_count = _fail_counts[key]
        logger.info("failed_submission_tracked", user_id=user_id, topic=topic, count=fail_count)

        if fail_count >= settings.struggle_threshold:
            severity = Severity.HIGH if fail_count >= settings.struggle_threshold * 2 else Severity.MEDIUM
            await _publish_struggle_alert(
                user_id=user_id,
                reason=StruggleReason.FAILED_EXECUTIONS,
                severity=severity,
                topic=topic,
                detail=f"{fail_count} failed submissions on '{topic}'",
            )
            # Reset counter after alert
            _fail_counts[key] = 0
    else:
        # Reset failure count on success
        _fail_counts[(user_id, topic)] = 0

        # Auto-update progress on passing submission
        xp_earned = int(data.get("xp_earned", 50))
        code_quality = int(data.get("pep8_score", 70))
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    "http://localhost:8005/update",
                    json={
                        "user_id": user_id,
                        "topic": topic,
                        "exercises_score": float(score),
                        "code_quality_score": float(code_quality),
                        "xp_delta": xp_earned,
                        "event_type": "exercise_completed",
                    },
                )
        except Exception as e:
            logger.warning("progress_update_failed", error=str(e))

    return {"status": "SUCCESS"}


async def _publish_struggle_alert(
    user_id: str, reason: StruggleReason, severity: Severity, topic: str, detail: str
) -> None:
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
        logger.info("struggle_alert_published", user_id=user_id, reason=reason)
    except Exception as e:
        logger.warning("struggle_publish_failed", error=str(e))
