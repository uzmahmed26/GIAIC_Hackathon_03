#!/usr/bin/env python3
"""
verify.py — Verify Kafka cluster health on Kubernetes.
Usage: python verify.py [--namespace kafka] [--cluster learnflow-kafka]
Exits 0 if all pods Running, 1 otherwise.
"""
import subprocess
import sys
import argparse
import json

GREEN = "\033[92m"
RED   = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--namespace", default="kafka")
    parser.add_argument("--cluster", default="learnflow-kafka")
    args = parser.parse_args()

    print(f"Verifying Kafka cluster '{args.cluster}' in namespace '{args.namespace}'...\n")

    # ── Check all pods ─────────────────────────────────────────────────────────
    result = run(["kubectl", "get", "pods", "-n", args.namespace, "-o", "json"])
    if result.returncode != 0:
        print(f"{RED}kubectl failed: {result.stderr[:200]}{RESET}")
        sys.exit(1)

    pods = json.loads(result.stdout).get("items", [])
    if not pods:
        print(f"{RED}No pods found in namespace '{args.namespace}'{RESET}")
        sys.exit(1)

    all_running = True
    print(f"{'Pod':<55} {'Status':<12} {'Ready'}")
    print("-" * 75)
    for pod in pods:
        name = pod["metadata"]["name"]
        phase = pod["status"].get("phase", "Unknown")
        conditions = pod["status"].get("conditions", [])
        ready = any(c["type"] == "Ready" and c["status"] == "True" for c in conditions)
        ready_str = f"{GREEN}Ready{RESET}" if ready else f"{RED}Not Ready{RESET}"
        phase_str = f"{GREEN}{phase}{RESET}" if phase == "Running" else f"{RED}{phase}{RESET}"
        print(f"  {name:<53} {phase:<12} {ready_str}")
        if phase != "Running" or not ready:
            all_running = False

    # ── Check Kafka CR status ──────────────────────────────────────────────────
    print()
    kafka_result = run(["kubectl", "get", "kafka", args.cluster, "-n", args.namespace,
                        "-o", "jsonpath={.status.conditions}"])
    if kafka_result.returncode == 0 and kafka_result.stdout:
        try:
            conditions = json.loads(kafka_result.stdout)
            ready_cond = next((c for c in conditions if c.get("type") == "Ready"), None)
            if ready_cond:
                status = ready_cond.get("status", "Unknown")
                color = GREEN if status == "True" else RED
                print(f"Kafka CR Ready: {color}{status}{RESET}")
        except Exception:
            pass

    # ── Bootstrap service ──────────────────────────────────────────────────────
    svc_result = run(["kubectl", "get", "svc",
                      f"{args.cluster}-kafka-bootstrap",
                      "-n", args.namespace,
                      "-o", "jsonpath={.spec.clusterIP}"])
    if svc_result.returncode == 0:
        print(f"Bootstrap ClusterIP: {svc_result.stdout.strip()}")
        print(f"Bootstrap DNS: {args.cluster}-kafka-bootstrap.{args.namespace}.svc.cluster.local:9092")

    print()
    if all_running:
        print(f"{GREEN}All Kafka pods Running — cluster healthy{RESET}")
        sys.exit(0)
    else:
        print(f"{RED}Some pods not ready. Run: kubectl describe pods -n {args.namespace}{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
