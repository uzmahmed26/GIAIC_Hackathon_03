#!/usr/bin/env python3
"""
LearnFlow Backend — Integration Test Suite
Tests all 5 microservices health + key endpoints.

Usage:
    python test_all_services.py
    python test_all_services.py --timeout 30
"""

import sys
import json
import argparse
import urllib.request
import urllib.error
from typing import Any

BASE_URLS = {
    "triage-agent":   "http://localhost:8001",
    "concepts-agent": "http://localhost:8002",
    "debug-agent":    "http://localhost:8003",
    "exercise-agent": "http://localhost:8004",
    "progress-agent": "http://localhost:8005",
}

GREEN = "\033[92m"
RED   = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD  = "\033[1m"

passed = 0
failed = 0
skipped = 0


def _request(method: str, url: str, body: dict | None = None, timeout: int = 15) -> tuple[int, dict]:
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {"error": str(e)}
    except Exception as e:
        return 0, {"error": str(e)}


def check(name: str, method: str, url: str, body: dict | None = None,
          expect_status: int = 200, expect_keys: list[str] | None = None,
          timeout: int = 15) -> bool:
    global passed, failed
    status, resp = _request(method, url, body, timeout)

    ok = status == expect_status
    key_ok = True
    if ok and expect_keys:
        key_ok = all(k in resp for k in expect_keys)
        ok = ok and key_ok

    icon = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"
    status_str = f"{GREEN}{status}{RESET}" if status == expect_status else f"{RED}{status}{RESET}"
    print(f"  {icon} [{status_str}] {name}")

    if not ok:
        if status == 0:
            print(f"        {YELLOW}--> Connection refused / timeout{RESET}")
        elif expect_keys and not key_ok:
            missing = [k for k in (expect_keys or []) if k not in resp]
            print(f"        {YELLOW}--> Missing keys: {missing}{RESET}")
        else:
            err = resp.get("error") or resp.get("detail") or str(resp)[:120]
            print(f"        {YELLOW}--> {err}{RESET}")
        failed += 1
    else:
        passed += 1
    return ok


def section(title: str) -> None:
    print(f"\n{BOLD}{'-'*50}{RESET}")
    print(f"{BOLD}  {title}{RESET}")
    print(f"{BOLD}{'-'*50}{RESET}")


def main(timeout: int) -> None:
    global passed, failed

    print(f"\n{BOLD}LearnFlow Backend — Integration Tests{RESET}")
    print(f"Timeout per request: {timeout}s\n")

    # ── SERVICE 1: triage-agent ───────────────────────────────────────────────
    section("1. triage-agent (port 8001)")
    base = BASE_URLS["triage-agent"]

    if not check("GET /health", "GET", f"{base}/health",
                 expect_keys=["status", "service"], timeout=timeout):
        print(f"  {YELLOW}↳ Service down — skipping remaining triage tests{RESET}")
    else:
        check("GET /readiness", "GET", f"{base}/readiness",
              expect_keys=["ready", "checks"], timeout=timeout)
        check("GET /dapr/subscribe", "GET", f"{base}/dapr/subscribe",
              timeout=timeout)
        check("POST /chat — keyword routing", "POST", f"{base}/chat",
              body={"user_id": "test-001", "message": "I have a TypeError in my code"},
              expect_status=200, expect_keys=["routing", "user_id"], timeout=timeout)
        check("POST /chat — concept routing", "POST", f"{base}/chat",
              body={"user_id": "test-001", "message": "What is a Python decorator and how does it work?"},
              expect_status=200, expect_keys=["routing"], timeout=timeout)
        check("POST /chat — exercise routing", "POST", f"{base}/chat",
              body={"user_id": "test-001", "message": "Give me a practice exercise on list comprehensions"},
              expect_status=200, expect_keys=["routing"], timeout=timeout)
        check("POST /events (Dapr)", "POST", f"{base}/events",
              body={"id": "evt-001", "topic": "learning.events", "pubsubname": "pubsub", "data": {"user_id": "test-001", "type": "chat"}},
              expect_status=200, timeout=timeout)

    # ── SERVICE 2: concepts-agent ─────────────────────────────────────────────
    section("2. concepts-agent (port 8002)")
    base = BASE_URLS["concepts-agent"]

    if not check("GET /health", "GET", f"{base}/health",
                 expect_keys=["status", "service"], timeout=timeout):
        print(f"  {YELLOW}↳ Service down — skipping remaining concepts tests{RESET}")
    else:
        check("GET /readiness", "GET", f"{base}/readiness", timeout=timeout)
        check("GET /dapr/subscribe", "GET", f"{base}/dapr/subscribe", timeout=timeout)
        check("GET /topics", "GET", f"{base}/topics",
              expect_keys=["modules", "total_topics"], timeout=timeout)
        check("POST /chat (beginner)", "POST", f"{base}/chat",
              body={"user_id": "test-001", "message": "What is a Python list?", "level": "beginner"},
              expect_status=200, expect_keys=["user_id", "message"], timeout=timeout)
        check("POST /chat (advanced)", "POST", f"{base}/chat",
              body={"user_id": "test-001", "message": "Explain Python metaclasses", "level": "advanced"},
              expect_status=200, expect_keys=["structured"], timeout=timeout)
        check("POST /quiz", "POST", f"{base}/quiz",
              body={"user_id": "test-001", "topic": "Python lists", "level": "intermediate", "num_questions": 3},
              expect_status=200, expect_keys=["questions", "topic"], timeout=timeout)
        check("POST /events (Dapr)", "POST", f"{base}/events",
              body={"id": "evt-002", "topic": "route.concepts", "pubsubname": "pubsub", "data": {"user_id": "test-001", "message": "explain loops"}},
              expect_status=200, timeout=timeout)

    # ── SERVICE 3: debug-agent ────────────────────────────────────────────────
    section("3. debug-agent (port 8003)")
    base = BASE_URLS["debug-agent"]

    if not check("GET /health", "GET", f"{base}/health",
                 expect_keys=["status", "service"], timeout=timeout):
        print(f"  {YELLOW}↳ Service down — skipping remaining debug tests{RESET}")
    else:
        check("GET /readiness", "GET", f"{base}/readiness", timeout=timeout)
        check("GET /dapr/subscribe", "GET", f"{base}/dapr/subscribe", timeout=timeout)
        check("POST /debug (with error)", "POST", f"{base}/debug",
              body={
                  "user_id": "test-001",
                  "code": "def greet(name)\n    print('Hello ' + name)",
                  "error": "SyntaxError: invalid syntax",
              },
              expect_status=200,
              expect_keys=["error_type", "root_cause", "hint", "fix", "code_quality_score"],
              timeout=timeout)
        check("POST /debug (no error — review only)", "POST", f"{base}/debug",
              body={"user_id": "test-001", "code": "x=1\ny=2\nprint(x+y)"},
              expect_status=200, expect_keys=["code_quality_score"], timeout=timeout)
        check("POST /review", "POST", f"{base}/review",
              body={"user_id": "test-001", "code": "def add(a,b):\n  return a+b\nresult=add(1,2)\nprint(result)"},
              expect_status=200,
              expect_keys=["pep8_score", "efficiency_score", "readability_score", "overall_score"],
              timeout=timeout)
        check("POST /chat", "POST", f"{base}/chat",
              body={"user_id": "test-001", "message": "My for loop isn't iterating correctly"},
              expect_status=200, expect_keys=["message"], timeout=timeout)
        check("POST /events (Dapr)", "POST", f"{base}/events",
              body={"id": "evt-003", "topic": "route.debug", "pubsubname": "pubsub", "data": {"user_id": "test-001", "message": "fix my error"}},
              expect_status=200, timeout=timeout)

    # ── SERVICE 4: exercise-agent ─────────────────────────────────────────────
    section("4. exercise-agent (port 8004)")
    base = BASE_URLS["exercise-agent"]

    if not check("GET /health", "GET", f"{base}/health",
                 expect_keys=["status", "service"], timeout=timeout):
        print(f"  {YELLOW}↳ Service down — skipping remaining exercise tests{RESET}")
    else:
        check("GET /readiness", "GET", f"{base}/readiness", timeout=timeout)
        check("GET /dapr/subscribe", "GET", f"{base}/dapr/subscribe", timeout=timeout)
        check("POST /generate (easy)", "POST", f"{base}/generate",
              body={"user_id": "test-001", "topic": "Python lists", "difficulty": "easy", "level": "beginner"},
              expect_status=200,
              expect_keys=["exercise", "user_id"],
              timeout=timeout)
        check("POST /generate (hard)", "POST", f"{base}/generate",
              body={"user_id": "test-001", "topic": "recursion", "difficulty": "hard", "level": "advanced"},
              expect_status=200, expect_keys=["exercise"], timeout=timeout)
        check("POST /grade (passing)", "POST", f"{base}/grade",
              body={
                  "user_id": "test-001",
                  "exercise_id": "ex-001",
                  "code": "def add(a, b):\n    \"\"\"Add two numbers.\"\"\"\n    return a + b\n",
                  "topic": "functions",
              },
              expect_status=200,
              expect_keys=["score", "passed", "feedback", "pep8_score"],
              timeout=timeout)
        check("POST /events (Dapr)", "POST", f"{base}/events",
              body={"id": "evt-004", "topic": "exercise.requests", "pubsubname": "pubsub", "data": {"user_id": "test-001", "message": "lists"}},
              expect_status=200, timeout=timeout)

    # ── SERVICE 5: progress-agent ─────────────────────────────────────────────
    section("5. progress-agent (port 8005)")
    base = BASE_URLS["progress-agent"]

    if not check("GET /health", "GET", f"{base}/health",
                 expect_keys=["status", "service"], timeout=timeout):
        print(f"  {YELLOW}↳ Service down — skipping remaining progress tests{RESET}")
    else:
        check("GET /readiness", "GET", f"{base}/readiness", timeout=timeout)
        check("GET /dapr/subscribe", "GET", f"{base}/dapr/subscribe", timeout=timeout)
        check("POST /update (exercises)", "POST", f"{base}/update",
              body={"user_id": "test-001", "topic": "Python lists", "module_id": 4,
                    "exercises_score": 85.0, "xp_delta": 100, "event_type": "exercise_completed"},
              expect_status=200, expect_keys=["mastery", "total_xp"], timeout=timeout)
        check("POST /update (quiz)", "POST", f"{base}/update",
              body={"user_id": "test-001", "topic": "Python lists", "module_id": 4,
                    "quiz_score": 75.0, "code_quality_score": 80.0, "xp_delta": 75},
              expect_status=200, expect_keys=["mastery"], timeout=timeout)
        check("GET /progress/{user_id}", "GET", f"{base}/progress/test-001",
              expect_keys=["user_id", "overall_mastery", "total_xp", "level", "topics"],
              timeout=timeout)
        check("GET /leaderboard", "GET", f"{base}/leaderboard",
              expect_keys=["entries", "total_users"], timeout=timeout)
        check("POST /events (learning.response)", "POST", f"{base}/events",
              body={"id": "evt-005", "topic": "learning.response", "pubsubname": "pubsub",
                    "data": {"user_id": "test-001", "topic": "lists", "event_type": "quiz_completed", "score": 88}},
              expect_status=200, timeout=timeout)
        check("POST /submission-events (passed)", "POST", f"{base}/submission-events",
              body={"id": "evt-006", "topic": "code.submissions", "pubsubname": "pubsub",
                    "data": {"user_id": "test-001", "topic": "functions", "passed": True, "score": 90, "xp_earned": 100}},
              expect_status=200, timeout=timeout)
        check("POST /submission-events (failed)", "POST", f"{base}/submission-events",
              body={"id": "evt-007", "topic": "code.submissions", "pubsubname": "pubsub",
                    "data": {"user_id": "test-001", "topic": "recursion", "passed": False, "score": 30}},
              expect_status=200, timeout=timeout)

    # ── Summary ───────────────────────────────────────────────────────────────
    total = passed + failed
    print(f"\n{'-'*50}")
    print(f"{BOLD}Results: {GREEN}{passed} passed{RESET}{BOLD} / {RED}{failed} failed{RESET}{BOLD} / {total} total{RESET}")
    if failed == 0:
        print(f"{GREEN}{BOLD}All tests passed!{RESET}")
    elif passed == 0:
        print(f"{RED}{BOLD}All services appear to be down. Start them first.{RESET}")
        print(f"\n  Quick start:")
        print(f"    cd backend/<service-name> && uvicorn app.main:app --port 800X --reload")
        print(f"\n  Or use docker-compose:")
        print(f"    cd backend && docker-compose up")
    else:
        print(f"{YELLOW}[!] Some tests failed. Check service logs.{RESET}")
    print()

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LearnFlow backend integration tests")
    parser.add_argument("--timeout", type=int, default=15, help="Request timeout in seconds (default: 15)")
    args = parser.parse_args()
    main(args.timeout)
