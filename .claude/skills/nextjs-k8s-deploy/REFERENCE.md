# nextjs-k8s-deploy Reference

## Overview

Deploys a Next.js application to Kubernetes with production best practices: standalone output mode for minimal Docker images, Horizontal Pod Autoscaler, cert-manager TLS, and GitHub Actions CI/CD.

## Dockerfile (Standalone Mode)

```dockerfile
# Stage 1: deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: runner (minimal image)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone output — only what's needed to run
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

**Required `next.config.ts`:**
```typescript
const nextConfig = {
  output: "standalone",  // Enables minimal standalone build
};
export default nextConfig;
```

## Kubernetes Manifests

### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: learnflow
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: learnflow
  template:
    metadata:
      labels:
        app: learnflow
    spec:
      containers:
        - name: learnflow
          image: ghcr.io/org/learnflow:latest
          ports:
            - containerPort: 3000
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
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 15
```

### HorizontalPodAutoscaler
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: learnflow-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: learnflow
  minReplicas: 2
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
```

### Ingress with TLS
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: learnflow-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.example.com
      secretName: learnflow-tls
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: learnflow
                port:
                  number: 3000
```

## GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
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

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/learnflow \
            learnflow=ghcr.io/${{ github.repository }}:${{ github.sha }}
          kubectl rollout status deployment/learnflow --timeout=5m
        env:
          KUBECONFIG_DATA: ${{ secrets.KUBECONFIG }}
```

## Troubleshooting

**Image too large**
- Ensure `output: "standalone"` in `next.config.ts`
- Check `.dockerignore` excludes `node_modules`, `.next`, `.git`
- Typical standalone image: ~150-200MB vs ~1GB without

**Pod CrashLoopBackOff**
```bash
kubectl logs deploy/learnflow --previous
# Check for missing env vars — Next.js crashes if NEXT_PUBLIC_* vars are missing at build time
```

**TLS certificate not issued**
```bash
kubectl describe certificate learnflow-tls
kubectl describe certificaterequest
# Check cert-manager logs: kubectl -n cert-manager logs deploy/cert-manager
```

**HPA not scaling**
```bash
kubectl describe hpa learnflow-hpa
# Ensure metrics-server is installed: kubectl top pods
```
