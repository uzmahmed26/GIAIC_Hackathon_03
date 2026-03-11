from pydantic import BaseModel, Field
from typing import Literal, Any
from enum import Enum


class AgentRoute(str, Enum):
    CONCEPTS = "concepts"
    DEBUG = "debug"
    EXERCISE = "exercise"
    PROGRESS = "progress"
    GENERAL = "general"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=100)
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str | None = None


class RoutingDecision(BaseModel):
    route: AgentRoute
    confidence: float = Field(..., ge=0.0, le=1.0)
    reason: str
    keywords_matched: list[str] = []


class ChatResponse(BaseModel):
    user_id: str
    message: str
    routing: RoutingDecision
    session_id: str | None = None


class DaprEventEnvelope(BaseModel):
    id: str = ""
    source: str = ""
    type: str = ""
    specversion: str = "1.0"
    datacontenttype: str = "application/json"
    topic: str = ""
    pubsubname: str = ""
    data: dict[str, Any] = {}


class DaprSubscription(BaseModel):
    pubsubname: str
    topic: str
    route: str


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str = "1.0.0"
    db_connected: bool = False


class ReadinessResponse(BaseModel):
    ready: bool
    checks: dict[str, bool]
