from pydantic import BaseModel, Field
from typing import Any
from enum import Enum


class StruggleReason(str, Enum):
    SAME_ERROR_3X = "same_error_3x"
    STUCK_10MIN = "stuck_10min"
    LOW_QUIZ_SCORE = "low_quiz_score"
    FAILED_EXECUTIONS = "failed_executions"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TopicProgress(BaseModel):
    topic: str
    module_id: int
    mastery: float = Field(..., ge=0.0, le=100.0)
    exercises_score: float
    quiz_score: float
    code_quality_score: float
    streak_days: int
    total_xp: int


class ProgressReport(BaseModel):
    user_id: str
    overall_mastery: float
    total_xp: int
    streak_days: int
    level: str
    topics: list[TopicProgress]
    exercises_completed: int
    quizzes_completed: int
    struggle_topics: list[str]


class UpdateRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=100)
    topic: str = Field(..., min_length=1, max_length=200)
    module_id: int = 1
    exercises_score: float | None = Field(default=None, ge=0, le=100)
    quiz_score: float | None = Field(default=None, ge=0, le=100)
    code_quality_score: float | None = Field(default=None, ge=0, le=100)
    xp_delta: int | None = None
    event_type: str = "update"


class UpdateResponse(BaseModel):
    user_id: str
    topic: str
    mastery: float
    total_xp: int
    message: str


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    total_xp: int
    level: str
    streak_days: int
    mastery: float


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
    total_users: int


class StruggleAlert(BaseModel):
    user_id: str
    reason: StruggleReason
    severity: Severity
    topic: str | None = None
    detail: str | None = None


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
