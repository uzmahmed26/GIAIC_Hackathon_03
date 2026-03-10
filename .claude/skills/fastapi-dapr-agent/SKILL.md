---
name: fastapi-dapr-agent
version: 1.0.0
description: Scaffold a FastAPI microservice with Dapr sidecar for pub/sub and state management
triggers:
  - "create fastapi dapr"
  - "fastapi dapr agent"
  - "dapr microservice"
  - "scaffold fastapi"
parameters:
  - name: service_name
    description: Name of the microservice
    required: true
  - name: port
    description: HTTP port for the FastAPI service
    default: "8000"
  - name: dapr_port
    description: Dapr HTTP sidecar port
    default: "3500"
  - name: output_dir
    description: Directory to scaffold into
    default: "."
script: scripts/scaffold.sh
# ~95 tokens
---

## Usage

```
/fastapi-dapr-agent service_name=order-service port=8000
```

## What it does

1. Creates FastAPI app with health, pub/sub subscribe, and state endpoints
2. Generates Dapr component YAMLs (pubsub, statestore)
3. Creates Dockerfile with multi-stage build
4. Creates Kubernetes Deployment with Dapr annotations
5. Creates docker-compose.yml for local dev with Dapr sidecar
