#!/usr/bin/env bash
# postgres-k8s-setup/scripts/deploy.sh
# Deploys HA PostgreSQL on Kubernetes using CloudNativePG operator.
# Usage: bash deploy.sh [namespace] [replicas] [storage_size] [db_name]
# Returns: "✓ Done" on success

set -euo pipefail

NAMESPACE="${1:-postgres}"
REPLICAS="${2:-3}"
STORAGE_SIZE="${3:-50Gi}"
DB_NAME="${4:-appdb}"
CLUSTER_NAME="learnflow-pg"
PG_VERSION="16.3"

log() { echo "  [postgres] $*"; }

# ── 1. Install CloudNativePG operator ─────────────────────────────────────────
log "Adding CloudNativePG Helm repo..."
helm repo add cnpg https://cloudnative-pg.github.io/charts --force-update > /dev/null 2>&1
helm repo update > /dev/null 2>&1

log "Installing CloudNativePG operator..."
helm upgrade --install cnpg cnpg/cloudnative-pg \
  --namespace cnpg-system \
  --create-namespace \
  --wait \
  --timeout 5m \
  > /dev/null

log "CloudNativePG operator ready."

# ── 2. Create namespace and secrets ──────────────────────────────────────────
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - > /dev/null

# Generate random passwords
SUPERUSER_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
APP_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

log "Creating credential secrets..."

kubectl create secret generic "${CLUSTER_NAME}-superuser" \
  --namespace "$NAMESPACE" \
  --from-literal=username=postgres \
  --from-literal=password="${SUPERUSER_PASS}" \
  --dry-run=client -o yaml | kubectl apply -f - > /dev/null

kubectl create secret generic "${CLUSTER_NAME}-app" \
  --namespace "$NAMESPACE" \
  --from-literal=username=appuser \
  --from-literal=password="${APP_PASS}" \
  --dry-run=client -o yaml | kubectl apply -f - > /dev/null

# ── 3. Create PostgreSQL Cluster CR ──────────────────────────────────────────
log "Creating PostgreSQL cluster (replicas=${REPLICAS}, storage=${STORAGE_SIZE})..."

kubectl apply -f - << EOF
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: ${CLUSTER_NAME}
  namespace: ${NAMESPACE}
spec:
  instances: ${REPLICAS}
  imageName: ghcr.io/cloudnative-pg/postgresql:${PG_VERSION}

  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "256MB"
      effective_cache_size: "1GB"
      maintenance_work_mem: "64MB"
      checkpoint_completion_target: "0.9"
      wal_buffers: "16MB"
      default_statistics_target: "100"
      log_min_duration_statement: "1000"

  bootstrap:
    initdb:
      database: ${DB_NAME}
      owner: appuser
      secret:
        name: ${CLUSTER_NAME}-app

  superuserSecret:
    name: ${CLUSTER_NAME}-superuser

  storage:
    size: ${STORAGE_SIZE}

  resources:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
EOF

# ── 4. Wait for cluster ready ─────────────────────────────────────────────────
log "Waiting for PostgreSQL cluster to be ready (this takes ~2-4 minutes)..."
kubectl wait cluster/"${CLUSTER_NAME}" \
  --namespace "${NAMESPACE}" \
  --for=condition=Ready \
  --timeout=10m

# ── 5. Deploy PgBouncer pooler ────────────────────────────────────────────────
log "Deploying PgBouncer connection pooler..."

kubectl apply -f - << EOF
apiVersion: postgresql.cnpg.io/v1
kind: Pooler
metadata:
  name: ${CLUSTER_NAME}-pooler-rw
  namespace: ${NAMESPACE}
spec:
  cluster:
    name: ${CLUSTER_NAME}
  instances: 2
  type: rw
  pgbouncer:
    poolMode: transaction
    parameters:
      max_client_conn: "1000"
      default_pool_size: "25"
      reserve_pool_size: "5"
EOF

kubectl apply -f - << EOF
apiVersion: postgresql.cnpg.io/v1
kind: Pooler
metadata:
  name: ${CLUSTER_NAME}-pooler-ro
  namespace: ${NAMESPACE}
spec:
  cluster:
    name: ${CLUSTER_NAME}
  instances: 2
  type: ro
  pgbouncer:
    poolMode: transaction
    parameters:
      max_client_conn: "1000"
      default_pool_size: "25"
EOF

# ── 6. Create scheduled backup ────────────────────────────────────────────────
log "Creating scheduled backup (2am daily)..."

kubectl apply -f - << EOF
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: ${CLUSTER_NAME}-backup
  namespace: ${NAMESPACE}
spec:
  schedule: "0 2 * * *"
  backupOwnerReference: self
  cluster:
    name: ${CLUSTER_NAME}
  method: barmanObjectStore
EOF

# ── 7. Smoke test ─────────────────────────────────────────────────────────────
log "Running smoke test..."

PRIMARY_POD="${CLUSTER_NAME}-1"
kubectl exec -n "$NAMESPACE" "$PRIMARY_POD" -- \
  psql -U postgres -d "$DB_NAME" -c "
    CREATE TABLE IF NOT EXISTS _smoke_test (id serial, val text);
    INSERT INTO _smoke_test (val) VALUES ('learnflow-ok');
    SELECT val FROM _smoke_test WHERE val = 'learnflow-ok';
    DROP TABLE _smoke_test;
  " > /dev/null 2>&1 && log "Smoke test passed." || log "Smoke test: check pod logs."

# ── 8. Print connection info ──────────────────────────────────────────────────
RW_SVC="${CLUSTER_NAME}-pooler-rw.${NAMESPACE}.svc.cluster.local"
RO_SVC="${CLUSTER_NAME}-pooler-ro.${NAMESPACE}.svc.cluster.local"

echo ""
echo "  PostgreSQL cluster ready!"
echo "  Primary (RW): ${RW_SVC}:5432"
echo "  Replicas (RO): ${RO_SVC}:5432"
echo "  Database: ${DB_NAME}"
echo "  App user: appuser"
echo "  App password: (stored in secret ${CLUSTER_NAME}-app)"
echo ""
echo "  Retrieve password:"
echo "  kubectl get secret ${CLUSTER_NAME}-app -n ${NAMESPACE} -o jsonpath='{.data.password}' | base64 -d"
echo ""
echo "✓ Done"
