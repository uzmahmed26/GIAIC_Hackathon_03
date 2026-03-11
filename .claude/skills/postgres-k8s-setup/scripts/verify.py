#!/usr/bin/env python3
"""
verify.py -- Verify PostgreSQL cluster health on Kubernetes.
Usage: python verify.py [--namespace postgres] [--cluster learnflow-postgres]
Exits 0 if all checks pass, 1 otherwise.
"""
import subprocess
import sys
import argparse
import json

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def check(label: str, ok: bool, detail: str = "") -> bool:
    status = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"
    line = f"  [{status}] {label}"
    if detail:
        line += f"  ({detail})"
    print(line)
    return ok


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--namespace", default="postgres")
    parser.add_argument("--cluster",   default="learnflow-postgres")
    parser.add_argument("--dbname",    default="learnflow")
    args = parser.parse_args()

    print(f"Verifying PostgreSQL cluster '{args.cluster}' in '{args.namespace}'...\n")
    results: list[bool] = []

    # ── 1. Pods ─────────────────────────────────────────────────────────────────
    print("Pods:")
    r = run(["kubectl", "get", "pods", "-n", args.namespace, "-o", "json"])
    if r.returncode != 0:
        print(f"{RED}kubectl failed: {r.stderr[:200]}{RESET}")
        sys.exit(1)

    pods = json.loads(r.stdout).get("items", [])
    if not pods:
        print(f"{RED}No pods in namespace '{args.namespace}'{RESET}")
        sys.exit(1)

    for pod in pods:
        name   = pod["metadata"]["name"]
        phase  = pod["status"].get("phase", "Unknown")
        conds  = pod["status"].get("conditions", [])
        ready  = any(c["type"] == "Ready" and c["status"] == "True" for c in conds)
        ok     = phase == "Running" and ready
        results.append(check(name, ok, f"phase={phase}, ready={ready}"))

    # ── 2. Cluster CR ───────────────────────────────────────────────────────────
    print("\nCluster CR:")
    cr = run(["kubectl", "get", "cluster", args.cluster,
              "-n", args.namespace, "-o", "json"])
    if cr.returncode == 0:
        try:
            data     = json.loads(cr.stdout)
            status   = data.get("status", {})
            phase    = status.get("phase", "Unknown")
            ready_i  = status.get("readyInstances", 0)
            total_i  = status.get("instances", 0)
            ok       = phase == "Cluster in healthy state" or ready_i == total_i
            results.append(check("Cluster phase", ok, phase))
            results.append(check("Instances ready", ready_i == total_i,
                                 f"{ready_i}/{total_i}"))
        except Exception as e:
            print(f"  {YELLOW}Could not parse CR: {e}{RESET}")
    else:
        print(f"  {YELLOW}Cluster CR not found (CloudNativePG not installed?){RESET}")

    # ── 3. Service ──────────────────────────────────────────────────────────────
    print("\nServices:")
    for svc_suffix in ["-rw", "-ro", "-r"]:
        svc_name = f"{args.cluster}{svc_suffix}"
        sv = run(["kubectl", "get", "svc", svc_name, "-n", args.namespace,
                  "-o", "jsonpath={.spec.clusterIP}"])
        ok = sv.returncode == 0 and bool(sv.stdout.strip())
        results.append(check(svc_name, ok, sv.stdout.strip() if ok else "not found"))

    # ── 4. Connection test ──────────────────────────────────────────────────────
    print("\nConnection:")
    primary_pod_r = run([
        "kubectl", "get", "pod",
        "-n", args.namespace,
        "-l", f"cnpg.io/cluster={args.cluster},cnpg.io/instanceRole=primary",
        "-o", "jsonpath={.items[0].metadata.name}",
    ])
    primary_pod = primary_pod_r.stdout.strip()
    if primary_pod:
        conn = run([
            "kubectl", "exec", "-n", args.namespace, primary_pod, "--",
            "psql", "-U", "learnflow", "-d", args.dbname,
            "-c", "SELECT current_database(), pg_postmaster_start_time()::text;",
        ])
        ok = conn.returncode == 0
        detail = args.dbname if ok else conn.stderr[:100]
        results.append(check("psql connection", ok, detail))

        # Table check
        if ok:
            tables_r = run([
                "kubectl", "exec", "-n", args.namespace, primary_pod, "--",
                "psql", "-U", "learnflow", "-d", args.dbname,
                "-t", "-c",
                "SELECT COUNT(*) FROM information_schema.tables "
                "WHERE table_schema='public';",
            ])
            count = tables_r.stdout.strip() if tables_r.returncode == 0 else "?"
            results.append(check("Tables exist", tables_r.returncode == 0,
                                 f"{count} tables"))
    else:
        print(f"  {YELLOW}No primary pod found — skipping connection test{RESET}")

    # ── 5. Summary ──────────────────────────────────────────────────────────────
    print()
    passed = sum(results)
    total  = len(results)
    if all(results):
        print(f"{GREEN}All {total} checks passed -- PostgreSQL cluster healthy{RESET}")
        print(f"\nConnection string:")
        print(f"  postgresql://learnflow:<password>@"
              f"{args.cluster}-rw.{args.namespace}.svc.cluster.local:5432/{args.dbname}")
        sys.exit(0)
    else:
        print(f"{RED}{total - passed}/{total} checks failed -- "
              f"run: kubectl describe cluster {args.cluster} -n {args.namespace}{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
