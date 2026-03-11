import json
import uuid
import textwrap
from io import StringIO
from typing import Any

import httpx
import structlog
from fastapi import APIRouter
from openai import AsyncOpenAI

from app.config import settings
from app.db import get_pool
from app.exceptions import LLMError
from app.models import (
    Difficulty,
    Exercise,
    GenerateRequest,
    GenerateResponse,
    GradeRequest,
    GradeResponse,
    TestCase,
    TestResult,
)

logger = structlog.get_logger()
router = APIRouter(tags=["exercises"])

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


XP_MAP = {Difficulty.EASY: 50, Difficulty.MEDIUM: 100, Difficulty.HARD: 200}
TIME_MAP = {Difficulty.EASY: 10, Difficulty.MEDIUM: 20, Difficulty.HARD: 35}

GENERATE_SYSTEM_PROMPT = """You are an expert Python exercise creator for LearnFlow tutoring platform.
Create engaging, educational exercises that progressively build skills.

Rules:
- starter_code must have meaningful scaffolding (not empty), include docstrings
- solution must be complete and working
- test_cases must be concrete, testable input/output pairs (not "see output")
- hints must be progressive (hint1=gentle nudge, hint2=bigger clue, hint3=almost solution)
- description must be clear and engaging with real-world context

ALWAYS respond with valid JSON:
{
  "title": "<engaging exercise title>",
  "description": "<2-3 sentence description with real-world context>",
  "starter_code": "<Python code with function signature, docstring, and TODO comments>",
  "solution": "<complete working Python solution>",
  "test_cases": [
    {"input": "<function_name(args)>", "expected_output": "<exact expected output>", "description": "<what this tests>"},
    {"input": "<function_name(args)>", "expected_output": "<exact expected output>", "description": "<what this tests>"},
    {"input": "<function_name(args)>", "expected_output": "<exact expected output>", "description": "<edge case>"}
  ],
  "hints": [
    "<Hint 1: general direction>",
    "<Hint 2: more specific approach>",
    "<Hint 3: near-solution hint>"
  ]
}"""


@router.post("/generate", response_model=GenerateResponse)
async def generate_exercise(request: GenerateRequest) -> GenerateResponse:
    log = logger.bind(user_id=request.user_id, topic=request.topic, difficulty=request.difficulty)
    log.info("generate_request")

    try:
        resp = await get_client().chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": GENERATE_SYSTEM_PROMPT},
                {"role": "user", "content": (
                    f"Topic: {request.topic}\n"
                    f"Difficulty: {request.difficulty}\n"
                    f"Student level: {request.level}\n"
                    f"Create a practical, engaging exercise."
                )},
            ],
            temperature=0.7,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data: dict[str, Any] = json.loads(raw)
    except Exception as e:
        logger.error("generate_failed", error=str(e))
        raise LLMError(f"Exercise generation failed: {e}")

    exercise_id = str(uuid.uuid4())[:8]
    test_cases = [
        TestCase(
            input=tc.get("input", ""),
            expected_output=tc.get("expected_output", ""),
            description=tc.get("description", ""),
        )
        for tc in data.get("test_cases", [])
    ]

    exercise = Exercise(
        id=exercise_id,
        title=data.get("title", f"{request.topic} Exercise"),
        description=data.get("description", ""),
        difficulty=request.difficulty,
        topic=request.topic,
        starter_code=data.get("starter_code", f"# {request.topic}\ndef solution():\n    # TODO: implement\n    pass\n"),
        solution=data.get("solution", ""),
        test_cases=test_cases,
        hints=data.get("hints", []),
        xp_reward=XP_MAP[request.difficulty],
        estimated_minutes=TIME_MAP[request.difficulty],
    )

    # Persist to DB
    pool = await get_pool()
    if pool:
        try:
            await pool.execute(
                "INSERT INTO exercises (user_id, topic, difficulty, title, description, starter_code, solution) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7)",
                request.user_id, request.topic, request.difficulty.value,
                exercise.title, exercise.description, exercise.starter_code, exercise.solution,
            )
        except Exception as db_err:
            log.warning("db_write_failed", error=str(db_err))

    log.info("exercise_generated", title=exercise.title, test_cases=len(test_cases))
    return GenerateResponse(user_id=request.user_id, exercise=exercise)


GRADE_SYSTEM_PROMPT = """You are a Python exercise grader for LearnFlow.
Evaluate submitted code against test cases and provide constructive feedback.

You will receive:
- The exercise description
- The student's submitted code
- The expected test cases

For each test case, determine if the code would pass (analyze logically — don't actually execute).
Rate PEP8 compliance (0-100). Provide encouraging feedback.

ALWAYS respond with valid JSON:
{
  "test_results": [
    {"test_case": "<input>", "passed": true/false, "expected": "<expected>", "got": "<what code would produce>"}
  ],
  "pep8_score": <0-100>,
  "feedback": "<2-3 sentences of encouraging, constructive feedback>"
}"""


@router.post("/grade", response_model=GradeResponse)
async def grade_submission(request: GradeRequest) -> GradeResponse:
    log = logger.bind(user_id=request.user_id, exercise_id=request.exercise_id)
    log.info("grade_request", code_len=len(request.code))

    # Try to check PEP8 via pycodestyle
    pep8_score = 80
    try:
        import pycodestyle
        style_guide = pycodestyle.StyleGuide(quiet=True)
        buf = StringIO(request.code)
        result = style_guide.input_file("submission.py", lines=buf.readlines())
        errors = result.total_errors if hasattr(result, "total_errors") else 0
        pep8_score = max(0, 100 - errors * 5)
    except Exception:
        pass

    try:
        resp = await get_client().chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": GRADE_SYSTEM_PROMPT},
                {"role": "user", "content": (
                    f"Exercise topic: {request.topic or 'Python'}\n\n"
                    f"Submitted code:\n```python\n{request.code}\n```\n\n"
                    "Evaluate correctness and provide test results."
                )},
            ],
            temperature=0.1,
            max_tokens=800,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data: dict[str, Any] = json.loads(raw)
    except Exception as e:
        logger.error("grade_failed", error=str(e))
        raise LLMError(f"Grading failed: {e}")

    raw_results = data.get("test_results", [])
    test_results = [
        TestResult(
            test_case=r.get("test_case", ""),
            passed=bool(r.get("passed", False)),
            expected=r.get("expected", ""),
            got=r.get("got", ""),
        )
        for r in raw_results
    ]

    tests_passed = sum(1 for r in test_results if r.passed)
    tests_total = max(len(test_results), 1)
    correctness_score = int((tests_passed / tests_total) * 70)
    llm_pep8 = int(data.get("pep8_score", pep8_score))
    final_pep8 = (pep8_score + llm_pep8) // 2
    score = correctness_score + (final_pep8 * 30 // 100)
    passed = tests_passed == tests_total and score >= 60
    xp_earned = int(XP_MAP.get(Difficulty.MEDIUM, 100) * (score / 100)) if passed else score // 2

    # Persist submission
    pool = await get_pool()
    if pool:
        try:
            await pool.execute(
                "INSERT INTO submissions (user_id, exercise_id, code, score, passed, feedback) VALUES ($1, $2, $3, $4, $5, $6)",
                request.user_id, request.exercise_id, request.code, score, passed, data.get("feedback", ""),
            )
        except Exception as db_err:
            log.warning("db_write_failed", error=str(db_err))

    # Publish grading result event
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{settings.dapr_base_url}/v1.0/publish/{settings.pubsub_name}/code.submissions",
                json={
                    "user_id": request.user_id,
                    "exercise_id": request.exercise_id,
                    "score": score,
                    "passed": passed,
                    "xp_earned": xp_earned,
                    "topic": request.topic,
                },
            )
    except Exception:
        pass

    log.info("graded", score=score, passed=passed, tests_passed=tests_passed)
    return GradeResponse(
        user_id=request.user_id,
        exercise_id=request.exercise_id,
        score=score,
        passed=passed,
        tests_passed=tests_passed,
        tests_total=tests_total,
        test_results=test_results,
        feedback=data.get("feedback", "Good effort! Keep practicing."),
        pep8_score=final_pep8,
        xp_earned=xp_earned,
    )
