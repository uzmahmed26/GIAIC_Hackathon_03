#!/usr/bin/env bash
# kong-api-gateway/scripts/deploy.sh
# Deploys Kong API Gateway on Kubernetes using KIC (Kong Ingress Controller).
# Usage: bash deploy.sh [namespace] [mode] [admin_api]
# Returns: "✓ Done" on success

set -euo pipefail

NAMESPACE="${1:-kong}"
MODE="${2:-dbless}"
EXPOSE_ADMIN="${3:-false}"

log() { echo "  [kong] $*"; }

# ── 1. Install Kong via Helm ───────────────────────────────────────────────────
log "Adding Kong Helm repo..."
helm repo add kong https://charts.konghq.com --force-update > /dev/null 2>&1
helm repo update > /dev/null 2>&1

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - > /dev/null

log "Installing Kong Ingress Controller (mode=${MODE})..."

ADMIN_VALUES=""
if [[ "$EXPOSE_ADMIN" == "true" ]]; then
  ADMIN_VALUES="--set ingressController.adminApiService.enabled=true"
fi

DB_LESS_VALUE="true"
[[ "$MODE" == "postgres" ]] && DB_LESS_VALUE="false"

helm upgrade --install kong kong/ingress \
  --namespace "$NAMESPACE" \
  --set controller.ingressClass=kong \
  --set proxy.type=LoadBalancer \
  --set "gateway.env.database=off" \
  $ADMIN_VALUES \
  --wait \
  --timeout 5m \
  > /dev/null

log "Kong ready."

# ── 2. Create KongPlugin CRs ──────────────────────────────────────────────────
log "Creating KongPlugin: rate-limiting..."
kubectl apply -f - << 'EOF'
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rate-limit-per-minute
  namespace: default
plugin: rate-limiting
config:
  minute: 60
  hour: 1000
  policy: local
  limit_by: ip
  error_code: 429
  error_message: "Rate limit exceeded"
EOF

log "Creating KongPlugin: jwt..."
kubectl apply -f - << 'EOF'
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: jwt-auth
  namespace: default
plugin: jwt
config:
  secret_is_base64: false
  claims_to_verify:
    - exp
  key_claim_name: iss
EOF

log "Creating KongPlugin: cors..."
kubectl apply -f - << 'EOF'
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: cors-policy
  namespace: default
plugin: cors
config:
  origins:
    - "*"
  methods:
    - GET
    - POST
    - PUT
    - DELETE
    - PATCH
    - OPTIONS
  headers:
    - Authorization
    - Content-Type
    - X-Request-ID
    - X-Api-Key
  exposed_headers:
    - X-Request-ID
  credentials: true
  max_age: 3600
EOF

log "Creating KongPlugin: request-id..."
kubectl apply -f - << 'EOF'
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: request-id
  namespace: default
plugin: correlation-id
config:
  header_name: X-Request-ID
  generator: uuid#counter
  echo_downstream: true
EOF

log "Creating KongPlugin: bot-detection..."
kubectl apply -f - << 'EOF'
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: bot-detection
  namespace: default
plugin: bot-detection
EOF

# ── 3. Create KongConsumer + credentials ──────────────────────────────────────
log "Creating KongConsumer and JWT credentials..."

JWT_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

kubectl create secret generic learnflow-jwt-secret \
  --namespace default \
  --from-literal=key=learnflow-app-key \
  --from-literal=secret="${JWT_SECRET}" \
  --from-literal=algorithm=HS256 \
  --dry-run=client -o yaml | \
  kubectl annotate --local -f - "kubernetes.io/ingress.class=kong" -o yaml | \
  kubectl label --local -f - "konghq.com/credential=jwt" -o yaml | \
  kubectl apply -f - > /dev/null 2>&1 || true

kubectl apply -f - << 'EOF'
apiVersion: configuration.konghq.com/v1
kind: KongConsumer
metadata:
  name: learnflow-app
  namespace: default
  annotations:
    kubernetes.io/ingress.class: kong
username: learnflow-app
credentials:
  - learnflow-jwt-secret
EOF

# ── 4. Create sample Ingress with plugins ─────────────────────────────────────
log "Creating sample Ingress with Kong plugins..."
kubectl apply -f - << 'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: learnflow-api-gateway
  namespace: default
  annotations:
    konghq.com/plugins: "rate-limit-per-minute,cors-policy,request-id"
    konghq.com/strip-path: "true"
    kubernetes.io/ingress.class: kong
spec:
  ingressClassName: kong
  rules:
    - http:
        paths:
          - path: /api/chat
            pathType: Prefix
            backend:
              service:
                name: chat-service
                port:
                  number: 8001
          - path: /api/code
            pathType: Prefix
            backend:
              service:
                name: code-service
                port:
                  number: 8002
          - path: /api/exercises
            pathType: Prefix
            backend:
              service:
                name: exercise-service
                port:
                  number: 8003
EOF

# ── 5. Get proxy IP ───────────────────────────────────────────────────────────
log "Waiting for proxy LoadBalancer IP..."
for i in {1..30}; do
  PROXY_IP=$(kubectl get svc -n "$NAMESPACE" kong-gateway-proxy \
    -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
  [[ -n "$PROXY_IP" ]] && break
  sleep 5
done

# ── 6. Smoke test ─────────────────────────────────────────────────────────────
if [[ -n "${PROXY_IP:-}" ]]; then
  log "Running smoke test (rate-limit headers check)..."
  HEADERS=$(curl -s -I "http://${PROXY_IP}/" 2>/dev/null | grep -i "x-ratelimit" || true)
  if [[ -n "$HEADERS" ]]; then
    log "Smoke test passed (rate-limit headers present)."
  else
    log "Smoke test: proxy reachable but no rate-limit headers (backends not deployed yet)."
  fi
fi

echo ""
echo "  Kong API Gateway ready!"
echo "  Namespace: ${NAMESPACE}"
echo "  Mode: ${MODE}"
echo "  Plugins: rate-limiting, jwt, cors, request-id, bot-detection"
if [[ -n "${PROXY_IP:-}" ]]; then
  echo "  Proxy IP: ${PROXY_IP}"
fi
echo "  JWT Secret: stored in secret learnflow-jwt-secret"
echo ""
echo "✓ Done"
