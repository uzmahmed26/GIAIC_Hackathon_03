# docusaurus-deploy Reference

## Overview

Scaffolds a Docusaurus 3 documentation site and deploys it to GitHub Pages, Vercel, or Netlify. Docusaurus is the standard for open-source project documentation (used by React, Jest, Redwood, etc.).

## Generated Structure

```
learnflow-docs/
├── docs/
│   ├── intro.md
│   ├── getting-started/
│   │   ├── installation.md
│   │   └── quick-start.md
│   └── api/
│       └── overview.md
├── blog/
│   └── 2024-01-01-welcome.md
├── src/
│   ├── components/
│   │   └── HomepageFeatures/
│   ├── css/
│   │   └── custom.css
│   └── pages/
│       └── index.tsx
├── static/
│   └── img/
├── docusaurus.config.ts
├── sidebars.ts
└── package.json
```

## docusaurus.config.ts

```typescript
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "LearnFlow Docs",
  tagline: "AI-powered Python tutoring platform",
  favicon: "img/favicon.ico",

  url: "https://myorg.github.io",
  baseUrl: "/docs/",

  organizationName: "myorg",
  projectName: "docs",

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
          editUrl: "https://github.com/myorg/docs/tree/main/",
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
          },
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "LearnFlow",
      logo: { alt: "LearnFlow Logo", src: "img/logo.svg" },
      items: [
        { type: "docSidebar", sidebarId: "docs", position: "left", label: "Docs" },
        { to: "/blog", label: "Blog", position: "left" },
        {
          href: "https://github.com/myorg/learnflow",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      copyright: `Copyright © ${new Date().getFullYear()} LearnFlow. Built with Docusaurus.`,
    },
    prism: {
      additionalLanguages: ["python", "bash", "yaml", "json"],
    },
    algolia: {
      // Enable DocSearch for full-text search
      appId: "YOUR_APP_ID",
      apiKey: "YOUR_SEARCH_API_KEY",
      indexName: "learnflow",
    },
  },
};

export default config;
```

## GitHub Pages Workflow

```yaml
# .github/workflows/deploy-docs.yml
name: Deploy Docusaurus to GitHub Pages

on:
  push:
    branches: [main]
    paths: ["docs/**", "blog/**", "src/**", "docusaurus.config.ts"]
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
          fetch-depth: 0  # Full history for lastUpdated

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
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## Vercel Deployment

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": null
}
```

```bash
# One-time setup
npm i -g vercel
vercel --prod
```

## Custom CSS (Catppuccin Mocha theme)

```css
/* src/css/custom.css */
:root {
  --ifm-color-primary: #6366f1;
  --ifm-color-primary-dark: #4f46e5;
  --ifm-background-color: #1e1e2e;
  --ifm-navbar-background-color: #181825;
  --ifm-footer-background-color: #181825;
  --ifm-code-font-size: 90%;
  --docusaurus-highlighted-code-line-bg: rgba(99, 102, 241, 0.1);
}
```

## Versioned Docs

```bash
# Snapshot current docs as version 1.0.0
npm run docusaurus docs:version 1.0.0
```

This creates `versioned_docs/version-1.0.0/` and `versioned_sidebars/`.

## Troubleshooting

**Build fails with broken links**
```bash
npm run build 2>&1 | grep "Broken link"
# Fix all broken internal links before deploying
```

**GitHub Pages shows 404**
```bash
# Check baseUrl in docusaurus.config.ts
# For username.github.io/repo: baseUrl: "/repo/"
# For username.github.io: baseUrl: "/"
```

**Search not working**
- DocSearch requires applying at algolia.com/docsearch
- Local dev alternative: `@docusaurus/plugin-search-local`
