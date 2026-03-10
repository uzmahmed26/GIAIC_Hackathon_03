#!/usr/bin/env bash
# nextjs-k8s-deploy/scripts/deploy.sh
# Containerizes and deploys a Next.js app to Kubernetes.
# Usage: bash deploy.sh <app_name> <image_repo> <domain> [namespace] [replicas]
# Returns: "✓ Done" on success

set -euo pipefail

APP_NAME="${1}"
IMAGE_REPO="${2}"
DOMAIN="${3}"
NAMESPACE="${4:-default}"
REPLICAS="${5:-2}"
PORT="3000"

log() { echo "  [nextjs-k8s] $*"; }

# ── 1. Generate Dockerfile ────────────────────────────────────────────────────
log "Generating Dockerfile (standalone mode)..."

cat > Dockerfile << 'DEOF'
# ── deps ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── builder ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── runner (minimal) ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
DEOF

# Ensure next.config has output: standalone
if [[ -f "next.config.ts" ]]; then
  if ! grep -q 'standalone' "next.config.ts"; then
    log "Adding output: standalone to next.config.ts..."
    sed -i '/const nextConfig/a\  output: "standalone",' next.config.ts
  fi
elif [[ -f "next.config.js" ]]; then
  if ! grep -q 'standalone' "next.config.js"; then
    log "Adding output: standalone to next.config.js..."
    sed -i '/const nextConfig/a\  output: "standalone",' next.config.js
  fi
fi

# ── .dockerignore ─────────────────────────────────────────────────────────────
cat > .dockerignore << 'IGEOF'
node_modules
.next
.git
.env*
coverage
*.md
.dockerignore
Dockerfile
IGEOF

# ── 2. Create k8s directory ───────────────────────────────────────────────────
mkdir -p k8s

# ── Deployment ────────────────────────────────────────────────────────────────
log "Writing Kubernetes manifests..."

cat > k8s/deployment.yaml << YEOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${APP_NAME}
  namespace: ${NAMESPACE}
  labels:
    app: ${APP_NAME}
spec:
  replicas: ${REPLICAS}
  selector:
    matchLabels:
      app: ${APP_NAME}
  template:
    metadata:
      labels:
        app: ${APP_NAME}
    spec:
      containers:
        - name: ${APP_NAME}
          image: ${IMAGE_REPO}:latest
          ports:
            - containerPort: ${PORT}
          env:
            - name: NODE_ENV
              value: production
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /api/health
              port: ${PORT}
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /api/health
              port: ${PORT}
            initialDelaySeconds: 30
            periodSeconds: 15
---
apiVersion: v1
kind: Service
metadata:
  name: ${APP_NAME}
  namespace: ${NAMESPACE}
spec:
  selector:
    app: ${APP_NAME}
  ports:
    - port: ${PORT}
      targetPort: ${PORT}
      name: http
YEOF

# ── HPA ───────────────────────────────────────────────────────────────────────
cat > k8s/hpa.yaml << YEOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${APP_NAME}-hpa
  namespace: ${NAMESPACE}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${APP_NAME}
  minReplicas: ${REPLICAS}
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
YEOF

# ── Ingress ───────────────────────────────────────────────────────────────────
cat > k8s/ingress.yaml << YEOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${APP_NAME}-ingress
  namespace: ${NAMESPACE}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: 10m
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - ${DOMAIN}
      secretName: ${APP_NAME}-tls
  rules:
    - host: ${DOMAIN}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${APP_NAME}
                port:
                  number: ${PORT}
YEOF

# ── 3. GitHub Actions workflow ────────────────────────────────────────────────
log "Writing GitHub Actions CI/CD workflow..."
mkdir -p .github/workflows

cat > .github/workflows/deploy.yml << YAEOF
name: Deploy to Kubernetes

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${IMAGE_REPO}:latest
            ${IMAGE_REPO}:\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Set up kubectl
        uses: azure/setup-kubectl@v4

      - name: Configure kubeconfig
        run: |
          mkdir -p ~/.kube
          echo "\${{ secrets.KUBECONFIG }}" | base64 -d > ~/.kube/config

      - name: Deploy
        run: |
          kubectl set image deployment/${APP_NAME} \\
            ${APP_NAME}=${IMAGE_REPO}:\${{ github.sha }} \\
            -n ${NAMESPACE}
          kubectl rollout status deployment/${APP_NAME} \\
            -n ${NAMESPACE} --timeout=5m
YAEOF

# ── 4. Apply manifests ────────────────────────────────────────────────────────
log "Applying Kubernetes manifests..."
kubectl apply -f k8s/

log "Waiting for rollout..."
kubectl rollout status deployment/"${APP_NAME}" -n "${NAMESPACE}" --timeout=5m

echo ""
echo "  Deployment complete!"
echo "  App: ${APP_NAME}"
echo "  URL: https://${DOMAIN}"
echo "  Namespace: ${NAMESPACE}"
echo "  Image: ${IMAGE_REPO}:latest"
echo ""
echo "✓ Done"
