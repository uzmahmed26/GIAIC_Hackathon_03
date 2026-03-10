---
name: argocd-gitops
version: 1.0.0
description: Install ArgoCD and bootstrap GitOps workflow with App of Apps pattern
triggers:
  - "setup argocd"
  - "argocd gitops"
  - "gitops bootstrap"
  - "argo cd"
parameters:
  - name: namespace
    description: Kubernetes namespace for ArgoCD
    default: argocd
  - name: repo_url
    description: Git repo URL for GitOps manifests
    required: true
  - name: repo_path
    description: Path within repo for app manifests
    default: k8s/apps
  - name: cluster_url
    description: Target cluster URL
    default: https://kubernetes.default.svc
script: scripts/deploy.sh
# ~95 tokens
---

## Usage

```
/argocd-gitops repo_url=https://github.com/org/gitops repo_path=k8s/apps
```

## What it does

1. Installs ArgoCD via Helm with HA config
2. Creates root Application (App of Apps pattern)
3. Configures repo credentials Secret
4. Sets up RBAC and SSO (Dex) config
5. Returns ArgoCD UI URL and initial admin password
