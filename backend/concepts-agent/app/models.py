from pydantic import BaseModel, Field
from typing import Literal, Any
from enum import Enum


class Level(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class ChatRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=100)
    message: str = Field(..., min_length=1, max_length=4000)
    level: Level = Level.INTERMEDIATE
    session_id: str | None = None


class ConceptExplanation(BaseModel):
    topic: str
    explanation: str
    code_example: str
    common_mistakes: list[str]
    practice_tip: str
    level: Level


class ChatResponse(BaseModel):
    user_id: str
    message: str
    structured: ConceptExplanation | None = None
    session_id: str | None = None


class TopicInfo(BaseModel):
    module_id: int
    name: str
    topics: list[str]
    difficulty: Level


class TopicsResponse(BaseModel):
    modules: list[TopicInfo]
    total_topics: int


class QuizRequest(BaseModel):
    user_id: str
    topic: str
    level: Level = Level.INTERMEDIATE
    num_questions: int = Field(default=5, ge=1, le=10)


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str


class QuizResponse(BaseModel):
    user_id: str
    topic: str
    level: Level
    questions: list[QuizQuestion]


class DaprEventEnvelope(BaseModel):
    id: str = ""
    source: str = ""
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
