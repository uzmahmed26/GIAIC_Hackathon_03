#!/usr/bin/env python3
"""
verify_full_deployment.py -- End-to-end health check for LearnFlow on Kubernetes.
Usage: python scripts/verify_full_deployment.py [--namespace learnflow]
Tests: all health endpoints, Kafka connectivity, DB connection, Dapr sidecars.
Exits 0 if all pass, 1 otherwise.
"""
import subprocess
import sys
import argparse
import json
import time

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

SERVICES = [
    {"name": "triage-agent",   "port": 8001, "dapr_app_id": "triage-agent"},
    {"name": "concepts-agent", "port": 8002, "dapr_app_id": "concepts-agent"},
    {"name": "debug-agent",    "port": 8003, "dapr_app_id": "debug-agent"},
    {"name": "exercise-agent", "port": 8004, "dapr_app_id": "exercise-agent"},
    {"name": "progress-agent", "port": 8005, "dapr_app_id": "progress-agent"},
    {"name": "frontend",       "port": 3000, "dapr_app_id": None},
]

KAFKA_TOPICS = [
    "learning.events", "code.submissions", "exercise.requests",
    "exercise.ready",  "route.concepts",   "route.debug",
    "learning.response", "struggle.alerts",
]


def run(cmd: list[str], timeout: int = 15) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def ok_line(label: str, passed: bool, detail: str = "") -> bool:
    sym  = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    tail = f"  {detail}" if detail else ""
    print(f"  [{sym}] {label}{tail}")
    return passed


def section(title: str):
    print(f"\n{BOLD}{title}{RESET}")
    print("-" * 60)


# ── Helpers ─────────────────────────────────────────────────────────────────────

def kubectl_exec_in_pod(namespace: str, label_selector: str,
                        cmd: list[str]) -> tuple[bool, str]:
    pod_r = run(["kubectl", "get", "pod", "-n", namespace,
                 "-l", label_selector, "-o",
                 "jsonpath={.items[0].metadata.name}"])
    pod = pod_r.stdout.strip()
    if not pod:
        return False, f"no pod with label {label_selector}"
    r = run(["kubectl", "exec", "-n", namespace, pod, "--"] + cmd)
    return r.returncode == 0, r.stdout + r.stderr


def port_forward_health(namespace: str, service: str,
                        port: int, path: str = "/health") -> tuple[bool, str]:
    """Open a temporary port-forward and hit /health."""
    import threading
    import urllib.request
    import urllib.error

    pf = subprocess.Popen(
        ["kubectl", "port-forward", f"svc/{service}", f"19{port}:{port}",
         "-n", namespace],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(2)
    try:
        url = f"http://localhost:19{port}{path}"
        with urllib.request.urlopen(url, timeout=5) as resp:
            body = resp.read(512).decode()
            return resp.status == 200, body[:100]
    except Exception as e:
        return False, str(e)[:100]
    finally:
        pf.terminate()
        pf.wait()


# ── Check functions ──────────────────────────────────────────────────────────────

def check_namespace(namespace: str) -> list[bool]:
    section("1. Namespace & Secrets")
    results = []
    r = run(["kubectl", "get", "namespace", namespace])
    results.append(ok_line(f"namespace/{namespace} exists", r.returncode == 0))

    r = run(["kubectl", "get", "secret", "learnflow-secrets",
             "-n", namespace])
    results.append(ok_line("secret/learnflow-secrets exists", r.returncode == 0))
    return results


def check_pods(namespace: str) -> list[bool]:
    section("2. Pod Readiness (app container + Dapr sidecar)")
    r = run(["kubectl", "get", "pods", "-n", namespace, "-o", "json"])
    if r.returncode != 0:
        print(f"  {RED}kubectl failed{RESET}")
        return [False]

    pods   = json.loads(r.stdout).get("items", [])
    results = []
    for pod in pods:
        name  = pod["metadata"]["name"]
        phase = pod["status"].get("phase", "Unknown")
        conds = pod["status"].get("conditions", [])
        ready = any(c["type"] == "Ready" and c["status"] == "True" for c in conds)

        # Count ready containers
        container_statuses = pod["status"].get("containerStatuses", [])
        ready_containers   = sum(1 for c in container_statuses if c.get("ready"))
        total_containers   = len(container_statuses)

        ok = phase == "Running" and ready
        results.append(ok_line(
            name, ok,
            f"phase={phase} containers={ready_containers}/{total_containers}",
        ))
    return results


def check_health_endpoints(namespace: str) -> list[bool]:
    section("3. Health Endpoints")
    results = []
    for svc in SERVICES:
        path = "/api/health" if svc["name"] == "frontend" else "/health"
        ok, detail = port_forward_health(namespace, svc["name"], svc["port"], path)
        results.append(ok_line(f"{svc['name']} {path}", ok, detail))
    return results


def check_kafka(kafka_ns: str = "kafka",
                cluster: str = "learnflow-kafka") -> list[bool]:
    section("4. Kafka Topics")
    results = []

    # Get any broker pod
    pod_r = run(["kubectl", "get", "pod", "-n", kafka_ns,
                 "-l", f"strimzi.io/cluster={cluster},strimzi.io/kind=Kafka",
                 "-o", "jsonpath={.items[0].metadata.name}"])
    pod = pod_r.stdout.strip()
    if not pod:
        print(f"  {YELLOW}No Kafka broker pod found -- skipping topic checks{RESET}")
        return [False]

    list_r = run(["kubectl", "exec", "-n", kafka_ns, pod, "--",
                  "bin/kafka-topics.sh", "--bootstrap-server", "localhost:9092",
                  "--list"])
    if list_r.returncode != 0:
        results.append(ok_line("kafka-topics.sh --list", False, list_r.stderr[:100]))
        return results

    existing = set(list_r.stdout.strip().split("\n"))
    for topic in KAFKA_TOPICS:
        results.append(ok_line(topic, topic in existing,
                               "found" if topic in existing else "MISSING"))
    return results


def check_postgres(pg_ns: str = "postgres",
                   cluster: str = "learnflow-postgres",
                   dbname: str = "learnflow") -> list[bool]:
    section("5. PostgreSQL Connection & Schema")
    results = []

    pod_r = run(["kubectl", "get", "pod", "-n", pg_ns,
                 "-l", f"cnpg.io/cluster={cluster},cnpg.io/instanceRole=primary",
                 "-o", "jsonpath={.items[0].metadata.name}"])
    pod = pod_r.stdout.strip()
    if not pod:
        print(f"  {YELLOW}No primary pod found -- skipping DB checks{RESET}")
        return [False]

    # Connection
    conn = run(["kubectl", "exec", "-n", pg_ns, pod, "--",
                "psql", "-U", "learnflow", "-d", dbname,
                "-c", "SELECT 1;"])
    results.append(ok_line("psql connection", conn.returncode == 0))

    if conn.returncode == 0:
        for table in ["users", "modules", "progress", "exercises",
                      "submissions", "chat_history", "struggle_alerts"]:
            tr = run(["kubectl", "exec", "-n", pg_ns, pod, "--",
                      "psql", "-U", "learnflow", "-d", dbname,
                      "-t", "-c", f"SELECT COUNT(*) FROM {table};"])
            count = tr.stdout.strip() if tr.returncode == 0 else "?"
            results.append(ok_line(f"table: {table}", tr.returncode == 0,
                                   f"{count} rows"))
    return results


def check_dapr(namespace: str) -> list[bool]:
    section("6. Dapr Sidecar Health")
    results = []
    for svc in SERVICES:
        if svc["dapr_app_id"] is None:
            continue
        # Each Dapr sidecar listens on 3500 internally; check via pod annotation
        pod_r = run(["kubectl", "get", "pod", "-n", namespace,
                     "-l", f"app={svc['name']}",
                     "-o", "jsonpath={.items[0].metadata.name}"])
        pod = pod_r.stdout.strip()
        if not pod:
            results.append(ok_line(f"dapr/{svc['name']}", False, "pod not found"))
            continue

        # Check Dapr sidecar container is ready
        cstat_r = run(["kubectl", "get", "pod", pod, "-n", namespace,
                       "-o", "jsonpath={.status.containerStatuses[?(@.name=='daprd')].ready}"])
        ready = cstat_r.stdout.strip() == "true"
        results.append(ok_line(f"dapr/{svc['name']} sidecar ready", ready))
    return results


def main():
    parser = argparse.ArgumentParser(description="Verify full LearnFlow deployment")
    parser.add_argument("--namespace",  default="learnflow")
    parser.add_argument("--kafka-ns",   default="kafka")
    parser.add_argument("--postgres-ns",default="postgres")
    parser.add_argument("--skip-health", action="store_true",
                        help="Skip HTTP health endpoint checks (no port-forward)")
    args = parser.parse_args()

    print(f"\n{BOLD}LearnFlow Full Deployment Verification{RESET}")
    print("=" * 60)
    print(f"Namespace : {args.namespace}")
    print(f"Kafka NS  : {args.kafka_ns}")
    print(f"Postgres NS: {args.postgres_ns}")

    all_results: list[bool] = []
    all_results += check_namespace(args.namespace)
    all_results += check_pods(args.namespace)
    if not args.skip_health:
        all_results += check_health_endpoints(args.namespace)
    all_results += check_kafka(args.kafka_ns)
    all_results += check_postgres(args.postgres_ns)
    all_results += check_dapr(args.namespace)

    # ── Final summary ────────────────────────────────────────────────────────────
    passed = sum(all_results)
    total  = len(all_results)
    pct    = int(passed / total * 100) if total else 0

    print(f"\n{'=' * 60}")
    print(f"{BOLD}Summary: {passed}/{total} checks passed ({pct}%){RESET}")

    if all(all_results):
        print(f"\n{GREEN}{BOLD}All checks passed -- LearnFlow is fully operational!{RESET}")
        # Print access URL
        url_r = run(["minikube", "service", "frontend",
                     "-n", args.namespace, "--url"])
        if url_r.returncode == 0:
            print(f"\nFrontend URL: {url_r.stdout.strip()}")
        sys.exit(0)
    else:
        failed_count = total - passed
        print(f"\n{RED}{BOLD}{failed_count} check(s) failed.{RESET}")
        print("Debugging hints:")
        print("  kubectl get pods -A")
        print(f"  kubectl describe pods -n {args.namespace}")
        print("  kubectl logs -n learnflow deployment/triage-agent -c triage-agent")
        print("  kubectl logs -n learnflow deployment/triage-agent -c daprd")
        sys.exit(1)


if __name__ == "__main__":
    main()
