# AGENTS.md

This file provides guidance for AI agents (Claude Code, GitHub Copilot, etc.) working in this repository.

---

## Repository Overview

- **Status**: Freshly initialized — no source files yet.
- **Purpose**: TBD (populate this once the project is defined).
- **Owner**: TBD

---

## Agent Behavior Guidelines

### General Principles

- Prefer editing existing files over creating new ones.
- Keep changes minimal and focused. Do not refactor code unless explicitly asked.
- Do not add comments, docstrings, or type annotations to unchanged code.
- Do not introduce features, flags, or abstractions beyond what was requested.
- Do not add error handling for scenarios that cannot occur in context.

### Safety Rules

- **Never** delete files, branches, or data without explicit user confirmation.
- **Never** force-push, reset --hard, or run destructive git operations without confirmation.
- **Never** commit unless the user explicitly asks.
- **Never** push to remote unless the user explicitly asks.
- **Never** expose secrets, API keys, or credentials in code or logs.
- **Never** use `--no-verify` or bypass pre-commit hooks without user approval.
- Do not perform actions with blast radius beyond the local environment without confirmation (e.g., sending messages, modifying shared infrastructure, deploying).

### Security

- Avoid introducing OWASP Top 10 vulnerabilities (SQLi, XSS, command injection, etc.).
- Validate input only at system boundaries (user input, external APIs). Trust internal code.
- Do not hard-code credentials. Use environment variables or secrets managers.

---

## Development Workflow

### Setting Up

> Populate this section once the project is initialized (e.g., `npm install`, `pip install -r requirements.txt`, `go mod download`).

```bash
# Example — replace with actual commands
# npm install
# pip install -r requirements.txt
```

### Running the Project

> Populate with actual run commands after project is defined.

```bash
# Example
# npm run dev
# python main.py
```

### Building

```bash
# Example
# npm run build
# go build ./...
```

### Testing

```bash
# Example
# npm test
# pytest
# go test ./...
```

- Always run tests before considering a task complete.
- Do not modify tests to make them pass unless fixing the test itself is the stated goal.
- Prefer running the smallest targeted test scope first (single file/module), then the full suite.

### Linting & Formatting

```bash
# Example
# npm run lint
# ruff check . && ruff format .
# gofmt -w .
```

- Run linters before committing.
- Fix lint errors; do not suppress them without good reason.

---

## Project Structure

> Update this section as the project grows.

```
Hack-03/
├── AGENTS.md          # This file
└── (project files TBD)
```

---

## Code Conventions

> Populate with language/framework-specific conventions once the stack is defined.

- **Language**: TBD
- **Formatter**: TBD
- **Linter**: TBD
- **Test framework**: TBD

---

## Environment Variables

> List required environment variables here once known.

| Variable | Description | Required |
|----------|-------------|----------|
| TBD      | TBD         | TBD      |

Store secrets in a `.env` file (never commit it). Add `.env` to `.gitignore`.

---

## Git Workflow

- Commit messages should be concise and explain *why*, not just *what*.
- Prefer small, focused commits over large omnibus ones.
- Do not amend published commits.
- Branch naming: `feature/<name>`, `fix/<name>`, `chore/<name>`.

---

## Notes for Agents

- When the project stack is defined, update the **Project Structure**, **Code Conventions**, and **Development Workflow** sections.
- When environment variables are identified, document them in the table above.
- Keep this file up to date as the project evolves — it is the primary reference for all agents.
