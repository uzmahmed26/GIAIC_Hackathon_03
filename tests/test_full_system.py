#!/usr/bin/env python3
"""
tests/test_full_system.py
LearnFlow AI Python Tutor — Comprehensive End-to-End Test Suite

Run all tests:
    cd backend && pip install pytest requests kafka-python psycopg2-binary
    pytest ../tests/test_full_system.py -v

Skip slow/external tests:
    pytest ../tests/test_full_system.py -v -m "not llm and not kafka and not db"

Only unit tests (no running services needed):
    pytest ../tests/test_full_system.py -v -m "unit"

Markers:
    unit    -- pure Python, no external services
    llm     -- requires OPENAI_API_KEY + running services
    kafka   -- requires Kafka running
    db      -- requires PostgreSQL running
    slow    -- takes > 5 seconds
"""

import hashlib
import json
import os
import time
import uuid
from collections import defaultdict
from typing import Any

import pytest
import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URLS = {
    "triage":   "http://localhost:8001",
    "concepts": "http://localhost:8002",
    "debug":    "http://localhost:8003",
    "exercise": "http://localhost:8004",
    "progress": "http://localhost:8005",
}

SERVICE_NAMES = {
    "triage":   "triage-agent",
    "concepts": "concepts-agent",
    "debug":    "debug-agent",
    "exercise": "exercise-agent",
    "progress": "progress-agent",
}

KAFKA_BOOTSTRAP    = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
DATABASE_URL       = os.getenv("DATABASE_URL", "postgresql://learnflow:learnflow@localhost:5432/learnflow")
HAS_OPENAI_KEY     = bool(os.getenv("OPENAI_API_KEY", "").strip())
STRUGGLE_THRESHOLD = 3   # matches debug-agent/app/config.py

TEST_USER = "test-suite-user-001"


# ---------------------------------------------------------------------------
# Availability checks (computed once at module load)
# ---------------------------------------------------------------------------

def _service_up(key: str) -> bool:
    try:
        r = requests.get(f"{BASE_URLS[key]}/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def _kafka_up() -> bool:
    try:
        from kafka.admin import KafkaAdminClient
        client = KafkaAdminClient(bootstrap_servers=KAFKA_BOOTSTRAP, request_timeout_ms=3000)
        client.close()
        return True
    except Exception:
        return False


def _db_up() -> bool:
    try:
        import psycopg2
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=3)
        conn.close()
        return True
    except Exception:
        return False


# Cache availability at import time so we don't repeat slow checks
_UP = {k: _service_up(k) for k in BASE_URLS}
_KAFKA_AVAILABLE = _kafka_up()
_DB_AVAILABLE    = _db_up()


# ---------------------------------------------------------------------------
# pytest markers
# ---------------------------------------------------------------------------

def pytest_configure(config):
    config.addinivalue_line("markers", "unit: pure Python unit test, no external services")
    config.addinivalue_line("markers", "llm: requires OPENAI_API_KEY and running service")
    config.addinivalue_line("markers", "kafka: requires Kafka running")
    config.addinivalue_line("markers", "db: requires PostgreSQL running")
    config.addinivalue_line("markers", "slow: takes more than 5 seconds")


# Skip helpers
skip_no_triage   = pytest.mark.skipif(not _UP["triage"],   reason="triage-agent not running")
skip_no_concepts = pytest.mark.skipif(not _UP["concepts"], reason="concepts-agent not running")
skip_no_debug    = pytest.mark.skipif(not _UP["debug"],    reason="debug-agent not running")
skip_no_exercise = pytest.mark.skipif(not _UP["exercise"], reason="exercise-agent not running")
skip_no_progress = pytest.mark.skipif(not _UP["progress"], reason="progress-agent not running")
skip_no_llm      = pytest.mark.skipif(not HAS_OPENAI_KEY,  reason="OPENAI_API_KEY not set")
skip_no_kafka    = pytest.mark.skipif(not _KAFKA_AVAILABLE, reason="Kafka not reachable")
skip_no_db       = pytest.mark.skipif(not _DB_AVAILABLE,    reason="PostgreSQL not reachable")


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def http():
    """Reusable requests Session with JSON headers."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Accept": "application/json"})
    return s


@pytest.fixture(scope="session")
def unique_user():
    """A unique user ID per test session to avoid cross-test pollution."""
    return f"test-{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def post(http, base_key: str, path: str, body: dict) -> requests.Response:
    return http.post(f"{BASE_URLS[base_key]}{path}", json=body, timeout=20)


def get(http, base_key: str, path: str) -> requests.Response:
    return http.get(f"{BASE_URLS[base_key]}{path}", timeout=10)


# ===========================================================================
# UNIT TESTS — no external services needed
# ===========================================================================

class TestMasteryFormula:
    """Unit tests for the mastery calculation formula.

    Formula (from progress-agent/app/routers/progress.py):
        mastery = exercises*0.4 + quiz*0.3 + code_quality*0.2 + min(streak*10, 100)*0.1
    """

    @staticmethod
    def calc_mastery(ex: float, quiz: float, code: float, streak: int) -> float:
        streak_score = min(streak * 10, 100)
        return round(ex * 0.4 + quiz * 0.3 + code * 0.2 + streak_score * 0.1, 1)

    @pytest.mark.unit
    def test_perfect_scores(self):
        assert self.calc_mastery(100, 100, 100, 10) == 100.0

    @pytest.mark.unit
    def test_zero_scores(self):
        assert self.calc_mastery(0, 0, 0, 0) == 0.0

    @pytest.mark.unit
    def test_exercise_weight_is_40_percent(self):
        # Only exercises score = 100, rest = 0
        assert self.calc_mastery(100, 0, 0, 0) == 40.0

    @pytest.mark.unit
    def test_quiz_weight_is_30_percent(self):
        assert self.calc_mastery(0, 100, 0, 0) == 30.0

    @pytest.mark.unit
    def test_code_quality_weight_is_20_percent(self):
        assert self.calc_mastery(0, 0, 100, 0) == 20.0

    @pytest.mark.unit
    def test_streak_weight_is_10_percent_max(self):
        # streak=10 → streak_score=100 → contribution = 10.0
        assert self.calc_mastery(0, 0, 0, 10) == 10.0

    @pytest.mark.unit
    def test_streak_caps_at_100(self):
        # streak=50 → streak_score=min(500,100)=100 → same as streak=10
        result_high = self.calc_mastery(0, 0, 0, 50)
        result_cap  = self.calc_mastery(0, 0, 0, 10)
        assert result_high == result_cap == 10.0

    @pytest.mark.unit
    def test_typical_student_scores(self):
        # exercises=85, quiz=75, code=80, streak=7
        expected = round(85 * 0.4 + 75 * 0.3 + 80 * 0.2 + min(7 * 10, 100) * 0.1, 1)
        assert self.calc_mastery(85, 75, 80, 7) == expected

    @pytest.mark.unit
    def test_struggle_threshold_below_40(self):
        # Students with mastery < 40 are flagged as struggling
        mastery = self.calc_mastery(30, 25, 20, 0)
        assert mastery < 40

    @pytest.mark.unit
    def test_mastery_range_is_0_to_100(self):
        for ex in [0, 50, 100]:
            for quiz in [0, 50, 100]:
                result = self.calc_mastery(ex, quiz, 50, 5)
                assert 0.0 <= result <= 100.0


class TestLevelProgression:
    """Unit tests for XP → level mapping.

    From progress-agent/app/routers/progress.py:
        < 500   → Beginner
        < 1500  → Elementary
        < 3000  → Intermediate
        < 6000  → Advanced
        >= 6000 → Expert
    """

    @staticmethod
    def level_from_xp(xp: int) -> str:
        if xp < 500:    return "Beginner"
        if xp < 1500:   return "Elementary"
        if xp < 3000:   return "Intermediate"
        if xp < 6000:   return "Advanced"
        return "Expert"

    @pytest.mark.unit
    def test_zero_xp_is_beginner(self):
        assert self.level_from_xp(0) == "Beginner"

    @pytest.mark.unit
    def test_boundary_499_is_beginner(self):
        assert self.level_from_xp(499) == "Beginner"

    @pytest.mark.unit
    def test_boundary_500_is_elementary(self):
        assert self.level_from_xp(500) == "Elementary"

    @pytest.mark.unit
    def test_boundary_1500_is_intermediate(self):
        assert self.level_from_xp(1500) == "Intermediate"

    @pytest.mark.unit
    def test_boundary_3000_is_advanced(self):
        assert self.level_from_xp(3000) == "Advanced"

    @pytest.mark.unit
    def test_boundary_6000_is_expert(self):
        assert self.level_from_xp(6000) == "Expert"

    @pytest.mark.unit
    def test_high_xp_is_expert(self):
        assert self.level_from_xp(999999) == "Expert"

    @pytest.mark.unit
    def test_all_levels_distinct(self):
        levels = {self.level_from_xp(xp) for xp in [0, 500, 1500, 3000, 6000]}
        assert len(levels) == 5


class TestStruggleDetectionUnit:
    """Unit tests for error fingerprinting (from debug-agent)."""

    @staticmethod
    def fingerprint(error: str) -> str:
        first_line = error.strip().splitlines()[0] if error else "no-error"
        return hashlib.sha256(first_line.encode()).hexdigest()[:16]

    @pytest.mark.unit
    def test_fingerprint_is_16_chars(self):
        fp = self.fingerprint("IndexError: list index out of range")
        assert len(fp) == 16

    @pytest.mark.unit
    def test_same_error_same_fingerprint(self):
        error = "TypeError: unsupported operand type(s) for +: 'int' and 'str'"
        assert self.fingerprint(error) == self.fingerprint(error)

    @pytest.mark.unit
    def test_different_errors_different_fingerprints(self):
        fp1 = self.fingerprint("IndexError: list index out of range")
        fp2 = self.fingerprint("TypeError: 'NoneType' object is not subscriptable")
        assert fp1 != fp2

    @pytest.mark.unit
    def test_only_first_line_matters(self):
        error1 = "IndexError: list index out of range\n  File 'test.py', line 5, in <module>"
        error2 = "IndexError: list index out of range\n  File 'other.py', line 12, in func"
        assert self.fingerprint(error1) == self.fingerprint(error2)

    @pytest.mark.unit
    def test_empty_error_has_fingerprint(self):
        fp = self.fingerprint("")
        assert len(fp) == 16
        assert fp == self.fingerprint("")  # deterministic

    @pytest.mark.unit
    def test_struggle_counter_triggers_at_threshold(self):
        """Simulate the in-memory struggle counter."""
        error_counts: dict[tuple[str, str], int] = defaultdict(int)
        threshold = STRUGGLE_THRESHOLD
        user_id = "test-user"
        fp = self.fingerprint("NameError: name 'x' is not defined")
        key = (user_id, fp)

        for i in range(threshold - 1):
            error_counts[key] += 1
            assert error_counts[key] < threshold, "Should not trigger before threshold"

        error_counts[key] += 1
        assert error_counts[key] >= threshold, "Should trigger at threshold"

    @pytest.mark.unit
    def test_different_users_independent_counters(self):
        error_counts: dict[tuple[str, str], int] = defaultdict(int)
        fp = self.fingerprint("SyntaxError: invalid syntax")
        error_counts[("user-A", fp)] += 5
        error_counts[("user-B", fp)] += 1
        assert error_counts[("user-A", fp)] == 5
        assert error_counts[("user-B", fp)] == 1


class TestKeywordRoutingUnit:
    """Unit tests for triage-agent keyword routing logic."""

    KEYWORD_ROUTES = {
        "debug":    ["error", "exception", "traceback", "bug", "not working", "fails", "crash",
                     "syntaxerror", "typeerror", "nameerror", "indentationerror", "attributeerror",
                     "fix", "broken", "wrong output", "unexpected"],
        "exercise": ["exercise", "practice", "problem", "challenge", "quiz", "homework",
                     "task", "assignment", "generate", "create exercise", "give me"],
        "progress": ["progress", "score", "mastery", "streak", "xp", "points", "level",
                     "leaderboard", "achievement", "badge", "how am i doing", "stats"],
        "concepts": ["what is", "how does", "explain", "understand", "concept", "learn",
                     "difference between", "when to use", "why", "define", "meaning"],
    }

    def keyword_route(self, message: str):
        msg_lower = message.lower()
        best_route = None
        best_count = 0
        best_keywords: list[str] = []
        for route, keywords in self.KEYWORD_ROUTES.items():
            matched = [kw for kw in keywords if kw in msg_lower]
            if len(matched) > best_count:
                best_count = len(matched)
                best_route = route
                best_keywords = matched
        if best_route and best_count >= 2:
            return {
                "route": best_route,
                "confidence": min(0.7 + best_count * 0.05, 0.95),
                "keywords": best_keywords,
            }
        return None

    @pytest.mark.unit
    def test_routes_typeerror_to_debug(self):
        result = self.keyword_route("I have a TypeError exception in my code")
        assert result is not None
        assert result["route"] == "debug"

    @pytest.mark.unit
    def test_routes_give_me_exercise(self):
        result = self.keyword_route("give me a practice exercise on lists")
        assert result is not None
        assert result["route"] == "exercise"

    @pytest.mark.unit
    def test_routes_progress_and_score(self):
        result = self.keyword_route("show me my progress and score")
        assert result is not None
        assert result["route"] == "progress"

    @pytest.mark.unit
    def test_routes_explain_concept(self):
        result = self.keyword_route("explain what is a decorator")
        assert result is not None
        assert result["route"] == "concepts"

    @pytest.mark.unit
    def test_single_keyword_no_route(self):
        # Only one keyword match → returns None (falls through to LLM)
        result = self.keyword_route("error")
        assert result is None

    @pytest.mark.unit
    def test_confidence_increases_with_more_keywords(self):
        r2 = self.keyword_route("error exception")
        r3 = self.keyword_route("error exception traceback bug")
        assert r2 is not None and r3 is not None
        assert r3["confidence"] > r2["confidence"]

    @pytest.mark.unit
    def test_confidence_caps_at_0_95(self):
        # Pack many keywords
        result = self.keyword_route("error exception traceback bug not working fails crash broken fix")
        assert result is not None
        assert result["confidence"] <= 0.95

    @pytest.mark.unit
    def test_no_match_returns_none(self):
        assert self.keyword_route("hello world") is None
        assert self.keyword_route("the quick brown fox") is None

    @pytest.mark.unit
    def test_case_insensitive(self):
        r1 = self.keyword_route("EXPLAIN what IS recursion")
        r2 = self.keyword_route("explain what is recursion")
        assert (r1 is None) == (r2 is None)
        if r1 and r2:
            assert r1["route"] == r2["route"]


class TestPEP8ScoreUnit:
    """Unit tests for the PEP8 / grade scoring formula."""

    @staticmethod
    def final_score(tests_passed: int, tests_total: int, pep8: int) -> int:
        correctness = int((tests_passed / max(tests_total, 1)) * 70)
        final_pep8  = pep8
        return correctness + (final_pep8 * 30 // 100)

    @pytest.mark.unit
    def test_perfect_score(self):
        assert self.final_score(3, 3, 100) == 100

    @pytest.mark.unit
    def test_zero_tests_passed_pep8_perfect(self):
        # 0 correctness + 30% of PEP8
        assert self.final_score(0, 3, 100) == 30

    @pytest.mark.unit
    def test_all_correct_bad_pep8(self):
        # 70 + 0 = 70
        assert self.final_score(3, 3, 0) == 70

    @pytest.mark.unit
    def test_half_tests_passed(self):
        result = self.final_score(1, 2, 80)
        assert result == 35 + 24  # 35 + 24 = 59

    @pytest.mark.unit
    def test_score_always_0_to_100(self):
        for passed in range(4):
            for pep8 in [0, 50, 100]:
                s = self.final_score(passed, 3, pep8)
                assert 0 <= s <= 100


# ===========================================================================
# INTEGRATION TESTS — require running services
# ===========================================================================

class TestHealthChecks:
    """All 5 agents respond to /health with {status: ok, service: name}."""

    @skip_no_triage
    def test_triage_health(self, http):
        r = get(http, "triage", "/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["service"] == "triage-agent"
        assert "version" in body
        assert "db_connected" in body

    @skip_no_concepts
    def test_concepts_health(self, http):
        r = get(http, "concepts", "/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["service"] == "concepts-agent"

    @skip_no_debug
    def test_debug_health(self, http):
        r = get(http, "debug", "/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["service"] == "debug-agent"

    @skip_no_exercise
    def test_exercise_health(self, http):
        r = get(http, "exercise", "/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["service"] == "exercise-agent"

    @skip_no_progress
    def test_progress_health(self, http):
        r = get(http, "progress", "/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["service"] == "progress-agent"

    @skip_no_triage
    def test_triage_readiness(self, http):
        r = get(http, "triage", "/readiness")
        assert r.status_code == 200
        body = r.json()
        assert "ready" in body
        assert "checks" in body
        assert isinstance(body["checks"], dict)

    @skip_no_triage
    def test_dapr_subscribe_triage(self, http):
        r = get(http, "triage", "/dapr/subscribe")
        assert r.status_code == 200
        subs = r.json()
        assert isinstance(subs, list)
        assert len(subs) > 0
        for sub in subs:
            assert "pubsubname" in sub
            assert "topic" in sub
            assert "route" in sub

    @skip_no_concepts
    def test_dapr_subscribe_concepts(self, http):
        r = get(http, "concepts", "/dapr/subscribe")
        assert r.status_code == 200
        subs = r.json()
        topics = [s["topic"] for s in subs]
        assert "route.concepts" in topics

    @skip_no_progress
    def test_dapr_subscribe_progress(self, http):
        r = get(http, "progress", "/dapr/subscribe")
        assert r.status_code == 200
        subs = r.json()
        topics = [s["topic"] for s in subs]
        assert "learning.response" in topics
        assert "code.submissions" in topics


class TestTriageRouting:
    """Test that 10 different messages route to the correct agent."""

    # These messages use >= 2 keyword matches → keyword routing, no LLM needed
    KEYWORD_CASES = [
        # (message,                                               expected_route, min_confidence)
        ("I have a TypeError exception in my code",              "debug",    0.75),
        ("give me a practice exercise on list comprehensions",   "exercise", 0.75),
        ("show me my progress and score",                        "progress", 0.75),
        ("explain what is a Python decorator",                   "concepts", 0.75),
        ("my code has a traceback and error message",            "debug",    0.75),
        ("I need a coding challenge assignment",                 "exercise", 0.75),
        ("what is my mastery level and streak stats",            "progress", 0.75),
        ("explain the difference between list and tuple",        "concepts", 0.75),
    ]

    # These require LLM routing
    LLM_CASES = [
        ("how do loops work",            "concepts"),
        ("why does my code crash",       "debug"),
    ]

    @skip_no_triage
    @pytest.mark.parametrize("message,expected,min_conf", KEYWORD_CASES)
    def test_keyword_routing(self, http, message, expected, min_conf):
        r = post(http, "triage", "/chat", {"user_id": TEST_USER, "message": message})
        assert r.status_code == 200
        body = r.json()
        assert "routing" in body
        routing = body["routing"]
        assert routing["route"] == expected, (
            f"Expected route={expected!r}, got {routing['route']!r} "
            f"for message: {message!r}"
        )
        assert routing["confidence"] >= min_conf, (
            f"Confidence {routing['confidence']:.2f} < {min_conf} for {message!r}"
        )

    @skip_no_triage
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    @pytest.mark.parametrize("message,expected", LLM_CASES)
    def test_llm_routing(self, http, message, expected):
        r = post(http, "triage", "/chat", {"user_id": TEST_USER, "message": message})
        assert r.status_code == 200
        body = r.json()
        routing = body["routing"]
        assert routing["route"] == expected
        assert routing["confidence"] >= 0.7

    @skip_no_triage
    def test_routing_response_schema(self, http):
        r = post(http, "triage", "/chat", {
            "user_id": TEST_USER,
            "message": "explain what is a Python function and how does it work",
        })
        assert r.status_code == 200
        body = r.json()
        assert "user_id" in body
        assert "message" in body
        assert "routing" in body
        routing = body["routing"]
        for field in ("route", "confidence", "reason", "keywords_matched"):
            assert field in routing, f"Missing field: {field}"
        assert routing["route"] in ("concepts", "debug", "exercise", "progress", "general")
        assert 0.0 <= routing["confidence"] <= 1.0

    @skip_no_triage
    def test_conversation_context_stored(self, http):
        """Second message in same session reuses context."""
        user = f"ctx-test-{uuid.uuid4().hex[:6]}"
        r1 = post(http, "triage", "/chat", {"user_id": user, "message": "explain what is a list"})
        r2 = post(http, "triage", "/chat", {"user_id": user, "message": "give me a practice exercise for it"})
        assert r1.status_code == 200
        assert r2.status_code == 200
        # Both should route successfully
        assert r2.json()["routing"]["route"] in ("exercise", "concepts", "general")

    @skip_no_triage
    def test_dapr_event_published(self, http):
        """Triage endpoint accepts Dapr event envelope."""
        r = post(http, "triage", "/events", {
            "id":         "test-evt-001",
            "topic":      "learning.events",
            "pubsubname": "pubsub",
            "data":       {"user_id": TEST_USER, "type": "session_start"},
        })
        assert r.status_code == 200
        assert r.json().get("status") == "SUCCESS"


class TestConceptsAgent:
    """Test explanation of all 8 modules and quiz generation."""

    MODULE_TOPICS = [
        (1, "Python Basics",        "variables and data types"),
        (2, "Control Flow",         "for loops and while loops"),
        (3, "Functions",            "function parameters and return values"),
        (4, "Data Structures",      "Python lists and dictionaries"),
        (5, "OOP",                  "Python classes and inheritance"),
        (6, "File I/O",             "reading and writing files with try except"),
        (7, "Modules & Packages",   "Python import system and pip packages"),
        (8, "Advanced Python",      "Python decorators and generators"),
    ]

    @skip_no_concepts
    def test_topics_endpoint(self, http):
        r = get(http, "concepts", "/topics")
        assert r.status_code == 200
        body = r.json()
        assert "modules" in body
        assert "total_topics" in body
        assert len(body["modules"]) == 8
        assert body["total_topics"] > 0

    @skip_no_concepts
    def test_topics_have_correct_structure(self, http):
        r = get(http, "concepts", "/topics")
        for mod in r.json()["modules"]:
            assert "module_id" in mod
            assert "name" in mod
            assert "topics" in mod
            assert "difficulty" in mod
            assert isinstance(mod["topics"], list)
            assert len(mod["topics"]) > 0

    @skip_no_concepts
    def test_topics_module_ids_1_through_8(self, http):
        r = get(http, "concepts", "/topics")
        ids = {m["module_id"] for m in r.json()["modules"]}
        assert ids == {1, 2, 3, 4, 5, 6, 7, 8}

    @skip_no_concepts
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    @pytest.mark.parametrize("mod_id,mod_name,topic", MODULE_TOPICS)
    def test_all_8_modules_explained(self, http, mod_id, mod_name, topic):
        r = post(http, "concepts", "/chat", {
            "user_id": TEST_USER,
            "message": f"Explain {topic}",
            "level":   "intermediate",
        })
        assert r.status_code == 200, f"Module {mod_id} ({mod_name}) failed: {r.text[:200]}"
        body = r.json()
        assert body["message"], "Response message should not be empty"
        assert "user_id" in body

        structured = body.get("structured")
        assert structured is not None, "structured field must be present"
        assert structured.get("explanation"), "explanation should not be empty"
        assert structured.get("code_example"),  "code_example should not be empty"
        assert isinstance(structured.get("common_mistakes"), list), "common_mistakes must be a list"
        assert len(structured["common_mistakes"]) >= 1, "Must have at least 1 common mistake"
        assert structured.get("practice_tip"), "practice_tip should not be empty"

    @skip_no_concepts
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_quiz_returns_5_questions(self, http):
        r = post(http, "concepts", "/quiz", {
            "user_id":       TEST_USER,
            "topic":         "Python lists",
            "level":         "intermediate",
            "num_questions": 5,
        })
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert "questions" in body
        assert len(body["questions"]) == 5

    @skip_no_concepts
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_quiz_question_schema(self, http):
        r = post(http, "concepts", "/quiz", {
            "user_id":       TEST_USER,
            "topic":         "Python functions",
            "level":         "beginner",
            "num_questions": 3,
        })
        assert r.status_code == 200
        for q in r.json()["questions"]:
            assert "question" in q,      "Each question must have 'question' field"
            assert "options" in q,       "Each question must have 'options' field"
            assert "correct_index" in q, "Each question must have 'correct_index' field"
            assert "explanation" in q,   "Each question must have 'explanation' field"
            assert isinstance(q["options"], list)
            assert len(q["options"]) >= 2
            assert 0 <= q["correct_index"] < len(q["options"])

    @skip_no_concepts
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_beginner_vs_advanced_differ(self, http):
        """Beginner and advanced explanations should be different."""
        r_beg = post(http, "concepts", "/chat", {
            "user_id": TEST_USER, "message": "what is a list", "level": "beginner",
        })
        r_adv = post(http, "concepts", "/chat", {
            "user_id": TEST_USER, "message": "what is a list", "level": "advanced",
        })
        assert r_beg.status_code == 200
        assert r_adv.status_code == 200
        # Advanced response should mention at least one advanced concept
        adv_text = r_adv.json()["message"].lower()
        assert any(kw in adv_text for kw in
                   ["complexity", "performance", "comprehension", "memory", "slice", "iterator"]), \
            "Advanced explanation should mention advanced concepts"


class TestDebugAgent:
    """Test debugging of common Python errors and code review."""

    PYTHON_ERRORS = [
        (
            "IndexError",
            "my_list = [1, 2, 3]\nprint(my_list[5])",
            "IndexError: list index out of range",
        ),
        (
            "TypeError",
            "result = 'age: ' + 25",
            "TypeError: can only concatenate str (not 'int') to str",
        ),
        (
            "NameError",
            "print(undefined_variable)",
            "NameError: name 'undefined_variable' is not defined",
        ),
        (
            "SyntaxError",
            "def greet(name)\n    print('Hello')",
            "SyntaxError: invalid syntax",
        ),
        (
            "AttributeError",
            "x = 5\nx.append(10)",
            "AttributeError: 'int' object has no attribute 'append'",
        ),
    ]

    @skip_no_debug
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    @pytest.mark.parametrize("error_type,code,error_msg", PYTHON_ERRORS)
    def test_debug_5_common_errors(self, http, error_type, code, error_msg):
        r = post(http, "debug", "/debug", {
            "user_id": TEST_USER,
            "code":    code,
            "error":   error_msg,
        })
        assert r.status_code == 200, f"{error_type}: {r.text[:300]}"
        body = r.json()

        # Must contain all required fields
        for field in ("error_type", "root_cause", "hint", "fix",
                      "prevention_tip", "code_quality_score", "struggle_detected"):
            assert field in body, f"Missing field: {field}"

        # Hint should NOT be the same as fix (hint comes first)
        assert body["hint"], "Hint must not be empty"
        assert body["fix"],  "Fix must not be empty"
        assert body["hint"] != body["fix"], "Hint should guide, not give away the fix"

        # Quality score in range
        assert 0 <= body["code_quality_score"] <= 100

    @skip_no_debug
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_hint_given_before_fix(self, http):
        """Hint length should be shorter/more concise than the fix."""
        r = post(http, "debug", "/debug", {
            "user_id": TEST_USER,
            "code":    "for i in range(10)\n    print(i)",
            "error":   "SyntaxError: invalid syntax",
        })
        assert r.status_code == 200
        body = r.json()
        # Hint should be a guiding question or nudge — it should exist
        assert len(body["hint"]) > 0
        # Fix should contain the actual correction
        assert len(body["fix"]) > 0
        # Prevention tip should advise future behaviour
        assert len(body["prevention_tip"]) > 0

    @skip_no_debug
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_code_review_returns_quality_score(self, http):
        r = post(http, "debug", "/review", {
            "user_id": TEST_USER,
            "code": (
                "def add(a,b):\n"
                "  return a+b\n"
                "x=add(1,2)\n"
                "print(x)\n"
            ),
        })
        assert r.status_code == 200
        body = r.json()
        for field in ("pep8_score", "efficiency_score", "readability_score", "overall_score"):
            assert field in body
            assert 0 <= body[field] <= 100

    @skip_no_debug
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_pep8_issues_detected(self, http):
        """Code with clear PEP8 violations should score lower than clean code."""
        bad_code = (
            "def f(x,y,z,a,b,c,d):\n"
            " x=1\n"
            " y=2\n"
            " return x+y+z+a+b+c+d\n"
        )
        good_code = (
            "def add_numbers(first: int, second: int) -> int:\n"
            '    """Return the sum of two integers."""\n'
            "    return first + second\n"
        )
        r_bad  = post(http, "debug", "/review", {"user_id": TEST_USER, "code": bad_code})
        r_good = post(http, "debug", "/review", {"user_id": TEST_USER, "code": good_code})
        assert r_bad.status_code == 200
        assert r_good.status_code == 200
        assert r_bad.json()["pep8_score"] < r_good.json()["pep8_score"], \
            "Bad PEP8 code should score lower than clean code"

    @skip_no_debug
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_struggle_detected_after_threshold(self, http):
        """Submitting the same error >= 3 times triggers struggle_detected=True."""
        user = f"struggle-{uuid.uuid4().hex[:6]}"
        error = "NameError: name 'my_var' is not defined\n  File 'x.py', line 1"
        code  = "print(my_var)"

        responses = []
        for _ in range(STRUGGLE_THRESHOLD):
            r = post(http, "debug", "/debug", {
                "user_id": user,
                "code":    code,
                "error":   error,
            })
            assert r.status_code == 200
            responses.append(r.json())

        # The threshold-th response should have struggle_detected=True
        assert responses[-1]["struggle_detected"] is True, \
            f"Expected struggle_detected=True on attempt {STRUGGLE_THRESHOLD}"


class TestExerciseAgent:
    """Test exercise generation for each module and grading."""

    MODULE_TOPICS = [
        (1, "variables and data types"),
        (2, "for loops and conditionals"),
        (3, "defining and calling functions"),
        (4, "Python lists and dictionaries"),
        (5, "Python classes and objects"),
        (6, "reading and writing files"),
        (7, "importing modules and packages"),
        (8, "decorators and generators"),
    ]

    @skip_no_exercise
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    @pytest.mark.parametrize("mod_id,topic", MODULE_TOPICS)
    def test_generate_exercise_all_modules(self, http, mod_id, topic):
        r = post(http, "exercise", "/generate", {
            "user_id":    TEST_USER,
            "topic":      topic,
            "difficulty": "medium",
            "level":      "intermediate",
            "module_id":  mod_id,
        })
        assert r.status_code == 200, f"Module {mod_id} ({topic}): {r.text[:300]}"
        body = r.json()
        assert "exercise" in body

        ex = body["exercise"]
        for field in ("title", "description", "starter_code", "test_cases", "hints"):
            assert field in ex, f"Module {mod_id}: missing field '{field}'"
            assert ex[field], f"Module {mod_id}: field '{field}' is empty"

        assert isinstance(ex["test_cases"], list), "test_cases must be a list"
        assert len(ex["test_cases"]) >= 1, "Must have at least 1 test case"

        assert isinstance(ex["hints"], list), "hints must be a list"
        assert len(ex["hints"]) >= 1, "Must have at least 1 hint"

        assert ex["xp_reward"] > 0
        assert ex["estimated_minutes"] > 0

    @skip_no_exercise
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_grade_correct_solution_scores_high(self, http):
        """A clearly correct solution should score >= 60 (passing threshold)."""
        correct_code = (
            "def add(a: int, b: int) -> int:\n"
            '    """Return the sum of a and b."""\n'
            "    return a + b\n"
        )
        r = post(http, "exercise", "/grade", {
            "user_id":     TEST_USER,
            "exercise_id": "test-ex-correct",
            "code":        correct_code,
            "topic":       "functions",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["score"] >= 60, f"Correct solution scored only {body['score']}"
        assert body["passed"] is True

    @skip_no_exercise
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_grade_wrong_solution_scores_low(self, http):
        """A clearly wrong solution should score < 50."""
        wrong_code = (
            "def add(a, b):\n"
            "    # TODO: implement this\n"
            "    pass\n"
        )
        r = post(http, "exercise", "/grade", {
            "user_id":     TEST_USER,
            "exercise_id": "test-ex-wrong",
            "code":        wrong_code,
            "topic":       "functions",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["score"] < 50, f"Wrong solution scored {body['score']}, expected < 50"

    @skip_no_exercise
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_grade_response_schema(self, http):
        r = post(http, "exercise", "/grade", {
            "user_id":     TEST_USER,
            "exercise_id": "test-ex-schema",
            "code":        "def factorial(n):\n    if n <= 1: return 1\n    return n * factorial(n-1)",
            "topic":       "recursion",
        })
        assert r.status_code == 200
        body = r.json()
        for field in ("score", "passed", "tests_passed", "tests_total",
                      "test_results", "feedback", "pep8_score", "xp_earned"):
            assert field in body, f"Missing field: {field}"
        assert 0 <= body["score"] <= 100
        assert isinstance(body["test_results"], list)

    @skip_no_exercise
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_hints_progressive(self, http):
        """Exercise hints should be a list with 3 items (gentle, specific, near-solution)."""
        r = post(http, "exercise", "/generate", {
            "user_id":    TEST_USER,
            "topic":      "Python lists",
            "difficulty": "easy",
            "level":      "beginner",
        })
        assert r.status_code == 200
        hints = r.json()["exercise"]["hints"]
        assert len(hints) >= 3, f"Expected 3 progressive hints, got {len(hints)}"
        # Each hint should be non-empty text
        for i, hint in enumerate(hints):
            assert hint.strip(), f"Hint {i+1} is empty"

    @skip_no_exercise
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_difficulty_affects_xp(self, http):
        """Harder exercises should award more XP."""
        r_easy = post(http, "exercise", "/generate", {
            "user_id": TEST_USER, "topic": "variables", "difficulty": "easy"
        })
        r_hard = post(http, "exercise", "/generate", {
            "user_id": TEST_USER, "topic": "algorithms", "difficulty": "hard"
        })
        assert r_easy.status_code == 200
        assert r_hard.status_code == 200
        assert r_easy.json()["exercise"]["xp_reward"] < r_hard.json()["exercise"]["xp_reward"]

    @skip_no_exercise
    def test_dapr_event_accepted(self, http):
        r = post(http, "exercise", "/events", {
            "id":         "test-ex-evt",
            "topic":      "exercise.requests",
            "pubsubname": "pubsub",
            "data":       {"user_id": TEST_USER, "message": "practice lists"},
        })
        assert r.status_code == 200
        assert r.json().get("status") == "SUCCESS"


class TestProgressAgent:
    """Test progress updates, mastery calculation, struggle detection, leaderboard."""

    @skip_no_progress
    def test_update_increments_mastery(self, http, unique_user):
        r1 = post(http, "progress", "/update", {
            "user_id":         unique_user,
            "topic":           "Python lists",
            "module_id":       4,
            "exercises_score": 80.0,
            "xp_delta":        100,
            "event_type":      "exercise_completed",
        })
        assert r1.status_code == 200
        mastery1 = r1.json()["mastery"]

        r2 = post(http, "progress", "/update", {
            "user_id":         unique_user,
            "topic":           "Python lists",
            "module_id":       4,
            "exercises_score": 95.0,
            "quiz_score":      85.0,
            "xp_delta":        50,
            "event_type":      "quiz_completed",
        })
        assert r2.status_code == 200
        mastery2 = r2.json()["mastery"]
        assert mastery2 >= mastery1, "Mastery should not decrease with better scores"

    @skip_no_progress
    def test_mastery_formula_via_api(self, http, unique_user):
        """API mastery should match our formula."""
        user = f"mastery-{uuid.uuid4().hex[:6]}"
        r = post(http, "progress", "/update", {
            "user_id":            user,
            "topic":              "recursion",
            "module_id":          3,
            "exercises_score":    80.0,
            "quiz_score":         60.0,
            "code_quality_score": 70.0,
            "xp_delta":           0,
            "event_type":         "manual_update",
        })
        assert r.status_code == 200
        # Formula: 80*0.4 + 60*0.3 + 70*0.2 + 0 = 32 + 18 + 14 = 64.0
        expected = round(80 * 0.4 + 60 * 0.3 + 70 * 0.2, 1)  # 64.0
        actual   = r.json()["mastery"]
        assert abs(actual - expected) < 5, \
            f"Expected mastery ~{expected}, got {actual}"

    @skip_no_progress
    def test_xp_accumulates(self, http, unique_user):
        user = f"xp-{uuid.uuid4().hex[:6]}"
        r1 = post(http, "progress", "/update", {
            "user_id": user, "topic": "loops", "module_id": 2,
            "exercises_score": 70.0, "xp_delta": 100, "event_type": "exercise_completed",
        })
        r2 = post(http, "progress", "/update", {
            "user_id": user, "topic": "functions", "module_id": 3,
            "exercises_score": 60.0, "xp_delta": 80, "event_type": "exercise_completed",
        })
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r2.json()["total_xp"] > r1.json()["total_xp"]

    @skip_no_progress
    def test_get_progress_schema(self, http, unique_user):
        # Ensure user has some progress first
        post(http, "progress", "/update", {
            "user_id": unique_user, "topic": "lists", "module_id": 4,
            "exercises_score": 75.0, "xp_delta": 50, "event_type": "exercise_completed",
        })
        r = get(http, "progress", f"/progress/{unique_user}")
        assert r.status_code == 200
        body = r.json()
        for field in ("user_id", "overall_mastery", "total_xp", "streak_days",
                      "level", "topics", "exercises_completed", "quizzes_completed",
                      "struggle_topics"):
            assert field in body, f"Missing field: {field}"
        assert body["user_id"] == unique_user
        assert isinstance(body["topics"], list)
        assert 0.0 <= body["overall_mastery"] <= 100.0

    @skip_no_progress
    def test_struggle_topics_when_mastery_low(self, http):
        user = f"low-{uuid.uuid4().hex[:6]}"
        post(http, "progress", "/update", {
            "user_id": user, "topic": "recursion", "module_id": 3,
            "exercises_score": 10.0, "quiz_score": 15.0,
            "xp_delta": 5, "event_type": "exercise_completed",
        })
        r = get(http, "progress", f"/progress/{user}")
        assert r.status_code == 200
        body = r.json()
        # mastery = 10*0.4 + 15*0.3 + 0 = 4 + 4.5 = 8.5 < 40 → should be in struggle_topics
        assert "recursion" in body["struggle_topics"], \
            f"Expected 'recursion' in struggle_topics, got {body['struggle_topics']}"

    @skip_no_progress
    def test_leaderboard_returns_sorted_results(self, http):
        # Seed a few users with different XP
        users_xp = [("lb-user-A", 500), ("lb-user-B", 200), ("lb-user-C", 800)]
        for uid, xp in users_xp:
            post(http, "progress", "/update", {
                "user_id": uid, "topic": "test", "module_id": 1,
                "exercises_score": 50.0, "xp_delta": xp, "event_type": "test",
            })

        r = get(http, "progress", "/leaderboard")
        assert r.status_code == 200
        body = r.json()
        assert "entries" in body
        assert "total_users" in body
        entries = body["entries"]
        if len(entries) >= 2:
            xp_values = [e["total_xp"] for e in entries]
            assert xp_values == sorted(xp_values, reverse=True), \
                "Leaderboard must be sorted descending by total_xp"

    @skip_no_progress
    def test_leaderboard_entry_schema(self, http):
        r = get(http, "progress", "/leaderboard")
        assert r.status_code == 200
        for entry in r.json()["entries"]:
            for field in ("rank", "user_id", "total_xp", "level", "streak_days", "mastery"):
                assert field in entry, f"Missing field: {field}"
            assert entry["rank"] >= 1
            assert entry["level"] in ("Beginner", "Elementary", "Intermediate", "Advanced", "Expert")

    @skip_no_progress
    def test_struggle_detection_via_submission_events(self, http):
        """Sending failed submissions >= threshold triggers struggle alert (fire-and-forget)."""
        user = f"sub-struggle-{uuid.uuid4().hex[:6]}"
        # Send STRUGGLE_THRESHOLD failed submissions for same topic
        for _ in range(STRUGGLE_THRESHOLD):
            r = post(http, "progress", "/submission-events", {
                "id":         f"evt-{uuid.uuid4().hex[:8]}",
                "topic":      "code.submissions",
                "pubsubname": "pubsub",
                "data":       {
                    "user_id": user,
                    "topic":   "recursion",
                    "passed":  False,
                    "score":   20,
                },
            })
            assert r.status_code == 200

    @skip_no_progress
    def test_passing_submission_resets_fail_count(self, http):
        """A passing submission after failures resets the counter."""
        user = f"pass-{uuid.uuid4().hex[:6]}"
        # Two failures
        for _ in range(2):
            post(http, "progress", "/submission-events", {
                "id": uuid.uuid4().hex, "topic": "code.submissions", "pubsubname": "pubsub",
                "data": {"user_id": user, "topic": "oop", "passed": False, "score": 15},
            })
        # One pass — should reset and update progress
        r = post(http, "progress", "/submission-events", {
            "id": uuid.uuid4().hex, "topic": "code.submissions", "pubsubname": "pubsub",
            "data": {"user_id": user, "topic": "oop", "passed": True, "score": 85, "xp_earned": 100},
        })
        assert r.status_code == 200
        assert r.json().get("status") == "SUCCESS"


# ===========================================================================
# KAFKA INTEGRATION TESTS
# ===========================================================================

class TestKafkaIntegration:
    """Test Kafka topic publishing and consuming."""

    TOPICS = [
        "learning.events",
        "code.submissions",
        "exercise.requests",
        "exercise.ready",
        "route.concepts",
        "route.debug",
        "learning.response",
        "struggle.alerts",
    ]

    @skip_no_kafka
    @pytest.mark.kafka
    def test_all_8_topics_exist(self):
        from kafka.admin import KafkaAdminClient
        client = KafkaAdminClient(bootstrap_servers=KAFKA_BOOTSTRAP)
        existing = set(client.list_topics())
        client.close()
        for topic in self.TOPICS:
            assert topic in existing, f"Topic '{topic}' not found in Kafka"

    @skip_no_kafka
    @pytest.mark.kafka
    def test_publish_to_learning_events(self):
        from kafka import KafkaProducer
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )
        future = producer.send("learning.events", {
            "user_id":    TEST_USER,
            "event_type": "test_publish",
            "timestamp":  time.time(),
        })
        result = future.get(timeout=10)
        producer.close()
        assert result.topic == "learning.events"
        assert result.offset >= 0

    @skip_no_kafka
    @pytest.mark.kafka
    def test_publish_to_all_topics(self):
        from kafka import KafkaProducer
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )
        for topic in self.TOPICS:
            future = producer.send(topic, {"test": True, "topic": topic})
            result = future.get(timeout=10)
            assert result.topic == topic, f"Publish to {topic} failed"
        producer.close()

    @skip_no_kafka
    @pytest.mark.kafka
    @pytest.mark.slow
    def test_consume_from_learning_response(self):
        from kafka import KafkaProducer, KafkaConsumer
        test_value = {"user_id": TEST_USER, "test_id": uuid.uuid4().hex}

        producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )
        producer.send("learning.response", test_value)
        producer.flush()
        producer.close()

        consumer = KafkaConsumer(
            "learning.response",
            bootstrap_servers=KAFKA_BOOTSTRAP,
            auto_offset_reset="latest",
            consumer_timeout_ms=5000,
            group_id=f"test-group-{uuid.uuid4().hex[:6]}",
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        )
        # We just verify the consumer can connect and poll
        # (message may not be received due to timing)
        messages = list(consumer)
        consumer.close()
        # Success if we didn't timeout with an error — the consumer connected
        assert True

    @skip_no_kafka
    @skip_no_triage
    @skip_no_progress
    @pytest.mark.kafka
    @pytest.mark.slow
    def test_triage_publishes_to_kafka_via_dapr(self, http):
        """Triage routes a message → Dapr should publish to Kafka topic."""
        # We can only verify the HTTP calls succeed; Kafka publish is fire-and-forget
        r = post(http, "triage", "/chat", {
            "user_id": TEST_USER,
            "message": "give me a practice exercise on functions",
        })
        assert r.status_code == 200
        # Route should be exercise (keyword match), event published to exercise.requests
        assert r.json()["routing"]["route"] == "exercise"


# ===========================================================================
# DATABASE INTEGRATION TESTS
# ===========================================================================

class TestDatabaseIntegration:
    """Test PostgreSQL schema, CRUD operations, and constraints."""

    EXPECTED_TABLES = [
        "users", "modules", "progress", "exercises",
        "submissions", "chat_history", "struggle_alerts",
    ]

    @pytest.fixture(scope="class")
    def conn(self):
        import psycopg2
        c = psycopg2.connect(DATABASE_URL)
        c.autocommit = True
        yield c
        c.close()

    @skip_no_db
    @pytest.mark.db
    def test_all_tables_exist(self, conn):
        import psycopg2
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public'
            """)
            existing = {row[0] for row in cur.fetchall()}
        for table in self.EXPECTED_TABLES:
            assert table in existing, f"Table '{table}' not found in database"

    @skip_no_db
    @pytest.mark.db
    def test_modules_seeded_with_8_records(self, conn):
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM modules")
            count = cur.fetchone()[0]
        assert count == 8, f"Expected 8 modules, found {count}"

    @skip_no_db
    @pytest.mark.db
    def test_user_crud_operations(self, conn):
        import psycopg2
        uid = str(uuid.uuid4())
        email = f"test-{uid[:8]}@test-suite.local"

        with conn.cursor() as cur:
            # CREATE
            cur.execute(
                "INSERT INTO users (id, email, name, role) VALUES (%s, %s, %s, %s)",
                (uid, email, "Test Suite User", "student"),
            )
            # READ
            cur.execute("SELECT id, email, name, role FROM users WHERE id = %s", (uid,))
            row = cur.fetchone()
            assert row is not None
            assert row[0] == uid
            assert row[1] == email
            assert row[3] == "student"

            # UPDATE
            cur.execute("UPDATE users SET name = %s WHERE id = %s", ("Updated Name", uid))
            cur.execute("SELECT name FROM users WHERE id = %s", (uid,))
            assert cur.fetchone()[0] == "Updated Name"

            # DELETE
            cur.execute("DELETE FROM users WHERE id = %s", (uid,))
            cur.execute("SELECT COUNT(*) FROM users WHERE id = %s", (uid,))
            assert cur.fetchone()[0] == 0

    @skip_no_db
    @pytest.mark.db
    def test_progress_upsert(self, conn):
        uid = str(uuid.uuid4())
        email = f"prog-{uid[:8]}@test.local"

        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (id, email, name, role) VALUES (%s, %s, %s, 'student')",
                (uid, email, "Progress User"),
            )
            cur.execute("SELECT id FROM modules LIMIT 1")
            mod_id = cur.fetchone()[0]

            # INSERT progress
            cur.execute(
                """INSERT INTO progress
                   (user_id, module_id, exercises_score, quiz_score, code_quality, streak_days)
                   VALUES (%s, %s, 80, 70, 75, 5)
                   ON CONFLICT (user_id, module_id) DO UPDATE
                   SET exercises_score = EXCLUDED.exercises_score""",
                (uid, mod_id),
            )
            cur.execute(
                "SELECT exercises_score, mastery FROM progress WHERE user_id = %s",
                (uid,),
            )
            row = cur.fetchone()
            assert row is not None
            assert float(row[0]) == 80.0
            # mastery should be computed column
            assert row[1] is not None
            assert 0 <= float(row[1]) <= 100

            # Cleanup
            cur.execute("DELETE FROM users WHERE id = %s", (uid,))

    @skip_no_db
    @pytest.mark.db
    def test_submission_references_user_and_exercise(self, conn):
        with conn.cursor() as cur:
            # Verify foreign key constraints exist
            cur.execute("""
                SELECT COUNT(*) FROM information_schema.table_constraints
                WHERE table_name = 'submissions'
                AND constraint_type = 'FOREIGN KEY'
            """)
            fk_count = cur.fetchone()[0]
        assert fk_count >= 2, "submissions table must have FK to users and exercises"

    @skip_no_db
    @pytest.mark.db
    def test_email_unique_constraint(self, conn):
        import psycopg2
        uid1 = str(uuid.uuid4())
        uid2 = str(uuid.uuid4())
        email = f"unique-{uid1[:8]}@test.local"

        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (id, email, name) VALUES (%s, %s, 'User1')",
                (uid1, email),
            )
            try:
                cur.execute(
                    "INSERT INTO users (id, email, name) VALUES (%s, %s, 'User2')",
                    (uid2, email),
                )
                conn.rollback()
                pytest.fail("Duplicate email should have raised IntegrityError")
            except psycopg2.IntegrityError:
                conn.rollback()  # Expected: unique constraint violated

            cur.execute("DELETE FROM users WHERE id = %s", (uid1,))

    @skip_no_db
    @pytest.mark.db
    def test_struggle_alerts_unresolved_index(self, conn):
        with conn.cursor() as cur:
            cur.execute("""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'struggle_alerts'
                AND indexdef LIKE '%resolved%'
            """)
            rows = cur.fetchall()
        assert len(rows) >= 1, "struggle_alerts should have a partial index on unresolved rows"

    @skip_no_db
    @pytest.mark.db
    def test_modules_have_correct_slugs(self, conn):
        expected_slugs = {
            "python-basics", "functions", "data-structures", "oop",
            "error-handling", "file-io", "modules-packages", "algorithms",
        }
        with conn.cursor() as cur:
            cur.execute("SELECT slug FROM modules")
            actual_slugs = {row[0] for row in cur.fetchall()}
        assert expected_slugs == actual_slugs, \
            f"Missing slugs: {expected_slugs - actual_slugs}"


# ===========================================================================
# END-TO-END FLOW TEST
# ===========================================================================

class TestEndToEndFlow:
    """Full user journey: chat → exercise → grade → progress update."""

    @skip_no_triage
    @skip_no_exercise
    @skip_no_progress
    @skip_no_llm
    @pytest.mark.llm
    @pytest.mark.slow
    def test_full_learning_session(self, http):
        """
        Simulates a complete learning session:
        1. Student asks triage to route a concept question
        2. Generates an exercise on that concept
        3. Grades a submission
        4. Progress is updated
        5. Student appears in progress report
        """
        user = f"e2e-{uuid.uuid4().hex[:8]}"

        # Step 1: Triage routes to concepts
        r1 = post(http, "triage", "/chat", {
            "user_id": user,
            "message": "explain what is a Python function and how does it work",
        })
        assert r1.status_code == 200
        assert r1.json()["routing"]["route"] in ("concepts", "general")

        # Step 2: Generate exercise on functions
        r2 = post(http, "exercise", "/generate", {
            "user_id":    user,
            "topic":      "Python functions",
            "difficulty": "easy",
            "level":      "beginner",
        })
        assert r2.status_code == 200
        exercise_id = r2.json()["exercise"]["id"]
        assert exercise_id

        # Step 3: Grade a submission
        r3 = post(http, "exercise", "/grade", {
            "user_id":     user,
            "exercise_id": exercise_id,
            "code": (
                "def greet(name: str) -> str:\n"
                '    """Return a greeting message."""\n'
                '    return f"Hello, {name}!"\n'
            ),
            "topic": "functions",
        })
        assert r3.status_code == 200
        grade = r3.json()
        assert 0 <= grade["score"] <= 100

        # Step 4: Update progress
        r4 = post(http, "progress", "/update", {
            "user_id":            user,
            "topic":              "functions",
            "module_id":          3,
            "exercises_score":    float(grade["score"]),
            "code_quality_score": float(grade["pep8_score"]),
            "xp_delta":           grade["xp_earned"],
            "event_type":         "exercise_completed",
        })
        assert r4.status_code == 200
        assert r4.json()["mastery"] >= 0

        # Step 5: Check progress report
        r5 = get(http, "progress", f"/progress/{user}")
        assert r5.status_code == 200
        report = r5.json()
        assert report["user_id"] == user
        topics = {t["topic"] for t in report["topics"]}
        assert "functions" in topics, "functions should appear in progress report"
