---
name: nextjs-k8s-deploy
version: 1.0.0
description: Containerize and deploy a Next.js app to Kubernetes with ingress and TLS
triggers:
  - "deploy nextjs"
  - "nextjs kubernetes"
  - "deploy next.js k8s"
  - "k8s nextjs"
parameters:
  - name: app_name
    description: Application name (used for k8s resource names)
    required: true
  - name: image_repo
    description: Container image repository (e.g. ghcr.io/org/app)
    required: true
  - name: domain
    description: Domain for ingress (e.g. app.example.com)
    required: true
  - name: namespace
    description: Kubernetes namespace
    default: default
  - name: replicas
    description: Number of pod replicas
    default: "2"
script: scripts/deploy.sh
# ~100 tokens
---

## Usage

```
/nextjs-k8s-deploy app_name=learnflow image_repo=ghcr.io/org/app domain=app.example.com
```

## What it does

1. Generates production Dockerfile (standalone output mode)
2. Creates k8s Deployment, Service, HPA manifests
3. Configures Ingress with cert-manager TLS annotation
4. Creates GitHub Actions workflow for CI/CD
5. Applies manifests and waits for rollout
