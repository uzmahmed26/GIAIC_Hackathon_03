# kong-api-gateway Reference

## Overview

Deploys Kong API Gateway on Kubernetes using the Kong Ingress Controller (KIC). Kong acts as the single entry point for all microservices, providing rate-limiting, JWT authentication, CORS, and request routing via Kubernetes-native CRDs.

## Architecture

```
Internet
    │
    ▼
┌──────────────────────────────────────────┐
│  Kong Ingress Controller                  │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │  KongPlugin: rate-limiting          │ │
│  │  KongPlugin: jwt                    │ │
│  │  KongPlugin: cors                   │ │
│  │  KongPlugin: request-id             │ │
│  └─────────────┬───────────────────────┘ │
└────────────────┼─────────────────────────┘
                 │ routes to
    ┌────────────┴──────────────────┐
    │                               │
    ▼                               ▼
/api/chat/*                   /api/code/*
chat-service:8001             code-service:8002
```

## Helm Installation

```bash
helm repo add kong https://charts.konghq.com
helm repo update

helm upgrade --install kong kong/ingress \
  --namespace kong \
  --create-namespace \
  --set controller.ingressClass=kong \
  --set proxy.type=LoadBalancer
```

## KongPlugin CRs

### Rate Limiting
```yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rate-limit-per-minute
  namespace: kong
plugin: rate-limiting
config:
  minute: 60
  hour: 1000
  policy: local
  limit_by: ip
  error_code: 429
  error_message: "Rate limit exceeded. Please slow down."
```

### JWT Authentication
```yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: jwt-auth
  namespace: kong
plugin: jwt
config:
  secret_is_base64: false
  claims_to_verify:
    - exp
  key_claim_name: iss
```

### CORS
```yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: cors-policy
  namespace: kong
plugin: cors
config:
  origins:
    - "https://app.example.com"
    - "http://localhost:3000"
  methods:
    - GET
    - POST
    - PUT
    - DELETE
    - OPTIONS
  headers:
    - Authorization
    - Content-Type
    - X-Request-ID
  exposed_headers:
    - X-Request-ID
  credentials: true
  max_age: 3600
```

### Request ID (Tracing)
```yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: request-id
  namespace: kong
plugin: correlation-id
config:
  header_name: X-Request-ID
  generator: uuid#counter
  echo_downstream: true
```

## Ingress with Plugins

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: learnflow-api
  namespace: default
  annotations:
    konghq.com/plugins: "rate-limit-per-minute,jwt-auth,cors-policy,request-id"
    konghq.com/strip-path: "true"
spec:
  ingressClassName: kong
  rules:
    - host: api.example.com
      http:
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
```

## KongConsumer (JWT credentials)

```yaml
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
---
apiVersion: v1
kind: Secret
metadata:
  name: learnflow-jwt-secret
  namespace: default
  labels:
    konghq.com/credential: jwt
stringData:
  key: learnflow-app-key       # iss claim value
  secret: your-jwt-secret-here
  algorithm: HS256
```

## DB-less Mode (declarative config)

```yaml
# kong.yaml (loaded via ConfigMap)
_format_version: "3.0"

services:
  - name: chat-service
    url: http://chat-service.default:8001
    routes:
      - name: chat-route
        paths:
          - /api/chat
        strip_path: true
    plugins:
      - name: rate-limiting
        config:
          minute: 60
```

## Monitoring

```bash
# Check Kong proxy status
kubectl -n kong get pods
kubectl -n kong logs deploy/kong-controller

# View all registered routes
kubectl exec -n kong deploy/kong-controller -- \
  curl -s localhost:8001/routes | jq '.data[].paths'

# Check plugin status
kubectl exec -n kong deploy/kong-controller -- \
  curl -s localhost:8001/plugins | jq '.data[].name'
```

## Troubleshooting

**Ingress not picked up**
```bash
kubectl describe ingress learnflow-api
# Check: kubectl -n kong logs deploy/kong-controller | grep ERROR
```

**JWT auth returning 401**
```bash
# Verify consumer and credential exist
kubectl exec -n kong deploy/kong-controller -- \
  curl -s localhost:8001/consumers/learnflow-app/jwt
```

**Rate limit not applying**
```bash
# Check plugin is attached to route
kubectl exec -n kong deploy/kong-controller -- \
  curl -s localhost:8001/routes/<route-id>/plugins
```
