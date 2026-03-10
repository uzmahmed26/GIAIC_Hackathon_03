---
name: agents-md-gen
version: 1.0.0
description: Generate AGENTS.md / CLAUDE.md files for any repo with repo-aware context
triggers:
  - "generate agents.md"
  - "create claude.md"
  - "add ai context file"
  - "agents md"
parameters:
  - name: repo_path
    description: Absolute path to the target repository
    required: true
  - name: output_file
    description: "Output filename: AGENTS.md or CLAUDE.md"
    default: AGENTS.md
script: scripts/generate.sh
# ~90 tokens
---

## Usage

```
/agents-md-gen repo_path=/path/to/repo output_file=AGENTS.md
```

## What it does

1. Scans repo structure (languages, frameworks, package files, CI config)
2. Detects test commands, lint commands, build commands
3. Generates a complete AGENTS.md with project context, conventions, and commands

## Output

Creates `AGENTS.md` (or `CLAUDE.md`) in the repo root with:
- Project overview and tech stack
- Directory structure summary
- Key commands (build/test/lint/run)
- Code style conventions
- Architecture notes
