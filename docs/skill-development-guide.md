# Skill Development Guide

## Overview

This guide explains how to build skills for the LearnFlow AI Skills Library. Skills are pre-built automation packages that Claude can invoke to complete complex infrastructure and development tasks reliably.

## Skill Anatomy

Every skill lives in `.claude/skills/<skill-name>/` and contains:

```
<skill-name>/
├── SKILL.md          # Claude reads this — must be < 150 tokens
├── REFERENCE.md      # Deep docs, configs, troubleshooting (no limit)
└── scripts/
    ├── deploy.sh     # (or scaffold.sh, generate.sh, setup.sh)
    └── teardown.sh   # Optional: cleanup script
```

## Step-by-Step: Creating a Skill

### Step 1: Choose a name

Use kebab-case. Name should describe what it does, not the technology alone:
- `kafka-k8s-setup` not `kafka`
- `nextjs-k8s-deploy` not `nextjs`
- `agents-md-gen` not `md`

### Step 2: Write `SKILL.md`

This is what Claude sees in its context. Keep it under **150 tokens**.

```yaml
---
name: my-skill
version: 1.0.0
description: One-sentence description of what this skill does
triggers:
  - "natural language phrase 1"
  - "natural language phrase 2"
  - "natural language phrase 3"
parameters:
  - name: required_param
    description: Clear description
    required: true
  - name: optional_param
    description: Clear description
    default: default-value
script: scripts/do-thing.sh
# ~XX tokens
---

## Usage

```
/my-skill required_param=value optional_param=other
```

## What it does

1. First major step
2. Second major step
3. Third major step
...
```

**Token budget breakdown:**
- Frontmatter: ~60 tokens
- Usage section: ~15 tokens
- What it does (7 steps): ~50 tokens
- Total: ~125 tokens ✓

### Step 3: Write the main script

Scripts are the core value. They should be:

**Parameterized:**
```bash
NAMESPACE="${1:-default-namespace}"
REPLICAS="${2:-3}"
```

**Idempotent (safe to run twice):**
```bash
# Good: creates only if not exists
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install ...  # not helm install

# Bad: fails on second run
kubectl create namespace "$NS"
helm install ...
```

**Progress-logged (not silent, not verbose):**
```bash
log() { echo "  [my-skill] $*"; }
log "Installing operator..."  # good
helm install ... -v5           # bad (too verbose)
helm install ... > /dev/null   # too silent
```

**Smoke-tested:**
```bash
log "Running smoke test..."
result=$(kubectl exec ... -- curl -s http://localhost/health)
[[ "$result" == *"ok"* ]] && log "Smoke test passed." || log "Smoke test failed."
```

**Clearly terminated:**
```bash
echo ""
echo "  Service ready!"
echo "  Endpoint: service.namespace:port"
echo ""
echo "✓ Done"
```

### Step 4: Write `REFERENCE.md`

Include everything a developer needs to understand and use the deployed resource:

1. **Architecture diagram** (ASCII art, shows components and connections)
2. **All YAML/config examples** (complete, copy-paste ready, with comments)
3. **Client code examples** (2-3 languages: Python, TypeScript, Go)
4. **Services/endpoints created** (table: service name → purpose → port)
5. **Monitoring** (key metrics, alert thresholds)
6. **Troubleshooting** (6-10 common problems with exact `kubectl` commands to diagnose and fix)
7. **Upgrade/maintenance** (how to upgrade, scale, or change config post-deploy)

### Step 5: Test

```bash
# 1. Test with a real cluster
bash .claude/skills/my-skill/scripts/deploy.sh

# 2. Verify idempotency
bash .claude/skills/my-skill/scripts/deploy.sh  # run again

# 3. Verify cleanup
kubectl delete namespace my-ns  # or whatever resources were created

# 4. Test with non-default params
bash .claude/skills/my-skill/scripts/deploy.sh custom-ns 5 200Gi
```

### Step 6: Update the root README

Add a row to the Skills table in `README.md`.

## Trigger Phrases

Triggers help the user discover skills via natural language. Include:
- The exact technology name: `"deploy kafka"`, `"kafka kubernetes"`
- Common synonyms: `"message queue"`, `"event streaming"`
- Task-oriented phrases: `"setup kafka k8s"`, `"kafka cluster"`

4 triggers per skill is the sweet spot.

## Common Patterns

### Helm install pattern
```bash
helm repo add <name> <url> --force-update > /dev/null 2>&1
helm repo update > /dev/null 2>&1
helm upgrade --install <release> <chart> \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --values /tmp/values.yaml \
  --wait \
  --timeout 10m \
  > /dev/null
```

### Wait for CRD readiness
```bash
kubectl wait <resource>/<name> \
  --namespace "$NAMESPACE" \
  --for=condition=Ready \
  --timeout=10m
```

### Apply inline YAML
```bash
kubectl apply -f - << EOF
apiVersion: ...
kind: ...
metadata:
  name: ${RESOURCE_NAME}
  namespace: ${NAMESPACE}
spec:
  ...
EOF
```

### Create secret idempotently
```bash
kubectl create secret generic my-secret \
  --namespace "$NAMESPACE" \
  --from-literal=key=value \
  --dry-run=client -o yaml | kubectl apply -f - > /dev/null
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Fix |
|-------------|---------|-----|
| `helm install` | Fails on second run | `helm upgrade --install` |
| `kubectl create` | Fails if exists | `--dry-run=client \| kubectl apply` |
| Hardcoded namespace | Not reusable | Parameterize with default |
| No smoke test | Silent failures | Add minimal verification |
| Verbose output | Hides signal in noise | Pipe to `/dev/null`, log key steps |
| `set -e` only | Unbound vars silently fail | `set -euo pipefail` |
| No wait | Race conditions | `kubectl wait --for=condition=Ready` |
| Long SKILL.md | Exceeds token budget | Move details to REFERENCE.md |

## Versioning

Increment `version` in SKILL.md when:
- Script behavior changes (param names, defaults, resources created)
- REFERENCE.md has major structural changes

Use semantic versioning: `1.0.0` → `1.1.0` (new feature) → `2.0.0` (breaking change).

## Testing Checklist

Before submitting a skill:

- [ ] SKILL.md is < 150 tokens (verify with tokenizer)
- [ ] Script runs successfully end-to-end on a real cluster
- [ ] Script is idempotent (runs twice without error)
- [ ] All parameters have sensible defaults
- [ ] Smoke test verifies the resource actually works
- [ ] Final output includes `✓ Done` and connection info
- [ ] REFERENCE.md has architecture diagram
- [ ] REFERENCE.md has at least 5 troubleshooting entries
- [ ] Triggers cover natural language variations
- [ ] Root README table updated
