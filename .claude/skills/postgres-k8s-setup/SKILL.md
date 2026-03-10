---
name: postgres-k8s-setup
version: 1.0.0
description: Deploy HA PostgreSQL on Kubernetes using CloudNativePG operator
triggers:
  - "deploy postgres"
  - "postgresql kubernetes"
  - "setup postgres k8s"
  - "postgres cluster"
parameters:
  - name: namespace
    description: Kubernetes namespace for PostgreSQL
    default: postgres
  - name: replicas
    description: Number of PostgreSQL instances (1 primary + N-1 replicas)
    default: "3"
  - name: storage_size
    description: Persistent volume size per instance
    default: 50Gi
  - name: db_name
    description: Initial database name to create
    default: appdb
script: scripts/deploy.sh
# ~95 tokens
---

## Usage

```
/postgres-k8s-setup namespace=postgres replicas=3 db_name=appdb
```

## What it does

1. Installs CloudNativePG operator via Helm
2. Creates Cluster CR with streaming replication
3. Creates Secrets for superuser and app credentials
4. Configures PgBouncer pooler for connection pooling
5. Sets up scheduled backups via ScheduledBackup CR
6. Runs smoke test (connect, create table, insert, select)
