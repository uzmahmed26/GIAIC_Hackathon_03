#!/usr/bin/env bash
# deploy.sh -- Master deployment script for LearnFlow on Kubernetes (minikube).
# Usage: ./k8s/deploy.sh [--skip-kafka] [--skip-postgres] [--skip-images]
# Idempotent: safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS="$ROOT/.claude/skills"
K8S="$ROOT/k8s"
SCRIPTS="$ROOT/scripts"

GREEN="\033[92m"
RED="\033[91m"
YELLOW="\033[93m"
BOLD="\033[1m"
RESET="\033[0m"

SKIP_KAFKA=false
SKIP_POSTGRES=false
SKIP_IMAGES=false

for arg in "$@"; do
  case $arg in
    --skip-kafka)    SKIP_KAFKA=true ;;
    --skip-postgres) SKIP_POSTGRES=true ;;
    --skip-images)   SKIP_IMAGES=true ;;
  esac
done

step() { echo -e "\n${BOLD}${GREEN}==> STEP $1: $2${RESET}"; }
info() { echo -e "    ${YELLOW}$1${RESET}"; }
die()  { echo -e "${RED}FATAL: $1${RESET}"; exit 1; }

# ── Preflight ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}LearnFlow Kubernetes Deployment${RESET}"
echo "========================================"

command -v kubectl  >/dev/null || die "kubectl not found"
command -v minikube >/dev/null || die "minikube not found"
command -v helm     >/dev/null || die "helm not found"
command -v python3  >/dev/null || die "python3 not found"

# Ensure minikube is running
if ! minikube status | grep -q "Running"; then
  info "Starting minikube..."
  minikube start --cpus=4 --memory=8192 --driver=docker
fi

# ── STEP 1: Kafka ───────────────────────────────────────────────────────────────
if [ "$SKIP_KAFKA" = false ]; then
  step 1 "Deploy Kafka (Strimzi)"
  bash "$SKILLS/kafka-k8s-setup/scripts/deploy.sh"

  info "Creating Kafka topics..."
  python3 "$SKILLS/kafka-k8s-setup/scripts/create_topics.py"

  info "Verifying Kafka..."
  python3 "$SKILLS/kafka-k8s-setup/scripts/verify.py"
else
  info "Skipping Kafka (--skip-kafka)"
fi

# ── STEP 2: PostgreSQL ──────────────────────────────────────────────────────────
if [ "$SKIP_POSTGRES" = false ]; then
  step 2 "Deploy PostgreSQL (CloudNativePG)"
  bash "$SKILLS/postgres-k8s-setup/scripts/deploy.sh"

  info "Running migrations..."
  python3 "$SKILLS/postgres-k8s-setup/scripts/run_migrations.py"

  info "Seeding data..."
  python3 "$SKILLS/postgres-k8s-setup/scripts/seed_data.py"

  info "Verifying PostgreSQL..."
  python3 "$SKILLS/postgres-k8s-setup/scripts/verify.py"
else
  info "Skipping PostgreSQL (--skip-postgres)"
fi

# ── STEP 3: Dapr ────────────────────────────────────────────────────────────────
step 3 "Install Dapr on Kubernetes"

if ! helm repo list 2>/dev/null | grep -q dapr; then
  helm repo add dapr https://dapr.github.io/helm-charts/
  helm repo update
fi

if ! kubectl get namespace dapr-system &>/dev/null; then
  helm upgrade --install dapr dapr/dapr \
    --namespace dapr-system \
    --create-namespace \
    --set global.mtls.enabled=false \
    --wait --timeout=5m
  info "Dapr installed"
else
  info "Dapr already installed"
fi

# Apply Dapr components
kubectl apply -f "$K8S/dapr/components.yaml"
info "Dapr components applied"

# ── STEP 4: Namespace & Secrets ─────────────────────────────────────────────────
step 4 "Create learnflow namespace and secrets"
kubectl apply -f "$K8S/base/namespace.yaml"

# Create secret (update values for production)
if ! kubectl get secret learnflow-secrets -n learnflow &>/dev/null; then
  kubectl create secret generic learnflow-secrets \
    --namespace learnflow \
    --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY:-sk-placeholder}" \
    --from-literal=DATABASE_URL="postgresql://learnflow:learnflow@learnflow-postgres-rw.postgres.svc.cluster.local:5432/learnflow" \
    --from-literal=SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  info "Secret created"
else
  info "Secret already exists"
fi

# Apply Redis
kubectl apply -f "$K8S/base/redis.yaml"

# ── STEP 5: Build Docker images ─────────────────────────────────────────────────
if [ "$SKIP_IMAGES" = false ]; then
  step 5 "Build Docker images in minikube"
  eval "$(minikube docker-env)"

  SERVICES=(
    "triage-agent:backend/triage-agent"
    "concepts-agent:backend/concepts-agent"
    "debug-agent:backend/debug-agent"
    "exercise-agent:backend/exercise-agent"
    "progress-agent:backend/progress-agent"
    "frontend:frontend"
  )

  for entry in "${SERVICES[@]}"; do
    name="${entry%%:*}"
    ctx="${entry##*:}"
    info "Building learnflow/$name:latest from $ctx..."
    docker build -t "learnflow/$name:latest" "$ROOT/$ctx"
    echo -e "    ${GREEN}Built learnflow/$name:latest${RESET}"
  done
else
  info "Skipping image builds (--skip-images)"
fi

# ── STEP 6: Apply Kubernetes manifests ──────────────────────────────────────────
step 6 "Apply all Kubernetes manifests"

for manifest in \
  "$K8S/base/triage-agent.yaml" \
  "$K8S/base/concepts-agent.yaml" \
  "$K8S/base/debug-agent.yaml" \
  "$K8S/base/exercise-agent.yaml" \
  "$K8S/base/progress-agent.yaml" \
  "$K8S/base/frontend.yaml"
do
  kubectl apply -f "$manifest"
  info "Applied $(basename "$manifest")"
done

# ── STEP 7: Wait for rollout ────────────────────────────────────────────────────
step 7 "Wait for rollouts to complete"

DEPLOYMENTS=(triage-agent concepts-agent debug-agent exercise-agent progress-agent frontend)
for dep in "${DEPLOYMENTS[@]}"; do
  info "Waiting for $dep..."
  kubectl rollout status deployment/"$dep" -n learnflow --timeout=3m || true
done

info "Verifying full deployment..."
python3 "$SCRIPTS/verify_full_deployment.py" --skip-health

# ── STEP 8: Expose frontend ─────────────────────────────────────────────────────
step 8 "Expose frontend"

echo ""
echo -e "${BOLD}Access Methods:${RESET}"

# NodePort
MINIKUBE_IP=$(minikube ip)
echo -e "  NodePort URL  : ${GREEN}http://$MINIKUBE_IP:30080${RESET}"

# Minikube service tunnel (background)
echo -e "  Tunnel URL    : run  ${YELLOW}minikube service frontend -n learnflow --url${RESET}"

# Ingress (if minikube ingress addon enabled)
if minikube addons list | grep -q "ingress: enabled"; then
  echo -e "  Ingress       : http://learnflow.local  (add $MINIKUBE_IP learnflow.local to /etc/hosts)"
fi

echo ""
echo -e "${BOLD}${GREEN}LearnFlow deployment complete!${RESET}"
echo ""
echo "Useful commands:"
echo "  kubectl get pods -n learnflow"
echo "  kubectl logs -n learnflow deployment/triage-agent -c triage-agent -f"
echo "  python3 scripts/verify_full_deployment.py"
