# MCP Code Execution Pattern

## Origin

From Anthropic's engineering blog — the pattern used internally to give Claude reliable, efficient tool-use for complex operations.

## Core Principle

> **Scripts do the heavy lifting. The LLM calls tools with minimal params. Scripts return "✓ Done".**

This is the opposite of asking Claude to generate all logic inline. Instead:

1. Pre-write scripts with all the complex logic
2. Expose those scripts as MCP tools with small, typed parameter surfaces
3. Scripts return concise results — not full dumps

## Why This Works

| Approach | Token cost | Reliability | Repeatability |
|----------|------------|-------------|---------------|
| LLM generates code inline | High (logic in prompt+response) | Low (hallucinations) | Low |
| MCP Code Execution Pattern | Low (just params) | High (tested scripts) | High (idempotent) |

## Pattern Structure

```
User: "Deploy Kafka with 3 replicas"
         │
         ▼
Claude: calls tool execute_script("kafka-deploy", {replicas: 3})
         │
         ▼
MCP Server: runs scripts/deploy.sh 3
         │
         ▼
Script: does ALL the work (helm, kubectl, wait, smoke test)
         │
         ▼
Output: "✓ Done — Kafka ready at kafka-bootstrap.kafka:9092"
         │
         ▼
Claude: summarizes result to user
```

## SKILL.md Format

Every skill has a `SKILL.md` with:

```yaml
---
name: skill-name
version: 1.0.0
description: One-line description
triggers:
  - "natural language phrases"
parameters:
  - name: param_name
    description: What it does
    required: true/false
    default: value
script: scripts/do-thing.sh
# ~XX tokens  ← Keep under 150 tokens total
---

## Usage

(minimal example)

## What it does

(numbered steps — what the script actually does)
```

## Script Design Principles

### 1. Idempotent
Running twice should not break anything. Use `--dry-run=client -o yaml | kubectl apply` patterns, `helm upgrade --install` (not `install`), `CREATE TABLE IF NOT EXISTS`.

### 2. Self-contained
Script validates prerequisites, creates all resources, waits for readiness, runs smoke test, prints connection info. User should not need to do anything after the script finishes.

### 3. Concise output
Return `✓ Done` plus essential connection info. Not full YAML dumps or verbose logs. Pipe verbose commands to `/dev/null` and log progress with short prefix messages.

### 4. Fail fast
Use `set -euo pipefail`. Don't silently swallow errors. If a step fails, print a clear error and exit non-zero.

### 5. Parameterized
Accept all meaningful values as arguments with sensible defaults. Never hardcode namespaces, sizes, or names that users would want to change.

## Example Script Template

```bash
#!/usr/bin/env bash
# skill-name/scripts/deploy.sh
# One-line description.
# Usage: bash deploy.sh [param1] [param2]
# Returns: "✓ Done" on success

set -euo pipefail

PARAM1="${1:-default-value}"
PARAM2="${2:-other-default}"

log() { echo "  [skill-name] $*"; }

# ── Step 1: Install operator ──────────────────────────────────────────────────
log "Installing operator..."
helm upgrade --install ... --wait > /dev/null

# ── Step 2: Apply CRs ─────────────────────────────────────────────────────────
log "Applying resources..."
kubectl apply -f - << EOF
...
EOF

# ── Step 3: Wait for ready ────────────────────────────────────────────────────
log "Waiting for readiness..."
kubectl wait ... --for=condition=Ready --timeout=5m

# ── Step 4: Smoke test ────────────────────────────────────────────────────────
log "Running smoke test..."
# ... minimal verification ...

# ── Step 5: Print connection info ─────────────────────────────────────────────
echo ""
echo "  Resource ready!"
echo "  Endpoint: resource.namespace:port"
echo ""
echo "✓ Done"
```

## Token Budget

SKILL.md must stay under **150 tokens**. This allows Claude to load many skills into context simultaneously without exceeding limits.

Count your tokens: copy the SKILL.md content into a tokenizer. The `# ~XX tokens` comment at the bottom is a reminder of the actual count.

Rules:
- Frontmatter: name, version, description, triggers (≤4), parameters (≤5), script path
- Usage: one minimal example (≤3 lines)
- What it does: numbered list (≤7 items, one line each)
- No explanatory prose in SKILL.md — that belongs in REFERENCE.md

## REFERENCE.md Format

REFERENCE.md has no token limit. Include:

- Architecture diagram (ASCII)
- All YAML/config examples (full, copy-paste ready)
- Language-specific client connection examples
- Monitoring metrics and alert thresholds
- Complete troubleshooting section with commands

## Adding a New Skill

1. Create directory: `.claude/skills/my-skill/scripts/`
2. Write `SKILL.md` (< 150 tokens)
3. Write `REFERENCE.md` (comprehensive)
4. Write `scripts/do-thing.sh` (idempotent, parameterized, returns "✓ Done")
5. Test the script end-to-end
6. Update root `README.md` skill table
