# agents-md-gen Reference

## Overview

Generates an `AGENTS.md` or `CLAUDE.md` file for any repository by scanning its structure and inferring project conventions. This file gives AI coding assistants the context they need to work effectively in a codebase.

## How It Works

The script (`scripts/generate.sh`) performs these steps:

1. **Language detection** — checks for `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, etc.
2. **Framework detection** — inspects dependencies for React/Next.js/FastAPI/Django/Spring/etc.
3. **Command inference** — reads scripts from `package.json`, `Makefile`, `justfile`, `.github/workflows/`
4. **Structure scan** — maps top-level directories, identifies `src/`, `tests/`, `docs/`, `infra/`
5. **Convention detection** — checks for `.eslintrc`, `.prettierrc`, `mypy.ini`, `ruff.toml`, etc.
6. **Output generation** — renders the AGENTS.md template with all discovered information

## Generated File Structure

```markdown
# Project: <name>

## Overview
<description from package.json / README first paragraph>

## Tech Stack
- Language: <detected>
- Framework: <detected>
- Package manager: <npm/yarn/pnpm/pip/poetry/cargo/etc>

## Directory Structure
<tree of top-level dirs with descriptions>

## Key Commands
| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm test` | Run tests |
| `npm run lint` | Lint code |

## Code Style
<detected formatters, linters, type checkers>

## Architecture Notes
<inferred from directory structure and dependencies>

## Environment Variables
<detected from .env.example or dotenv usage>
```

## Configuration

The script accepts environment variable overrides:

```bash
AGENTS_MD_TEMPLATE=/path/to/custom.md.tmpl \
AGENTS_MD_MAX_DEPTH=3 \
bash scripts/generate.sh /path/to/repo AGENTS.md
```

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTS_MD_TEMPLATE` | built-in | Custom Handlebars template |
| `AGENTS_MD_MAX_DEPTH` | `2` | Max directory scan depth |
| `AGENTS_MD_INCLUDE_TESTS` | `true` | Include test commands |
| `AGENTS_MD_INCLUDE_ENV` | `true` | Include env var section |

## Supported Languages & Frameworks

| Language | Detection File | Frameworks Detected |
|----------|---------------|---------------------|
| JavaScript/TypeScript | `package.json` | Next.js, React, Vue, Express, NestJS |
| Python | `pyproject.toml`, `setup.py`, `requirements.txt` | FastAPI, Django, Flask, SQLAlchemy |
| Go | `go.mod` | Gin, Echo, Fiber, gRPC |
| Rust | `Cargo.toml` | Actix, Axum, Tokio |
| Java | `pom.xml`, `build.gradle` | Spring Boot, Quarkus, Micronaut |
| Ruby | `Gemfile` | Rails, Sinatra |

## Troubleshooting

**No commands detected**
- Ensure `package.json` has a `scripts` field, or that a `Makefile`/`justfile` exists
- Add a `.agents-md.json` config file to the repo root with manual overrides

**Wrong framework detected**
- Check that the framework is listed as a dependency (not devDependency only)
- Override via `.agents-md.json`:
  ```json
  { "framework": "Next.js", "language": "TypeScript" }
  ```

**Output too verbose**
- Set `AGENTS_MD_MAX_DEPTH=1` to reduce directory scan depth
- Edit the generated file manually — it's just Markdown

## Example `.agents-md.json` Override

```json
{
  "name": "LearnFlow API",
  "description": "Python tutoring platform backend",
  "commands": {
    "dev": "uvicorn main:app --reload",
    "test": "pytest -x",
    "lint": "ruff check . && mypy ."
  },
  "architecture": "FastAPI monolith with PostgreSQL + Redis"
}
```
