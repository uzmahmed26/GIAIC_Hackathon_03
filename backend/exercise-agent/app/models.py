from pydantic import BaseModel, Field
from typing import Literal, Any
from enum import Enum


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Level(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class TestCase(BaseModel):
    input: str
    expected_output: str
    description: str


class Exercise(BaseModel):
    id: str
    title: str
    description: str
    difficulty: Difficulty
    topic: str
    starter_code: str
    solution: str
    test_cases: list[TestCase]
    hints: list[str]
    xp_reward: int
    estimated_minutes: int


class GenerateRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=100)
    topic: str = Field(..., min_length=1, max_length=200)
    difficulty: Difficulty = Difficulty.MEDIUM
    level: Level = Level.INTERMEDIATE
    module_id: int | None = None


class GenerateResponse(BaseModel):
    user_id: str
    exercise: Exercise


class GradeRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=100)
    exercise_id: str
    code: str = Field(..., min_length=1, max_length=8000)
    topic: str | None = None


class TestResult(BaseModel):
    test_case: str
    passed: bool
    expected: str
    got: str


class GradeResponse(BaseModel):
    user_id: str
    exercise_id: str
    score: int = Field(..., ge=0, le=100)
    passed: bool
    tests_passed: int
    tests_total: int
    test_results: list[TestResult]
    feedback: str
    pep8_score: int
    xp_earned: int


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
