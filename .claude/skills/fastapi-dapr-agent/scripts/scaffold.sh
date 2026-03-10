#!/usr/bin/env bash
# fastapi-dapr-agent/scripts/scaffold.sh
# Scaffolds a FastAPI microservice with Dapr sidecar integration.
# Usage: bash scaffold.sh <service_name> [port] [dapr_port] [output_dir]
# Returns: "✓ Done" on success

set -euo pipefail

SERVICE_NAME="${1}"
PORT="${2:-8000}"
DAPR_PORT="${3:-3500}"
OUTPUT_DIR="${4:-.}"
SERVICE_DIR="${OUTPUT_DIR}/${SERVICE_NAME}"

log() { echo "  [fastapi-dapr] $*"; }

mkdir -p "${SERVICE_DIR}/dapr/components" "${SERVICE_DIR}/k8s/components"

# ── main.py ───────────────────────────────────────────────────────────────────
log "Writing main.py..."
cat > "${SERVICE_DIR}/main.py" << 'PYEOF'
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from dapr.clients import DaprClient
from models import EventPayload, StateRequest

logger = logging.getLogger(__name__)

PUBSUB_NAME = "pubsub"
TOPIC = "SERVICE_TOPIC"  # replaced by scaffold
STORE_NAME = "statestore"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SERVICE_NAME starting up")
    yield
    logger.info("SERVICE_NAME shutting down")


app = FastAPI(title="SERVICE_NAME", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "service": "SERVICE_NAME"}


@app.get("/dapr/subscribe")
def subscribe():
    """Dapr auto-discovers this endpoint to register subscriptions."""
    return [{"pubsubname": PUBSUB_NAME, "topic": TOPIC, "route": "/events/receive"}]


@app.post("/events/receive")
async def receive_event(payload: dict):
    data = payload.get("data", {})
    logger.info("Received event: %s", data)
    return {"success": True}


@app.post("/events/publish")
async def publish_event(event: EventPayload):
    with DaprClient() as d:
        d.publish_event(PUBSUB_NAME, TOPIC, json.dumps(event.model_dump()))
    return {"published": True}


@app.post("/state/{key}")
async def save_state(key: str, req: StateRequest):
    with DaprClient() as d:
        d.save_state(STORE_NAME, key, json.dumps(req.value))
    return {"saved": True, "key": key}


@app.get("/state/{key}")
async def get_state(key: str):
    with DaprClient() as d:
        result = d.get_state(STORE_NAME, key)
        if not result.data:
            raise HTTPException(status_code=404, detail=f"Key '{key}' not found")
        return json.loads(result.data)


@app.delete("/state/{key}")
async def delete_state(key: str):
    with DaprClient() as d:
        d.delete_state(STORE_NAME, key)
    return {"deleted": True, "key": key}
PYEOF

# Replace placeholders
sed -i "s/SERVICE_NAME/${SERVICE_NAME}/g; s/SERVICE_TOPIC/${SERVICE_NAME}-events/g" \
  "${SERVICE_DIR}/main.py"

# ── models.py ─────────────────────────────────────────────────────────────────
cat > "${SERVICE_DIR}/models.py" << 'PYEOF'
from pydantic import BaseModel
from typing import Any


class EventPayload(BaseModel):
    event_type: str
    data: dict[str, Any] = {}


class StateRequest(BaseModel):
    value: Any
PYEOF

# ── requirements.txt ──────────────────────────────────────────────────────────
cat > "${SERVICE_DIR}/requirements.txt" << 'REQEOF'
fastapi>=0.111.0
uvicorn[standard]>=0.30.0
dapr>=1.13.0
pydantic>=2.7.0
REQEOF

# ── Dockerfile ────────────────────────────────────────────────────────────────
log "Writing Dockerfile..."
cat > "${SERVICE_DIR}/Dockerfile" << DEOF
FROM python:3.12-slim

WORKDIR /app

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --gid 1001 appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

USER appuser

EXPOSE ${PORT}

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "${PORT}"]
DEOF

# ── docker-compose.yml ────────────────────────────────────────────────────────
log "Writing docker-compose.yml..."
cat > "${SERVICE_DIR}/docker-compose.yml" << DCEOF
version: "3.8"
services:
  ${SERVICE_NAME}:
    build: .
    ports:
      - "${PORT}:${PORT}"
    environment:
      - LOG_LEVEL=info
    depends_on:
      - redis

  ${SERVICE_NAME}-dapr:
    image: daprio/daprd:1.13.0
    command:
      - "./daprd"
      - "-app-id"
      - "${SERVICE_NAME}"
      - "-app-port"
      - "${PORT}"
      - "-dapr-http-port"
      - "${DAPR_PORT}"
      - "-components-path"
      - "/components"
      - "-log-level"
      - "info"
    volumes:
      - ./dapr/components:/components
    network_mode: "service:${SERVICE_NAME}"
    depends_on:
      - ${SERVICE_NAME}

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
DCEOF

# ── Dapr components ───────────────────────────────────────────────────────────
log "Writing Dapr component YAMLs..."

cat > "${SERVICE_DIR}/dapr/components/pubsub.yaml" << COMPEOF
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: pubsub
spec:
  type: pubsub.redis
  version: v1
  metadata:
    - name: redisHost
      value: redis:6379
    - name: redisPassword
      value: ""
COMPEOF

cat > "${SERVICE_DIR}/dapr/components/statestore.yaml" << COMPEOF
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: statestore
spec:
  type: state.redis
  version: v1
  metadata:
    - name: redisHost
      value: redis:6379
    - name: redisPassword
      value: ""
    - name: actorStateStore
      value: "true"
COMPEOF

# ── Kubernetes manifests ──────────────────────────────────────────────────────
log "Writing Kubernetes manifests..."

cat > "${SERVICE_DIR}/k8s/deployment.yaml" << K8SEOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${SERVICE_NAME}
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${SERVICE_NAME}
  template:
    metadata:
      labels:
        app: ${SERVICE_NAME}
      annotations:
        dapr.io/enabled: "true"
        dapr.io/app-id: "${SERVICE_NAME}"
        dapr.io/app-port: "${PORT}"
        dapr.io/log-level: "info"
        dapr.io/enable-api-logging: "true"
    spec:
      containers:
        - name: ${SERVICE_NAME}
          image: ghcr.io/org/${SERVICE_NAME}:latest
          ports:
            - containerPort: ${PORT}
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /health
              port: ${PORT}
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: ${SERVICE_NAME}
  namespace: default
spec:
  selector:
    app: ${SERVICE_NAME}
  ports:
    - port: ${PORT}
      targetPort: ${PORT}
      name: http
K8SEOF

log "Scaffold complete: ${SERVICE_DIR}/"
echo ""
echo "  Service: ${SERVICE_NAME}"
echo "  Port: ${PORT}, Dapr port: ${DAPR_PORT}"
echo ""
echo "  Quick start:"
echo "    cd ${SERVICE_DIR}"
echo "    docker compose up"
echo ""
echo "✓ Done"
