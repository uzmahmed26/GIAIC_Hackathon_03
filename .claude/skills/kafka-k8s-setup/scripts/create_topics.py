#!/usr/bin/env python3
"""
create_topics.py — Create all LearnFlow Kafka topics via kubectl exec.
Usage: python create_topics.py [--namespace kafka] [--cluster learnflow-kafka]
"""
import subprocess
import sys
import argparse
import time

TOPICS = [
    {"name": "learning.events",    "partitions": 12, "replicas": 1},
    {"name": "code.submissions",   "partitions": 6,  "replicas": 1},
    {"name": "exercise.requests",  "partitions": 6,  "replicas": 1},
    {"name": "exercise.ready",     "partitions": 6,  "replicas": 1},
    {"name": "route.concepts",     "partitions": 6,  "replicas": 1},
    {"name": "route.debug",        "partitions": 6,  "replicas": 1},
    {"name": "learning.response",  "partitions": 6,  "replicas": 1},
    {"name": "struggle.alerts",    "partitions": 3,  "replicas": 1},
]

GREEN = "\033[92m"
RED   = "\033[91m"
RESET = "\033[0m"


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def get_broker_pod(namespace: str, cluster: str) -> str:
    result = run(["kubectl", "get", "pods", "-n", namespace,
                  "-l", f"strimzi.io/cluster={cluster},strimzi.io/kind=Kafka",
                  "-o", "jsonpath={.items[0].metadata.name}"])
    pod = result.stdout.strip()
    if not pod:
        raise RuntimeError(f"No Kafka broker pod found in namespace '{namespace}'")
    return pod


def topic_exists(pod: str, namespace: str, bootstrap: str, topic: str) -> bool:
    result = run(
        ["kubectl", "exec", "-n", namespace, pod, "--",
         "bin/kafka-topics.sh", "--bootstrap-server", bootstrap,
         "--list"],
        check=False
    )
    return topic in result.stdout.split()


def create_topic(pod: str, namespace: str, bootstrap: str, topic: dict) -> bool:
    name = topic["name"]
    result = run(
        ["kubectl", "exec", "-n", namespace, pod, "--",
         "bin/kafka-topics.sh",
         "--bootstrap-server", bootstrap,
         "--create",
         "--topic", name,
         "--partitions", str(topic["partitions"]),
         "--replication-factor", str(topic["replicas"]),
         "--if-not-exists"],
        check=False
    )
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Create LearnFlow Kafka topics")
    parser.add_argument("--namespace", default="kafka")
    parser.add_argument("--cluster", default="learnflow-kafka")
    args = parser.parse_args()

    bootstrap = f"{args.cluster}-kafka-bootstrap.{args.namespace}.svc.cluster.local:9092"
    # For local kubectl exec, use pod-local bootstrap
    local_bootstrap = "localhost:9092"

    print(f"Kafka namespace: {args.namespace}")
    print(f"Cluster: {args.cluster}")
    print(f"Creating {len(TOPICS)} topics...\n")

    try:
        pod = get_broker_pod(args.namespace, args.cluster)
        print(f"Broker pod: {pod}\n")
    except Exception as e:
        print(f"{RED}ERROR: {e}{RESET}")
        sys.exit(1)

    passed = 0
    failed = 0

    for topic in TOPICS:
        name = topic["name"]
        ok = create_topic(pod, args.namespace, local_bootstrap, topic)
        if ok:
            print(f"  {GREEN}CREATED{RESET}  {name}  (partitions={topic['partitions']}, replicas={topic['replicas']})")
            passed += 1
        else:
            print(f"  {RED}FAILED {RESET}  {name}")
            failed += 1

    print(f"\nTopics: {passed} created, {failed} failed")

    # Verify by listing
    print("\nVerifying topics list:")
    result = run(
        ["kubectl", "exec", "-n", args.namespace, pod, "--",
         "bin/kafka-topics.sh", "--bootstrap-server", local_bootstrap, "--list"],
        check=False
    )
    if result.returncode == 0:
        existing = set(result.stdout.strip().split("\n"))
        for topic in TOPICS:
            status = GREEN + "FOUND" + RESET if topic["name"] in existing else RED + "MISSING" + RESET
            print(f"  [{status}] {topic['name']}")
    else:
        print(f"  {RED}Could not list topics: {result.stderr[:200]}{RESET}")

    print("\nDone" if failed == 0 else f"\n{RED}Some topics failed — check Kafka logs{RESET}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
