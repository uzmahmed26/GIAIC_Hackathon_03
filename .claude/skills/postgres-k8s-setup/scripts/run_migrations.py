#!/usr/bin/env python3
"""
run_migrations.py -- Run LearnFlow DB migrations via kubectl exec.
Usage: python run_migrations.py [--namespace postgres] [--cluster learnflow-postgres]
"""
import subprocess
import sys
import argparse

GREEN = "\033[92m"
RED   = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

# All DDL statements in dependency order
MIGRATIONS = [
    {
        "name": "create_users",
        "sql": """
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'student',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
""",
    },
    {
        "name": "create_modules",
        "sql": """
CREATE TABLE IF NOT EXISTS modules (
    id          SERIAL PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    order_idx   INT NOT NULL DEFAULT 0
);
""",
    },
    {
        "name": "create_progress",
        "sql": """
CREATE TABLE IF NOT EXISTS progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id       INT  NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    exercises_score FLOAT NOT NULL DEFAULT 0,
    quiz_score      FLOAT NOT NULL DEFAULT 0,
    code_quality    FLOAT NOT NULL DEFAULT 0,
    streak_days     INT   NOT NULL DEFAULT 0,
    mastery         FLOAT GENERATED ALWAYS AS (
                        exercises_score*0.4 + quiz_score*0.3 +
                        code_quality*0.2 + LEAST(streak_days*10, 100)*0.1
                    ) STORED,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
""",
    },
    {
        "name": "create_exercises",
        "sql": """
CREATE TABLE IF NOT EXISTS exercises (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id   INT  NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty  TEXT NOT NULL DEFAULT 'medium',
    test_cases  JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exercises_module ON exercises(module_id);
""",
    },
    {
        "name": "create_submissions",
        "sql": """
CREATE TABLE IF NOT EXISTS submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id     UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    score           FLOAT NOT NULL DEFAULT 0,
    passed          BOOLEAN NOT NULL DEFAULT false,
    feedback        TEXT,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_exercise ON submissions(exercise_id);
""",
    },
    {
        "name": "create_chat_history",
        "sql": """
CREATE TABLE IF NOT EXISTS chat_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    agent       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_user_time ON chat_history(user_id, created_at DESC);
""",
    },
    {
        "name": "create_struggle_alerts",
        "sql": """
CREATE TABLE IF NOT EXISTS struggle_alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic       TEXT NOT NULL,
    error_count INT NOT NULL DEFAULT 0,
    resolved    BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON struggle_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON struggle_alerts(resolved) WHERE resolved = false;
""",
    },
]


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def get_primary_pod(namespace: str, cluster: str) -> str:
    result = run([
        "kubectl", "get", "pod",
        "-n", namespace,
        "-l", f"cnpg.io/cluster={cluster},cnpg.io/instanceRole=primary",
        "-o", "jsonpath={.items[0].metadata.name}",
    ])
    pod = result.stdout.strip()
    if not pod:
        raise RuntimeError(f"No primary pod found for cluster '{cluster}' in '{namespace}'")
    return pod


def exec_sql(pod: str, namespace: str, sql: str, dbname: str = "learnflow") -> tuple[bool, str]:
    result = run([
        "kubectl", "exec", "-n", namespace, pod, "--",
        "psql", "-U", "learnflow", "-d", dbname, "-c", sql.strip(),
    ])
    return result.returncode == 0, result.stdout + result.stderr


def main():
    parser = argparse.ArgumentParser(description="Run LearnFlow DB migrations")
    parser.add_argument("--namespace", default="postgres")
    parser.add_argument("--cluster",   default="learnflow-postgres")
    parser.add_argument("--dbname",    default="learnflow")
    args = parser.parse_args()

    print(f"Namespace : {args.namespace}")
    print(f"Cluster   : {args.cluster}")
    print(f"Database  : {args.dbname}")
    print(f"Migrations: {len(MIGRATIONS)}\n")

    try:
        pod = get_primary_pod(args.namespace, args.cluster)
        print(f"Primary pod: {pod}\n")
    except Exception as e:
        print(f"{RED}ERROR: {e}{RESET}")
        sys.exit(1)

    # Ensure DB exists
    run(["kubectl", "exec", "-n", args.namespace, pod, "--",
         "psql", "-U", "postgres", "-c",
         f"CREATE DATABASE {args.dbname} OWNER learnflow;"])

    passed = failed = 0
    print(f"{'Migration':<35} {'Status'}")
    print("-" * 50)
    for mig in MIGRATIONS:
        ok, output = exec_sql(pod, args.namespace, mig["sql"], args.dbname)
        if ok:
            print(f"  {mig['name']:<33} {GREEN}OK{RESET}")
            passed += 1
        else:
            print(f"  {mig['name']:<33} {RED}FAILED{RESET}")
            print(f"    {output[:200]}")
            failed += 1

    print(f"\nMigrations: {passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
