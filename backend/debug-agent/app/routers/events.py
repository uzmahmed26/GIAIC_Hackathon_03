import structlog
from fastapi import APIRouter
from app.models import DaprEventEnvelope, DaprSubscription

logger = structlog.get_logger()
router = APIRouter(tags=["events"])


@router.get("/dapr/subscribe")
def dapr_subscribe() -> list[DaprSubscription]:
    return [
        DaprSubscription(pubsubname="pubsub", topic="route.debug", route="/events"),
    ]


@router.post("/events")
async def handle_event(envelope: DaprEventEnvelope) -> dict:
    data = envelope.data
    user_id = data.get("user_id", "unknown")
    message = data.get("message", "")
    logger.info("debug_event_received", user_id=user_id, message_preview=message[:80])
    return {"status": "SUCCESS"}
