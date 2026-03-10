---
name: kong-api-gateway
version: 1.0.0
description: Deploy Kong API Gateway on Kubernetes with rate-limiting, auth, and routing
triggers:
  - "setup kong"
  - "kong api gateway"
  - "kong kubernetes"
  - "deploy kong"
parameters:
  - name: namespace
    description: Kubernetes namespace for Kong
    default: kong
  - name: mode
    description: "Deployment mode: dbless | postgres"
    default: dbless
  - name: admin_api
    description: "Expose Admin API: true | false"
    default: "false"
script: scripts/deploy.sh
# ~80 tokens
---

## Usage

```
/kong-api-gateway namespace=kong mode=dbless
```

## What it does

1. Installs Kong via Helm with KIC (Kong Ingress Controller)
2. Creates KongPlugin CRs (rate-limiting, jwt, cors, request-id)
3. Creates KongIngress for upstream routing
4. Configures KongConsumer with credentials
5. Runs smoke test (rate-limit, auth, routing verification)
