#!/usr/bin/env bash
# agents-md-gen/scripts/generate.sh
# Scans a repository and generates AGENTS.md with project context.
# Usage: bash generate.sh <repo_path> [output_file]
# Returns: "✓ Done" on success

set -euo pipefail

REPO_PATH="${1:-.}"
OUTPUT_FILE="${2:-AGENTS.md}"
REPO_PATH="$(cd "$REPO_PATH" && pwd)"

# ── Language detection ─────────────────────────────────────────────────────────
detect_language() {
  if [[ -f "$REPO_PATH/package.json" ]]; then
    if grep -q '"typescript"' "$REPO_PATH/package.json" 2>/dev/null || \
       [[ -f "$REPO_PATH/tsconfig.json" ]]; then
      echo "TypeScript"
    else
      echo "JavaScript"
    fi
  elif [[ -f "$REPO_PATH/pyproject.toml" ]] || [[ -f "$REPO_PATH/setup.py" ]] || \
       [[ -f "$REPO_PATH/requirements.txt" ]]; then
    echo "Python"
  elif [[ -f "$REPO_PATH/go.mod" ]]; then
    echo "Go"
  elif [[ -f "$REPO_PATH/Cargo.toml" ]]; then
    echo "Rust"
  elif [[ -f "$REPO_PATH/pom.xml" ]] || [[ -f "$REPO_PATH/build.gradle" ]]; then
    echo "Java"
  else
    echo "Unknown"
  fi
}

# ── Framework detection ────────────────────────────────────────────────────────
detect_framework() {
  local lang="$1"
  case "$lang" in
    TypeScript|JavaScript)
      if [[ -f "$REPO_PATH/package.json" ]]; then
        local deps
        deps=$(cat "$REPO_PATH/package.json")
        if echo "$deps" | grep -q '"next"'; then echo "Next.js"
        elif echo "$deps" | grep -q '"react"'; then echo "React"
        elif echo "$deps" | grep -q '"vue"'; then echo "Vue"
        elif echo "$deps" | grep -q '"@nestjs/core"'; then echo "NestJS"
        elif echo "$deps" | grep -q '"express"'; then echo "Express"
        else echo "Node.js"; fi
      fi ;;
    Python)
      if [[ -f "$REPO_PATH/pyproject.toml" ]]; then
        if grep -q 'fastapi' "$REPO_PATH/pyproject.toml"; then echo "FastAPI"
        elif grep -q 'django' "$REPO_PATH/pyproject.toml"; then echo "Django"
        elif grep -q 'flask' "$REPO_PATH/pyproject.toml"; then echo "Flask"
        else echo "Python"; fi
      elif [[ -f "$REPO_PATH/requirements.txt" ]]; then
        if grep -qi 'fastapi' "$REPO_PATH/requirements.txt"; then echo "FastAPI"
        elif grep -qi 'django' "$REPO_PATH/requirements.txt"; then echo "Django"
        elif grep -qi 'flask' "$REPO_PATH/requirements.txt"; then echo "Flask"
        else echo "Python"; fi
      else echo "Python"; fi ;;
    Go) echo "Go" ;;
    Rust) echo "Rust" ;;
    Java)
      if [[ -f "$REPO_PATH/pom.xml" ]] && grep -q 'spring-boot' "$REPO_PATH/pom.xml" 2>/dev/null; then
        echo "Spring Boot"
      else
        echo "Java"
      fi ;;
    *) echo "Unknown" ;;
  esac
}

# ── Package manager ────────────────────────────────────────────────────────────
detect_pkg_manager() {
  if [[ -f "$REPO_PATH/pnpm-lock.yaml" ]]; then echo "pnpm"
  elif [[ -f "$REPO_PATH/yarn.lock" ]]; then echo "yarn"
  elif [[ -f "$REPO_PATH/package-lock.json" ]]; then echo "npm"
  elif [[ -f "$REPO_PATH/poetry.lock" ]]; then echo "poetry"
  elif [[ -f "$REPO_PATH/Pipfile" ]]; then echo "pipenv"
  elif [[ -f "$REPO_PATH/requirements.txt" ]]; then echo "pip"
  elif [[ -f "$REPO_PATH/go.mod" ]]; then echo "go modules"
  elif [[ -f "$REPO_PATH/Cargo.toml" ]]; then echo "cargo"
  else echo "unknown"; fi
}

# ── Command extraction ─────────────────────────────────────────────────────────
extract_commands() {
  local cmds=""

  if [[ -f "$REPO_PATH/package.json" ]]; then
    local pkg_mgr
    pkg_mgr=$(detect_pkg_manager)
    local run="$pkg_mgr run"
    [[ "$pkg_mgr" == "npm" ]] && run="npm run"

    for script in dev start build test lint typecheck; do
      if grep -q "\"$script\"" "$REPO_PATH/package.json" 2>/dev/null; then
        cmds="${cmds}| \`$run $script\` | $(echo "$script" | sed 's/dev/Start dev server/;s/start/Start server/;s/build/Build for production/;s/test/Run tests/;s/lint/Lint code/;s/typecheck/Type check/') |\n"
      fi
    done
  fi

  if [[ -f "$REPO_PATH/Makefile" ]]; then
    local targets
    targets=$(grep -E '^[a-zA-Z_-]+:' "$REPO_PATH/Makefile" | head -8 | cut -d: -f1)
    while IFS= read -r target; do
      [[ -n "$target" ]] && cmds="${cmds}| \`make $target\` | $target |\n"
    done <<< "$targets"
  fi

  if [[ -f "$REPO_PATH/pyproject.toml" ]]; then
    cmds="${cmds}| \`python -m pytest\` | Run tests |\n"
    grep -q 'ruff' "$REPO_PATH/pyproject.toml" 2>/dev/null && \
      cmds="${cmds}| \`ruff check .\` | Lint code |\n"
    grep -q 'mypy' "$REPO_PATH/pyproject.toml" 2>/dev/null && \
      cmds="${cmds}| \`mypy .\` | Type check |\n"
  fi

  echo -e "$cmds"
}

# ── Directory structure ────────────────────────────────────────────────────────
get_top_dirs() {
  find "$REPO_PATH" -maxdepth 1 -mindepth 1 -type d \
    ! -name "node_modules" ! -name ".git" ! -name ".next" \
    ! -name "__pycache__" ! -name ".venv" ! -name "dist" \
    ! -name "build" ! -name "coverage" \
    | sort | while read -r d; do
      local name
      name=$(basename "$d")
      printf "%-20s # %s\n" "$name/" "$(ls "$d" | wc -l | tr -d ' ') files"
    done
}

# ── Project name ──────────────────────────────────────────────────────────────
get_project_name() {
  if [[ -f "$REPO_PATH/package.json" ]]; then
    node -e "console.log(require('./package.json').name || '')" 2>/dev/null \
      || basename "$REPO_PATH"
  else
    basename "$REPO_PATH"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
LANGUAGE=$(detect_language)
FRAMEWORK=$(detect_framework "$LANGUAGE")
PKG_MGR=$(detect_pkg_manager)
PROJECT_NAME=$(get_project_name)
COMMANDS=$(extract_commands)
TOP_DIRS=$(get_top_dirs)

OUTPUT="$REPO_PATH/$OUTPUT_FILE"

cat > "$OUTPUT" << AGENTS_EOF
# Project: ${PROJECT_NAME}

## Overview

> Auto-generated by agents-md-gen. Edit this file to add project-specific context.

## Tech Stack

- **Language**: ${LANGUAGE}
- **Framework**: ${FRAMEWORK}
- **Package manager**: ${PKG_MGR}

## Directory Structure

\`\`\`
${TOP_DIRS}
\`\`\`

## Key Commands

| Command | Description |
|---------|-------------|
${COMMANDS}

## Code Style

$(if [[ -f "$REPO_PATH/.eslintrc"* ]] || [[ -f "$REPO_PATH/eslint.config"* ]]; then echo "- **Linter**: ESLint"; fi)
$(if [[ -f "$REPO_PATH/.prettierrc"* ]]; then echo "- **Formatter**: Prettier"; fi)
$(if grep -q 'ruff' "$REPO_PATH/pyproject.toml" 2>/dev/null; then echo "- **Linter**: Ruff"; fi)
$(if grep -q 'mypy' "$REPO_PATH/pyproject.toml" 2>/dev/null; then echo "- **Type checker**: mypy"; fi)
$(if [[ -f "$REPO_PATH/tsconfig.json" ]]; then echo "- **Type checker**: TypeScript compiler (tsc)"; fi)

## Architecture Notes

> TODO: Add architecture overview, key design decisions, and patterns used.

## Environment Variables

$(if [[ -f "$REPO_PATH/.env.example" ]]; then
  echo "See \`.env.example\` for required environment variables."
  echo ""
  echo "\`\`\`"
  cat "$REPO_PATH/.env.example" | head -20
  echo "\`\`\`"
else
  echo "> TODO: Document required environment variables here."
fi)
AGENTS_EOF

echo "✓ Done — ${OUTPUT_FILE} written to ${REPO_PATH}/"
