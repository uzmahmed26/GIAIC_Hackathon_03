import json
import hashlib
from collections import defaultdict
from typing import Any

import httpx
import structlog
from fastapi import APIRouter
from openai import AsyncOpenAI

from app.config import settings
from app.db import get_pool
from app.exceptions import LLMError
from app.models import (
    ChatRequest, ChatResponse,
    DebugRequest, DebugResponse,
    ReviewRequest, ReviewResponse,
)

logger = structlog.get_logger()
router = APIRouter(tags=["debug"])

_client: AsyncOpenAI | None = None
# In-memory error frequency tracker: (user_id, fingerprint) -> count
_error_counts: dict[tuple[str, str], int] = defaultdict(int)


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


def _fingerprint(error: str) -> str:
    """Stable hash of the first line of an error message."""
    first_line = error.strip().splitlines()[0] if error else "no-error"
    return hashlib.sha256(first_line.encode()).hexdigest()[:16]


DEBUG_SYSTEM_PROMPT = """You are an expert Python debugging assistant for LearnFlow.
Your philosophy: give hints before solutions. Help students learn, not just fix bugs.

Rules:
- First hint should guide thinking, not give away the answer
- Identify the exact error type and root cause
- Explain WHY the error happens, not just HOW to fix it
- Rate code quality honestly (0-100)
- If there's a better pattern entirely, mention it in prevention_tip

ALWAYS respond with valid JSON:
{
  "error_type": "<Python exception class or 'Logic Error' or 'Style Issue'>",
  "root_cause": "<one sentence: what exactly caused this>",
  "hint": "<Socratic hint — guide the student to find the fix>",
  "fix": "<the actual fix with explanation>",
  "prevention_tip": "<how to avoid this class of error in the future>",
  "code_quality_score": <0-100>,
  "fixed_code": "<complete corrected code>"
}"""


@router.post("/debug", response_model=DebugResponse)
async def debug_code(request: DebugRequest) -> DebugResponse:
    log = logger.bind(user_id=request.user_id)
    log.info("debug_request", has_error=bool(request.error))

    user_content = f"Code:\n```python\n{request.code}\n```"
    if request.error:
        user_content += f"\n\nError message:\n{request.error}"

    try:
        resp = await get_client().chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": DEBUG_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data: dict[str, Any] = json.loads(raw)
    except Exception as e:
        logger.error("debug_llm_failed", error=str(e))
        raise LLMError(f"Debug analysis failed: {e}")

    # Track error frequency for struggle detection
    struggle = False
    if request.error:
        fp = _fingerprint(request.error)
        key = (request.user_id, fp)
        _error_counts[key] += 1
        count = _error_counts[key]
        log.info("error_frequency", fingerprint=fp, count=count)

        if count >= settings.struggle_threshold:
            struggle = True
            log.warning("struggle_detected", user_id=request.user_id, error_type=data.get("error_type"), count=count)
            await _publish_struggle_alert(
                request.user_id,
                reason=f"Same error '{data.get('error_type')}' seen {count} times",
                severity="high" if count >= settings.struggle_threshold * 2 else "medium",
            )

        # Persist to DB if available
        pool = await get_pool()
        if pool:
            try:
                await pool.execute(
                    """INSERT INTO error_log (user_id, error_type, error_fingerprint, occurrence_count)
                       VALUES ($1, $2, $3, 1)
                       ON CONFLICT (user_id, error_fingerprint)
                       DO UPDATE SET occurrence_count = error_log.occurrence_count + 1, last_seen = NOW()""",
                    request.user_id, data.get("error_type", "Unknown"), fp,
                )
            except Exception as db_err:
                log.warning("db_write_failed", error=str(db_err))

    return DebugResponse(
        user_id=request.user_id,
        error_type=data.get("error_type", "Unknown"),
        root_cause=data.get("root_cause", ""),
        hint=data.get("hint", ""),
        fix=data.get("fix", ""),
        prevention_tip=data.get("prevention_tip", ""),
        code_quality_score=int(data.get("code_quality_score", 50)),
        fixed_code=data.get("fixed_code"),
        struggle_detected=struggle,
    )


REVIEW_SYSTEM_PROMPT = """You are a Python code reviewer for LearnFlow. Review code for:
1. PEP 8 compliance (naming, spacing, line length, imports)
2. Efficiency (algorithmic complexity, unnecessary operations, Pythonic patterns)
3. Readability (clear names, comments where needed, logical structure)

ALWAYS respond with valid JSON:
{
  "pep8_score": <0-100>,
  "efficiency_score": <0-100>,
  "readability_score": <0-100>,
  "overall_score": <0-100>,
  "issues": ["<issue1>", "<issue2>", "<issue3>"],
  "suggestions": ["<suggestion1>", "<suggestion2>"],
  "improved_code": "<rewritten code applying all suggestions>"
}"""


@router.post("/review", response_model=ReviewResponse)
async def review_code(request: ReviewRequest) -> ReviewResponse:
    log = logger.bind(user_id=request.user_id)
    log.info("review_request", code_len=len(request.code))

    user_content = f"Code to review:\n```python\n{request.code}\n```"
    if request.context:
        user_content = f"Context: {request.context}\n\n" + user_content

    try:
        resp = await get_client().chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": REVIEW_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data: dict[str, Any] = json.loads(raw)
        log.info("review_complete", overall=data.get("overall_score"))

        return ReviewResponse(
            user_id=request.user_id,
            pep8_score=int(data.get("pep8_score", 50)),
            efficiency_score=int(data.get("efficiency_score", 50)),
            readability_score=int(data.get("readability_score", 50)),
            overall_score=int(data.get("overall_score", 50)),
            issues=data.get("issues", []),
            suggestions=data.get("suggestions", []),
            improved_code=data.get("improved_code"),
        )
    except Exception as e:
        logger.error("review_failed", error=str(e))
        raise LLMError(f"Code review failed: {e}")


CHAT_SYSTEM_PROMPT = """You are a patient Python debugging mentor on LearnFlow.
Help students think through problems themselves. Use the Socratic method.
If they show code, analyze it. If they describe a problem, ask clarifying questions.
Be encouraging — debugging is a skill, not a failure."""


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    log = logger.bind(user_id=request.user_id)
    log.info("debug_chat_request")

    messages: list[dict[str, str]] = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    if request.code_context:
        messages.append({"role": "user", "content": f"Here's my code:\n```python\n{request.code_context}\n```"})
    messages.append({"role": "user", "content": request.message})

    try:
        resp = await get_client().chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            temperature=0.5,
            max_tokens=600,
        )
        reply = resp.choices[0].message.content or "I couldn't process that. Could you share your code?"
        return ChatResponse(user_id=request.user_id, message=reply, session_id=request.session_id)
    except Exception as e:
        logger.error("debug_chat_failed", error=str(e))
        raise LLMError(f"Chat failed: {e}")


async def _publish_struggle_alert(user_id: str, reason: str, severity: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{settings.dapr_base_url}/v1.0/publish/{settings.pubsub_name}/struggle.alerts",
                json={"user_id": user_id, "reason": reason, "severity": severity, "source": "debug-agent"},
            )
        logger.info("struggle_alert_published", user_id=user_id, severity=severity)
    except Exception as e:
        logger.warning("struggle_alert_publish_failed", error=str(e))
