import json
from collections import defaultdict, deque
from typing import Any

import httpx
import structlog
from fastapi import APIRouter
from openai import AsyncOpenAI

from app.config import settings
from app.exceptions import LLMError
from app.models import (
    AgentRoute,
    ChatRequest,
    ChatResponse,
    ChatMessage,
    RoutingDecision,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/chat", tags=["chat"])

# In-memory conversation context: user_id → deque of last 5 messages
_conversations: dict[str, deque[ChatMessage]] = defaultdict(lambda: deque(maxlen=5))

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


SYSTEM_PROMPT = """You are a smart routing agent for LearnFlow, an AI Python tutoring platform.
Analyze the student's message and route it to the correct specialist agent.

Routes available:
- concepts: Python concept explanations, theory, how-things-work questions
- debug: errors, bugs, code not working, exceptions, tracebacks
- exercise: practice problems, exercises, coding challenges, homework
- progress: scores, progress, mastery, streaks, leaderboard, achievements
- general: greetings, off-topic, unclear queries

Respond with ONLY valid JSON in this exact format:
{
  "route": "<route>",
  "confidence": <0.0-1.0>,
  "reason": "<one sentence explaining why>",
  "keywords_matched": ["<word1>", "<word2>"]
}"""

KEYWORD_ROUTES: dict[str, tuple[AgentRoute, list[str]]] = {
    AgentRoute.DEBUG: ["error", "exception", "traceback", "bug", "not working", "fails", "crash",
                       "syntaxerror", "typeerror", "nameerror", "indentationerror", "attributeerror",
                       "fix", "broken", "wrong output", "unexpected"],
    AgentRoute.EXERCISE: ["exercise", "practice", "problem", "challenge", "quiz", "homework",
                          "task", "assignment", "generate", "create exercise", "give me"],
    AgentRoute.PROGRESS: ["progress", "score", "mastery", "streak", "xp", "points", "level",
                          "leaderboard", "achievement", "badge", "how am i doing", "stats"],
    AgentRoute.CONCEPTS: ["what is", "how does", "explain", "understand", "concept", "learn",
                          "difference between", "when to use", "why", "define", "meaning"],
}


def keyword_route(message: str) -> RoutingDecision | None:
    msg_lower = message.lower()
    best_route = None
    best_count = 0
    best_keywords: list[str] = []

    for route, keywords in KEYWORD_ROUTES.items():
        matched = [kw for kw in keywords if kw in msg_lower]
        if len(matched) > best_count:
            best_count = len(matched)
            best_route = route
            best_keywords = matched

    if best_route and best_count >= 2:
        return RoutingDecision(
            route=best_route,
            confidence=min(0.7 + best_count * 0.05, 0.95),
            reason=f"Keyword match: {', '.join(best_keywords[:3])}",
            keywords_matched=best_keywords[:5],
        )
    return None


async def llm_route(message: str, context: list[ChatMessage]) -> RoutingDecision:
    ctx_text = "\n".join(f"{m.role}: {m.content}" for m in context[-3:])
    user_content = f"Previous context:\n{ctx_text}\n\nNew message: {message}" if ctx_text else message

    try:
        resp = await get_client().chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.1,
            max_tokens=200,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data: dict[str, Any] = json.loads(raw)
        return RoutingDecision(
            route=AgentRoute(data.get("route", "general")),
            confidence=float(data.get("confidence", 0.5)),
            reason=data.get("reason", "LLM routing"),
            keywords_matched=data.get("keywords_matched", []),
        )
    except Exception as e:
        logger.error("llm_route_failed", error=str(e))
        raise LLMError(f"Routing failed: {e}")


async def publish_routed_event(routing: RoutingDecision, request: ChatRequest) -> None:
    topic_map = {
        AgentRoute.CONCEPTS: "route.concepts",
        AgentRoute.DEBUG: "route.debug",
        AgentRoute.EXERCISE: "exercise.requests",
        AgentRoute.PROGRESS: "progress.requests",
    }
    topic = topic_map.get(routing.route)
    if not topic:
        return

    payload = {
        "user_id": request.user_id,
        "message": request.message,
        "session_id": request.session_id,
        "confidence": routing.confidence,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.dapr_base_url}/v1.0/publish/{settings.pubsub_name}/{topic}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        logger.info("event_published", topic=topic, user_id=request.user_id)
    except Exception as e:
        logger.warning("publish_failed", topic=topic, error=str(e))


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    log = logger.bind(user_id=request.user_id)
    log.info("chat_request", message_len=len(request.message))

    context = list(_conversations[request.user_id])

    # Try fast keyword routing first; fall back to LLM
    routing = keyword_route(request.message)
    if routing is None or routing.confidence < 0.7:
        routing = await llm_route(request.message, context)

    # Store message in conversation context
    _conversations[request.user_id].append(ChatMessage(role="user", content=request.message))

    log.info("routed", route=routing.route, confidence=routing.confidence)

    # Publish to appropriate topic (fire-and-forget)
    await publish_routed_event(routing, request)

    reply = (
        f"I've routed your message to the {routing.route.value} agent "
        f"(confidence: {routing.confidence:.0%}). {routing.reason}"
    )
    _conversations[request.user_id].append(ChatMessage(role="assistant", content=reply))

    return ChatResponse(
        user_id=request.user_id,
        message=reply,
        routing=routing,
        session_id=request.session_id,
    )
