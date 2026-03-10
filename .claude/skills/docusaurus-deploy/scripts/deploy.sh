#!/usr/bin/env bash
# docusaurus-deploy/scripts/deploy.sh
# Initializes Docusaurus and deploys to GitHub Pages, Vercel, or Netlify.
# Usage: bash deploy.sh <site_name> [target] [org] [repo]
# Returns: "✓ Done" on success

set -euo pipefail

SITE_NAME="${1}"
TARGET="${2:-github-pages}"
ORG="${3:-}"
REPO="${4:-}"

log() { echo "  [docusaurus] $*"; }

SITE_DIR="${SITE_NAME}"

# ── 1. Scaffold Docusaurus 3 ──────────────────────────────────────────────────
log "Scaffolding Docusaurus 3 site: ${SITE_NAME}..."

npx create-docusaurus@latest "${SITE_DIR}" classic --typescript --skip-install > /dev/null 2>&1

cd "${SITE_DIR}"
npm install > /dev/null 2>&1

# ── 2. Configure docusaurus.config.ts ─────────────────────────────────────────
log "Configuring docusaurus.config.ts..."

if [[ "$TARGET" == "github-pages" && -n "$ORG" && -n "$REPO" ]]; then
  BASE_URL="/${REPO}/"
  SITE_URL="https://${ORG}.github.io"
else
  BASE_URL="/"
  SITE_URL="https://${SITE_NAME}.example.com"
fi

cat > docusaurus.config.ts << CONFEOF
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "${SITE_NAME}",
  tagline: "Documentation",
  favicon: "img/favicon.ico",

  url: "${SITE_URL}",
  baseUrl: "${BASE_URL}",

  organizationName: "${ORG:-myorg}",
  projectName: "${REPO:-${SITE_NAME}}",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "${SITE_URL}/${ORG:-myorg}/${REPO:-${SITE_NAME}}/tree/main/",
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        blog: {
          showReadingTime: true,
          feedOptions: { type: ["rss", "atom"] },
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "${SITE_NAME}",
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
        },
        { to: "/blog", label: "Blog", position: "left" },
        {
          href: "${SITE_URL}/${ORG:-myorg}/${REPO:-${SITE_NAME}}",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      copyright: \`Copyright © \${new Date().getFullYear()} ${SITE_NAME}.\`,
    },
    prism: {
      additionalLanguages: ["python", "bash", "yaml", "json", "typescript"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
CONFEOF

# ── 3. Write GitHub Actions workflow ──────────────────────────────────────────
if [[ "$TARGET" == "github-pages" ]]; then
  log "Writing GitHub Pages deployment workflow..."
  mkdir -p .github/workflows

  cat > .github/workflows/deploy-docs.yml << YAEOF
name: Deploy Docusaurus to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
YAEOF

elif [[ "$TARGET" == "vercel" ]]; then
  log "Writing Vercel config..."
  cat > vercel.json << 'VEOF'
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": null
}
VEOF

elif [[ "$TARGET" == "netlify" ]]; then
  log "Writing Netlify config..."
  cat > netlify.toml << 'NEOF'
[build]
  command = "npm run build"
  publish = "build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
NEOF
fi

# ── 4. Write sample docs ──────────────────────────────────────────────────────
log "Writing sample documentation..."

mkdir -p docs/getting-started docs/api

cat > docs/intro.md << 'MDEOF'
---
sidebar_position: 1
---

# Introduction

Welcome to the documentation. Get started below.
MDEOF

cat > docs/getting-started/installation.md << 'MDEOF'
---
sidebar_position: 1
---

# Installation

## Prerequisites

- Node.js 18+
- Git

## Install

```bash
npm install
npm run dev
```
MDEOF

# ── 5. Build and verify ───────────────────────────────────────────────────────
log "Building site to verify configuration..."
npm run build > /dev/null 2>&1 && log "Build successful." || {
  echo "  Build failed. Check docusaurus.config.ts for errors."
  exit 1
}

cd - > /dev/null

echo ""
echo "  Docusaurus site ready: ${SITE_DIR}/"
echo "  Target: ${TARGET}"
if [[ "$TARGET" == "github-pages" && -n "$ORG" && -n "$REPO" ]]; then
  echo "  URL: https://${ORG}.github.io/${REPO}/"
  echo ""
  echo "  Enable GitHub Pages:"
  echo "  Repo → Settings → Pages → Source: GitHub Actions"
fi
echo ""
echo "  Local dev: cd ${SITE_DIR} && npm start"
echo ""
echo "✓ Done"
