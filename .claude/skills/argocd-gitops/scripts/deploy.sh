#!/usr/bin/env bash
# argocd-gitops/scripts/deploy.sh
# Installs ArgoCD and bootstraps GitOps with App of Apps pattern.
# Usage: bash deploy.sh [namespace] <repo_url> [repo_path] [cluster_url]
# Returns: "✓ Done" on success

set -euo pipefail

NAMESPACE="${1:-argocd}"
REPO_URL="${2}"
REPO_PATH="${3:-k8s/apps}"
CLUSTER_URL="${4:-https://kubernetes.default.svc}"

log() { echo "  [argocd] $*"; }

# ── 1. Install ArgoCD via Helm ────────────────────────────────────────────────
log "Adding Argo Helm repo..."
helm repo add argo https://argoproj.github.io/argo-helm --force-update > /dev/null 2>&1
helm repo update > /dev/null 2>&1

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - > /dev/null

log "Installing ArgoCD in namespace ${NAMESPACE}..."

cat > /tmp/argocd-values.yaml << VALEOF
global:
  domain: argocd.example.com

server:
  insecure: false
  ingress:
    enabled: false  # Enable manually when ingress controller is ready

configs:
  params:
    server.insecure: "false"
  cm:
    admin.enabled: "true"
    url: "https://argocd.example.com"
  rbac:
    policy.default: role:readonly
    policy.csv: |
      p, role:admin, *, *, */*, allow
      g, admins, role:admin

# HA replicas
applicationSet:
  replicas: 1
repoServer:
  replicas: 1
VALEOF

helm upgrade --install argocd argo/argo-cd \
  --namespace "$NAMESPACE" \
  --values /tmp/argocd-values.yaml \
  --wait \
  --timeout 10m \
  > /dev/null

log "ArgoCD installed."

# ── 2. Configure repo credentials ────────────────────────────────────────────
log "Configuring repository credentials..."

# Extract domain from URL for display
REPO_DOMAIN=$(echo "$REPO_URL" | sed 's|https://||;s|http://||;s|/.*||')

# Create repo secret
kubectl apply -f - << EOF
apiVersion: v1
kind: Secret
metadata:
  name: gitops-repo
  namespace: ${NAMESPACE}
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  url: ${REPO_URL}
  # Set username/password via: kubectl edit secret gitops-repo -n ${NAMESPACE}
  # Or use SSH key: add sshPrivateKey field
EOF

# ── 3. Create root Application (App of Apps) ──────────────────────────────────
log "Creating root Application (App of Apps)..."

kubectl apply -f - << EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root
  namespace: ${NAMESPACE}
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  annotations:
    argocd.argoproj.io/sync-wave: "0"
spec:
  project: default
  source:
    repoURL: ${REPO_URL}
    targetRevision: HEAD
    path: ${REPO_PATH}
  destination:
    server: ${CLUSTER_URL}
    namespace: ${NAMESPACE}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
EOF

# ── 4. Create example child Applications ─────────────────────────────────────
log "Writing example child Application templates to /tmp/argocd-examples/..."
mkdir -p /tmp/argocd-examples

cat > /tmp/argocd-examples/chat-service.yaml << APPEOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: chat-service
  namespace: ${NAMESPACE}
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: ${REPO_URL}
    targetRevision: HEAD
    path: k8s/services/chat-service
  destination:
    server: ${CLUSTER_URL}
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
APPEOF

cat > /tmp/argocd-examples/infrastructure.yaml << APPEOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: infrastructure
  namespace: ${NAMESPACE}
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: ${REPO_URL}
    targetRevision: HEAD
    path: k8s/infrastructure
  destination:
    server: ${CLUSTER_URL}
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 3
      backoff:
        duration: 10s
        factor: 2
        maxDuration: 5m
APPEOF

# ── 5. Get admin password ─────────────────────────────────────────────────────
log "Fetching initial admin password..."
ADMIN_PASS=$(kubectl -n "$NAMESPACE" get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" 2>/dev/null | base64 -d 2>/dev/null || echo "<not-available>")

# ── 6. Wait for root app to sync ─────────────────────────────────────────────
log "Waiting for root Application to sync..."
for i in {1..30}; do
  STATUS=$(kubectl get application root -n "$NAMESPACE" \
    -o jsonpath='{.status.sync.status}' 2>/dev/null || echo "Unknown")
  if [[ "$STATUS" == "Synced" ]]; then
    log "Root application synced."
    break
  fi
  sleep 5
done

echo ""
echo "  ArgoCD GitOps ready!"
echo "  Namespace: ${NAMESPACE}"
echo "  Git repo: ${REPO_URL}"
echo "  Apps path: ${REPO_PATH}"
echo ""
echo "  Admin password: ${ADMIN_PASS}"
echo "  (Stored in: kubectl get secret argocd-initial-admin-secret -n ${NAMESPACE})"
echo ""
echo "  Port-forward UI:"
echo "  kubectl port-forward svc/argocd-server -n ${NAMESPACE} 8080:443"
echo "  Then open: https://localhost:8080 (admin / <password above>)"
echo ""
echo "  Example child Application YAMLs:"
echo "  ls /tmp/argocd-examples/"
echo "  (Copy to your GitOps repo at: ${REPO_PATH}/)"
echo ""
echo "✓ Done"
