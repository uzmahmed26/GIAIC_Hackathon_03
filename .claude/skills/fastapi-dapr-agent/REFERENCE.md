# fastapi-dapr-agent Reference

## Overview

Scaffolds a production-ready FastAPI microservice with Dapr sidecar integration for pub/sub messaging, state management, service invocation, and secrets. Designed for cloud-native microservice architectures.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Kubernetes Pod                                          │
│                                                         │
│  ┌───────────────────┐     ┌────────────────────────┐   │
│  │  FastAPI App      │     │   Dapr Sidecar         │   │
│  │  :8000            │────▶│   :3500 (HTTP)         │   │
│  │                   │     │   :50001 (gRPC)        │   │
│  │  /subscribe  ◀────│─────│   (receives pub/sub)   │   │
│  │  /state      ────▶│─────│   (proxies to Redis)   │   │
│  │  /invoke     ────▶│─────│   (service discovery)  │   │
│  └───────────────────┘     └───────────┬────────────┘   │
└───────────────────────────────────────┼─────────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │  Dapr Components             │
                         │  - pubsub: Redis Streams     │
                         │  - statestore: Redis         │
                         │  - secrets: Kubernetes       │
                         └──────────────────────────────┘
```

## Generated File Structure

```
order-service/
├── main.py                    # FastAPI app
├── models.py                  # Pydantic models
├── requirements.txt
├── Dockerfile
├── docker-compose.yml         # Local dev with Dapr
├── dapr/
│   ├── components/
│   │   ├── pubsub.yaml        # Redis Streams pub/sub
│   │   ├── statestore.yaml    # Redis state store
│   │   └── secrets.yaml      # Kubernetes secrets
│   └── config.yaml           # Dapr configuration
└── k8s/
    ├── deployment.yaml        # With Dapr annotations
    ├── service.yaml
    └── components/            # Dapr component CRDs
```

## FastAPI App Pattern

```python
# main.py
from fastapi import FastAPI, HTTPException
from dapr.clients import DaprClient
import json

app = FastAPI(title="order-service")

PUBSUB_NAME = "pubsub"
TOPIC = "orders"
STORE_NAME = "statestore"

@app.get("/health")
def health():
    return {"status": "ok"}

# Dapr subscribe endpoint — auto-discovered
@app.get("/dapr/subscribe")
def subscribe():
    return [{"pubsubname": PUBSUB_NAME, "topic": TOPIC, "route": "/orders/receive"}]

@app.post("/orders/receive")
async def receive_order(event: dict):
    data = event.get("data", {})
    order_id = data.get("order_id")
    # Process event...
    return {"success": True}

@app.post("/orders/{order_id}")
async def create_order(order_id: str, order: dict):
    with DaprClient() as d:
        # Publish event
        d.publish_event(PUBSUB_NAME, TOPIC, json.dumps({"order_id": order_id, **order}))
        # Save state
        d.save_state(STORE_NAME, order_id, json.dumps(order))
    return {"order_id": order_id}

@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    with DaprClient() as d:
        result = d.get_state(STORE_NAME, order_id)
        if not result.data:
            raise HTTPException(404, "Order not found")
        return json.loads(result.data)
```

## Dapr Components

### pubsub.yaml (Redis Streams)
```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: pubsub
  namespace: default
spec:
  type: pubsub.redis
  version: v1
  metadata:
    - name: redisHost
      value: redis-master.redis:6379
    - name: redisPassword
      secretKeyRef:
        name: redis-secret
        key: password
```

### statestore.yaml
```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: statestore
  namespace: default
spec:
  type: state.redis
  version: v1
  metadata:
    - name: redisHost
      value: redis-master.redis:6379
    - name: actorStateStore
      value: "true"
```

## Kubernetes Deployment with Dapr

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  template:
    metadata:
      annotations:
        dapr.io/enabled: "true"
        dapr.io/app-id: "order-service"
        dapr.io/app-port: "8000"
        dapr.io/log-level: "info"
        dapr.io/enable-api-logging: "true"
    spec:
      containers:
        - name: order-service
          image: ghcr.io/org/order-service:latest
          ports:
            - containerPort: 8000
```

## Local Development (docker-compose.yml)

```yaml
version: "3.8"
services:
  order-service:
    build: .
    ports:
      - "8000:8000"

  order-service-dapr:
    image: daprio/daprd:latest
    command:
      - "./daprd"
      - "-app-id"
      - "order-service"
      - "-app-port"
      - "8000"
      - "-components-path"
      - "/components"
    volumes:
      - ./dapr/components:/components
    network_mode: "service:order-service"
    depends_on:
      - order-service

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Troubleshooting

**Dapr sidecar not injecting**
```bash
# Check namespace label
kubectl get namespace default --show-labels
# Should have: dapr.io/enabled=true
kubectl label namespace default dapr.io/enabled=true
```

**Pub/sub not receiving events**
```bash
# Check subscribe endpoint
kubectl exec deploy/order-service -c daprd -- \
  curl localhost:3500/v1.0/subscribe

# Check component health
kubectl exec deploy/order-service -c daprd -- \
  curl localhost:3500/v1.0/healthz
```

**State save failing**
```bash
# Test state store directly via Dapr sidecar
kubectl exec deploy/order-service -c order-service -- \
  curl -X POST localhost:3500/v1.0/state/statestore \
  -H "Content-Type: application/json" \
  -d '[{"key":"test","value":"hello"}]'
```
