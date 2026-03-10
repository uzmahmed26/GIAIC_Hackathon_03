# argocd-gitops Reference

## Overview

Installs ArgoCD and bootstraps a GitOps workflow using the App of Apps pattern. All application state is declared in Git; ArgoCD continuously reconciles the cluster to match the desired state.

## App of Apps Pattern

```
Git Repo: k8s/apps/
├── root-app.yaml          ← Root Application (bootstrapped manually once)
├── chat-service.yaml      ← Application CR for chat-service
├── code-service.yaml      ← Application CR for code-service
├── postgres.yaml          ← Application CR for PostgreSQL
└── monitoring.yaml        ← Application CR for Prometheus/Grafana

Each child Application CR points to its own manifests directory.
ArgoCD watches ALL of them automatically.
```

## Installation

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

helm upgrade --install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  --values argocd-values.yaml \
  --wait
```

## Helm Values (argocd-values.yaml)

```yaml
global:
  domain: argocd.example.com

server:
  ingress:
    enabled: true
    ingressClassName: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
    tls: true

configs:
  params:
    server.insecure: false  # Always use TLS

  cm:
    url: https://argocd.example.com
    admin.enabled: "true"
    # Enable SSO via GitHub (optional)
    dex.config: |
      connectors:
        - type: github
          id: github
          name: GitHub
          config:
            clientID: $dex.github.clientID
            clientSecret: $dex.github.clientSecret
            orgs:
              - name: myorg

  rbac:
    policy.default: role:readonly
    policy.csv: |
      p, role:admin, *, *, */*, allow
      g, myorg:devops, role:admin

repoServer:
  replicas: 2  # HA

applicationSet:
  replicas: 2  # HA
```

## Root Application CR

```yaml
# k8s/apps/root-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/gitops
    targetRevision: HEAD
    path: k8s/apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true      # Delete resources removed from Git
      selfHeal: true   # Revert manual kubectl changes
    syncOptions:
      - CreateNamespace=true
```

## Child Application CR Example

```yaml
# k8s/apps/chat-service.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: chat-service
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/gitops
    targetRevision: HEAD
    path: k8s/services/chat-service
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

## Repository Credentials Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: gitops-repo-creds
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  url: https://github.com/myorg/gitops
  username: github-token
  password: ghp_xxxxxxxxxxxxxxxxxxxx
```

## Bootstrapping

```bash
# 1. Install ArgoCD
helm upgrade --install argocd argo/argo-cd -n argocd --create-namespace ...

# 2. Apply repo credentials
kubectl apply -f gitops-repo-creds-secret.yaml

# 3. Bootstrap root app (one-time only)
kubectl apply -f k8s/apps/root-app.yaml

# ArgoCD now manages everything else automatically
```

## Getting Admin Password

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

## CLI Usage

```bash
argocd login argocd.example.com

# List all apps
argocd app list

# Sync manually
argocd app sync chat-service

# Check diff
argocd app diff chat-service

# Rollback
argocd app rollback chat-service 1
```

## Notifications (Slack)

```yaml
# In argocd-values.yaml notifications section
notifications:
  enabled: true
  secret:
    create: true
    items:
      slack-token: xoxb-xxxx

  cm:
    service.slack: |
      token: $slack-token
    trigger.on-sync-failed: |
      - when: app.status.sync.status == 'Unknown'
        send: [app-sync-failed]
    template.app-sync-failed: |
      message: |
        App {{.app.metadata.name}} sync failed!
        Repo: {{.app.spec.source.repoURL}}
      slack:
        attachments: |
          [{"color": "danger", "title": "{{.app.metadata.name}}"}]
```

## Troubleshooting

**App stuck in OutOfSync**
```bash
argocd app diff my-app
# Look for resource type mismatches or annotation drift
kubectl -n argocd logs deploy/argocd-application-controller | grep ERROR
```

**Sync failing (resource conflict)**
```bash
argocd app sync my-app --force
# Or delete and re-create: argocd app delete my-app --cascade=false
```

**Webhook not triggering**
```bash
# Add webhook in GitHub: Settings > Webhooks
# URL: https://argocd.example.com/api/webhook
# Secret: from argocd-secret.webhook.github.secret
```
