#!/usr/bin/env python3
"""
seed_data.py -- Seed LearnFlow database with initial data.
Usage: python seed_data.py [--namespace postgres] [--cluster learnflow-postgres]
Idempotent: uses ON CONFLICT DO NOTHING throughout.
"""
import subprocess
import sys
import argparse

GREEN = "\033[92m"
RED   = "\033[91m"
RESET = "\033[0m"

SEED_STATEMENTS = [
    {
        "name": "seed_modules",
        "sql": """
INSERT INTO modules (slug, title, description, order_idx) VALUES
  ('python-basics',      'Python Basics',        'Variables, types, control flow',        1),
  ('functions',          'Functions',            'def, args, kwargs, scope',              2),
  ('data-structures',    'Data Structures',      'Lists, dicts, sets, tuples',            3),
  ('oop',                'Object-Oriented',      'Classes, inheritance, polymorphism',     4),
  ('error-handling',     'Error Handling',       'try/except, custom exceptions',         5),
  ('file-io',            'File I/O',             'Reading/writing files, pathlib',        6),
  ('modules-packages',   'Modules & Packages',   'imports, __init__, pip',                7),
  ('algorithms',         'Algorithms',           'Sorting, searching, complexity',        8)
ON CONFLICT (slug) DO NOTHING;
""",
    },
    {
        "name": "seed_demo_users",
        "sql": """
INSERT INTO users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'maya@example.com', 'Maya Johnson', 'student'),
  ('00000000-0000-0000-0000-000000000002', 'john@example.com', 'John Smith',   'teacher'),
  ('00000000-0000-0000-0000-000000000003', 'alex@example.com', 'Alex Chen',    'student'),
  ('00000000-0000-0000-0000-000000000004', 'sara@example.com', 'Sara Davis',   'student'),
  ('00000000-0000-0000-0000-000000000005', 'mike@example.com', 'Mike Wilson',  'student')
ON CONFLICT (id) DO NOTHING;
""",
    },
    {
        "name": "seed_exercises",
        "sql": """
INSERT INTO exercises (id, module_id, title, description, difficulty, test_cases) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    (SELECT id FROM modules WHERE slug='python-basics'),
    'FizzBuzz',
    'Print FizzBuzz for numbers 1-20. Divisible by 3 -> Fizz, by 5 -> Buzz, both -> FizzBuzz.',
    'easy',
    '[{"input": "", "expected": "FizzBuzz"}]'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    (SELECT id FROM modules WHERE slug='functions'),
    'Factorial',
    'Write a recursive function factorial(n) that returns n!.',
    'medium',
    '[{"input": "5", "expected": "120"}, {"input": "0", "expected": "1"}]'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    (SELECT id FROM modules WHERE slug='data-structures'),
    'Two Sum',
    'Given a list nums and target, return indices of two numbers that add to target.',
    'medium',
    '[{"input": "[2,7,11,15], 9", "expected": "[0, 1]"}]'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    (SELECT id FROM modules WHERE slug='oop'),
    'Stack Class',
    'Implement a Stack class with push, pop, peek, and is_empty methods.',
    'medium',
    '[{"input": "push(1),push(2),pop()", "expected": "2"}]'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    (SELECT id FROM modules WHERE slug='algorithms'),
    'Binary Search',
    'Implement binary_search(arr, target) returning the index or -1.',
    'hard',
    '[{"input": "[1,3,5,7,9], 5", "expected": "2"}, {"input": "[1,3,5], 4", "expected": "-1"}]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
""",
    },
    {
        "name": "seed_progress",
        "sql": """
INSERT INTO progress (user_id, module_id, exercises_score, quiz_score, code_quality, streak_days)
SELECT
  '00000000-0000-0000-0000-000000000001',
  id,
  CASE order_idx
    WHEN 1 THEN 90 WHEN 2 THEN 85 WHEN 3 THEN 75
    WHEN 4 THEN 60 WHEN 5 THEN 50 ELSE 0
  END,
  CASE order_idx
    WHEN 1 THEN 88 WHEN 2 THEN 82 WHEN 3 THEN 70
    WHEN 4 THEN 55 WHEN 5 THEN 45 ELSE 0
  END,
  CASE order_idx WHEN 1 THEN 92 WHEN 2 THEN 80 ELSE 0 END,
  7
FROM modules
ON CONFLICT (user_id, module_id) DO NOTHING;
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


def exec_sql(pod: str, namespace: str, sql: str, dbname: str) -> tuple[bool, str]:
    result = run([
        "kubectl", "exec", "-n", namespace, pod, "--",
        "psql", "-U", "learnflow", "-d", dbname, "-c", sql.strip(),
    ])
    return result.returncode == 0, result.stdout + result.stderr


def main():
    parser = argparse.ArgumentParser(description="Seed LearnFlow database")
    parser.add_argument("--namespace", default="postgres")
    parser.add_argument("--cluster",   default="learnflow-postgres")
    parser.add_argument("--dbname",    default="learnflow")
    args = parser.parse_args()

    print(f"Namespace: {args.namespace}")
    print(f"Cluster  : {args.cluster}")
    print(f"Database : {args.dbname}")
    print(f"Seed ops : {len(SEED_STATEMENTS)}\n")

    try:
        pod = get_primary_pod(args.namespace, args.cluster)
        print(f"Primary pod: {pod}\n")
    except Exception as e:
        print(f"{RED}ERROR: {e}{RESET}")
        sys.exit(1)

    passed = failed = 0
    print(f"{'Seed operation':<35} {'Status'}")
    print("-" * 50)
    for stmt in SEED_STATEMENTS:
        ok, output = exec_sql(pod, args.namespace, stmt["sql"], args.dbname)
        if ok:
            print(f"  {stmt['name']:<33} {GREEN}OK{RESET}")
            passed += 1
        else:
            print(f"  {stmt['name']:<33} {RED}FAILED{RESET}")
            print(f"    {output[:300]}")
            failed += 1

    # Quick count check
    print("\nRow counts:")
    for table in ["modules", "users", "exercises", "progress"]:
        r = run([
            "kubectl", "exec", "-n", args.namespace, pod, "--",
            "psql", "-U", "learnflow", "-d", args.dbname,
            "-t", "-c", f"SELECT COUNT(*) FROM {table};",
        ])
        count = r.stdout.strip() if r.returncode == 0 else "?"
        print(f"  {table:<20} {count} rows")

    print(f"\nSeed: {passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
