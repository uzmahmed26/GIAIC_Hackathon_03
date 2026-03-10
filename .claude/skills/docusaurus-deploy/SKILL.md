---
name: docusaurus-deploy
version: 1.0.0
description: Initialize Docusaurus site and deploy to GitHub Pages or Vercel
triggers:
  - "deploy docusaurus"
  - "create docs site"
  - "docusaurus github pages"
  - "docusaurus deploy"
parameters:
  - name: site_name
    description: Name of the documentation site
    required: true
  - name: target
    description: "Deploy target: github-pages | vercel | netlify"
    default: github-pages
  - name: org
    description: GitHub org or username (required for github-pages)
    default: ""
  - name: repo
    description: GitHub repo name (required for github-pages)
    default: ""
script: scripts/deploy.sh
# ~95 tokens
---

## Usage

```
/docusaurus-deploy site_name=learnflow-docs target=github-pages org=myorg repo=docs
```

## What it does

1. Scaffolds Docusaurus 3 site with custom theme config
2. Configures `docusaurus.config.ts` with org/repo settings
3. Creates GitHub Actions workflow for automated deployment
4. Adds `docs/`, `blog/`, and sidebar config
5. Deploys and returns the live URL
