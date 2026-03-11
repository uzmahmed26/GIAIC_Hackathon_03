from pydantic import BaseModel, Field
from typing import Literal, Any
from enum import Enum


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DebugRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=8000)
    error: str | None = None
    language: str = "python"
    session_id: str | None = None


class DebugResponse(BaseModel):
    user_id: str
    error_type: str
    root_cause: str
    hint: str
    fix: str
    prevention_tip: str
    code_quality_score: int = Field(..., ge=0, le=100)
    fixed_code: str | None = None
    struggle_detected: bool = False


class ReviewRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=8000)
    context: str | None = None


class ReviewResponse(BaseModel):
    user_id: str
    pep8_score: int = Field(..., ge=0, le=100)
    efficiency_score: int = Field(..., ge=0, le=100)
    readability_score: int = Field(..., ge=0, le=100)
    overall_score: int = Field(..., ge=0, le=100)
    issues: list[str]
    suggestions: list[str]
    improved_code: str | None = None


class ChatRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=100)
    message: str = Field(..., min_length=1, max_length=4000)
    code_context: str | None = None
    session_id: str | None = None


class ChatResponse(BaseModel):
    user_id: str
    message: str
    session_id: str | None = None


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
