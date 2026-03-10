# LearnFlow AI — Hackathon III

Production-grade AI Python tutoring platform with a Next.js frontend and a complete Skills Library for Claude.

## Repository Structure

```
Hack-03/
├── frontend/                  # Next.js 15 app (LearnFlow AI Python Tutor)
│   ├── app/                   # App Router pages
│   │   ├── login/             # Auth pages
│   │   ├── register/
│   │   ├── dashboard/         # Student dashboard
│   │   │   ├── chat/          # AI chat tutor
│   │   │   ├── code/          # Monaco code editor
│   │   │   ├── exercises/     # Exercise system
│   │   │   └── progress/      # Progress charts
│   │   └── teacher/           # Teacher dashboard
│   └── src/
│       ├── components/        # UI components
│       └── lib/               # Auth, API, mock data, types
├── .claude/
│   └── skills/                # Claude Skills Library (MCP Code Execution Pattern)
│       ├── agents-md-gen/
│       ├── kafka-k8s-setup/
│       ├── postgres-k8s-setup/
│       ├── fastapi-dapr-agent/
│       ├── mcp-code-execution/
│       ├── nextjs-k8s-deploy/
│       ├── docusaurus-deploy/
│       ├── kong-api-gateway/
│       ├── argocd-gitops/
│       └── prometheus-grafana/
└── docs/
    ├── mcp-code-execution-pattern.md
    └── skill-development-guide.md
```

---

## Frontend — LearnFlow AI Python Tutor

### Tech Stack

- **Framework**: Next.js 15 App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (Catppuccin Mocha theme)
- **Editor**: Monaco Editor (`@monaco-editor/react`)
- **Charts**: Recharts
- **Auth**: localStorage-based mock auth
- **API**: Axios with retry + toast notifications

### Design System

Catppuccin Mocha palette:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#1e1e2e` | Page background |
| Panel | `#181825` | Cards, sidebar |
| Border | `#313244` | All borders |
| Text | `#cdd6f4` | Primary text |
| Muted | `#6c7086` | Secondary text |
| Accent | `#6366f1` | Primary actions |
| Success | `#a6e3a1` | Completed states |
| Error | `#f38ba8` | Errors, destructive |

### Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

**Demo accounts:**
- Student: `maya@example.com` / any password
- Teacher: `john@example.com` / any password

### Pages

| Route | Description |
|-------|-------------|
| `/login` | Login page |
| `/register` | Registration with role selection |
| `/dashboard` | Student home with stats, progress, quick actions |
| `/dashboard/chat` | AI chat tutor with agent selection |
| `/dashboard/code` | Monaco editor with AI review |
| `/dashboard/exercises` | Exercise library with filtering and modal runner |
| `/dashboard/progress` | Charts, heatmap, achievements |
| `/teacher` | Teacher dashboard with student management |

---

## Skills Library

The `.claude/skills/` directory follows the **MCP Code Execution Pattern** — pre-written scripts contain all heavy logic; Claude invokes them with minimal parameters.

### Available Skills

| Skill | Description | Trigger Phrases |
|-------|-------------|-----------------|
| `agents-md-gen` | Generate AGENTS.md / CLAUDE.md for any repo | "generate agents.md", "create claude.md" |
| `kafka-k8s-setup` | Deploy Apache Kafka on Kubernetes (Strimzi) | "deploy kafka", "kafka kubernetes" |
| `postgres-k8s-setup` | Deploy HA PostgreSQL on Kubernetes (CloudNativePG) | "deploy postgres", "postgresql kubernetes" |
| `fastapi-dapr-agent` | Scaffold FastAPI microservice with Dapr sidecar | "create fastapi dapr", "dapr microservice" |
| `mcp-code-execution` | Set up MCP server with sandboxed code execution | "mcp code execution", "setup mcp server" |
| `nextjs-k8s-deploy` | Deploy Next.js to Kubernetes with TLS + HPA | "deploy nextjs", "nextjs kubernetes" |
| `docusaurus-deploy` | Deploy Docusaurus docs to GitHub Pages / Vercel | "deploy docusaurus", "create docs site" |
| `kong-api-gateway` | Deploy Kong API Gateway with rate-limiting + auth | "setup kong", "kong api gateway" |
| `argocd-gitops` | Install ArgoCD with App of Apps GitOps pattern | "setup argocd", "gitops bootstrap" |
| `prometheus-grafana` | Deploy kube-prometheus-stack with dashboards + alerts | "setup monitoring", "prometheus grafana" |

### Skill Structure

Each skill contains:

```
skill-name/
├── SKILL.md        # < 150 tokens — what Claude reads
├── REFERENCE.md    # Deep docs, configs, troubleshooting
└── scripts/
    └── deploy.sh   # Idempotent shell script — does all the work
```

### Invoking a Skill

```
/kafka-k8s-setup namespace=kafka replicas=3 storage_size=100Gi
/postgres-k8s-setup namespace=postgres db_name=appdb
/nextjs-k8s-deploy app_name=learnflow image_repo=ghcr.io/org/app domain=app.example.com
/argocd-gitops repo_url=https://github.com/myorg/gitops
/prometheus-grafana storage_size=50Gi retention=30d
```

### Documentation

- [MCP Code Execution Pattern](docs/mcp-code-execution-pattern.md) — The underlying pattern and design principles
- [Skill Development Guide](docs/skill-development-guide.md) — How to build new skills

---

## Architecture

```
Browser
  │
  ▼
Next.js Frontend (port 3000)
  │
  ├─ /api/chat        → triage/concepts service (port 8001)
  ├─ /api/debug       → debug service (port 8001)
  ├─ /api/exercises   → exercise service
  └─ /api/progress    → progress service
              │
              ▼
        Python Backend
        (FastAPI + Dapr)
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
PostgreSQL   Redis   Kafka
```

All API routes include demo-mode fallback — the frontend works without any backend running.
