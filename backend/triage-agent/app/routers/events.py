import structlog
from fastapi import APIRouter
from app.models import DaprEventEnvelope, DaprSubscription

logger = structlog.get_logger()
router = APIRouter(tags=["events"])


@router.get("/dapr/subscribe")
def dapr_subscribe() -> list[DaprSubscription]:
    """Dapr auto-discovers this endpoint to register subscriptions."""
    return [
        DaprSubscription(pubsubname="pubsub", topic="learning.events", route="/events"),
    ]


@router.post("/events")
async def handle_event(envelope: DaprEventEnvelope) -> dict:
    data = envelope.data
    user_id = data.get("user_id", "unknown")
    event_type = data.get("type", "unknown")

    logger.info("event_received", topic=envelope.topic, user_id=user_id, event_type=event_type)

    # Triage incoming learning events and re-route as needed
    # (actual routing happens in /chat — this handles async events from other services)
    return {"status": "SUCCESS"}
