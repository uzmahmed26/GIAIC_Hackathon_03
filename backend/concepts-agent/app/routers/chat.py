import json
from typing import Any

import httpx
import structlog
from fastapi import APIRouter
from openai import AsyncOpenAI

from app.config import settings
from app.exceptions import LLMError
from app.models import (
    ChatRequest,
    ChatResponse,
    ConceptExplanation,
    Level,
    TopicInfo,
    TopicsResponse,
    QuizRequest,
    QuizQuestion,
    QuizResponse,
)

logger = structlog.get_logger()
router = APIRouter(tags=["chat"])

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


SYSTEM_PROMPT = """You are an expert Python teacher on the LearnFlow tutoring platform.
Your role is to explain Python concepts clearly, accurately, and at the student's level.

Guidelines:
- Always include a working code example
- Point out 2-3 common mistakes students make
- Adapt complexity to the student's level (beginner/intermediate/advanced)
- Be encouraging and supportive
- For beginners: use simple analogies and avoid jargon
- For advanced: include performance considerations and edge cases

ALWAYS respond with valid JSON in this exact format:
{
  "topic": "<topic name>",
  "explanation": "<clear explanation adapted to level>",
  "code_example": "<complete runnable Python code with comments>",
  "common_mistakes": ["<mistake1>", "<mistake2>", "<mistake3>"],
  "practice_tip": "<one actionable tip for practicing this concept>"
}"""

MODULES: list[TopicInfo] = [
    TopicInfo(module_id=1, name="Python Basics", topics=["variables", "data types", "operators", "input/output", "comments"], difficulty=Level.BEGINNER),
    TopicInfo(module_id=2, name="Control Flow", topics=["if/elif/else", "for loops", "while loops", "break/continue", "nested loops"], difficulty=Level.BEGINNER),
    TopicInfo(module_id=3, name="Functions", topics=["defining functions", "parameters", "return values", "scope", "lambda", "recursion"], difficulty=Level.BEGINNER),
    TopicInfo(module_id=4, name="Data Structures", topics=["lists", "tuples", "dictionaries", "sets", "list comprehensions"], difficulty=Level.INTERMEDIATE),
    TopicInfo(module_id=5, name="OOP", topics=["classes", "objects", "inheritance", "encapsulation", "polymorphism", "dunder methods"], difficulty=Level.INTERMEDIATE),
    TopicInfo(module_id=6, name="File I/O & Exceptions", topics=["reading files", "writing files", "try/except", "custom exceptions", "context managers"], difficulty=Level.INTERMEDIATE),
    TopicInfo(module_id=7, name="Modules & Packages", topics=["import", "pip", "virtual environments", "standard library", "popular packages"], difficulty=Level.INTERMEDIATE),
    TopicInfo(module_id=8, name="Advanced Python", topics=["decorators", "generators", "async/await", "type hints", "dataclasses", "metaclasses"], difficulty=Level.ADVANCED),
]


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    log = logger.bind(user_id=request.user_id, level=request.level)
    log.info("concept_request", message_len=len(request.message))

    try:
        resp = await get_client().chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Level: {request.level}\n\nQuestion: {request.message}"},
            ],
            temperature=0.4,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data: dict[str, Any] = json.loads(raw)

        structured = ConceptExplanation(
            topic=data.get("topic", "Python"),
            explanation=data.get("explanation", ""),
            code_example=data.get("code_example", ""),
            common_mistakes=data.get("common_mistakes", []),
            practice_tip=data.get("practice_tip", ""),
            level=request.level,
        )
        log.info("concept_response", topic=structured.topic)

        return ChatResponse(
            user_id=request.user_id,
            message=structured.explanation,
            structured=structured,
            session_id=request.session_id,
        )
    except LLMError:
        raise
    except Exception as e:
        logger.error("chat_failed", error=str(e))
        raise LLMError(f"Concept explanation failed: {e}")


@router.get("/topics", response_model=TopicsResponse)
async def get_topics() -> TopicsResponse:
    return TopicsResponse(
        modules=MODULES,
        total_topics=sum(len(m.topics) for m in MODULES),
    )


QUIZ_SYSTEM_PROMPT = """You are a Python quiz generator for LearnFlow.
Generate exactly {num_questions} multiple-choice quiz questions about the given topic at the given level.

ALWAYS respond with valid JSON:
{
  "questions": [
    {
      "question": "<question text>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correct_index": <0-3>,
      "explanation": "<why the correct answer is right>"
    }
  ]
}"""


@router.post("/quiz", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest) -> QuizResponse:
    log = logger.bind(user_id=request.user_id, topic=request.topic)
    log.info("quiz_request")

    try:
        resp = await get_client().chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": QUIZ_SYSTEM_PROMPT.format(num_questions=request.num_questions)},
                {"role": "user", "content": f"Topic: {request.topic}\nLevel: {request.level}\nQuestions: {request.num_questions}"},
            ],
            temperature=0.6,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or '{"questions": []}'
        data: dict[str, Any] = json.loads(raw)

        questions = [
            QuizQuestion(
                question=q["question"],
                options=q["options"],
                correct_index=q["correct_index"],
                explanation=q["explanation"],
            )
            for q in data.get("questions", [])
        ]

        log.info("quiz_generated", count=len(questions))

        # Publish quiz event
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                await client.post(
                    f"{settings.dapr_base_url}/v1.0/publish/{settings.pubsub_name}/quiz.generated",
                    json={"user_id": request.user_id, "topic": request.topic, "question_count": len(questions)},
                )
        except Exception:
            pass

        return QuizResponse(
            user_id=request.user_id,
            topic=request.topic,
            level=request.level,
            questions=questions,
        )
    except Exception as e:
        logger.error("quiz_failed", error=str(e))
        raise LLMError(f"Quiz generation failed: {e}")
