# postgres-k8s-setup Reference

## Overview

Deploys HA PostgreSQL on Kubernetes using the CloudNativePG (CNPG) operator — the CNCF sandbox project that manages PostgreSQL clusters as Kubernetes-native resources. Includes PgBouncer connection pooler and automated backups.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                       │
│                                                          │
│  ┌───────────────┐    ┌──────────────────────────────┐   │
│  │  CloudNativePG│    │     postgres Namespace        │   │
│  │   Operator    │───▶│  ┌──────────┐  ┌──────────┐  │   │
│  │               │    │  │ Primary  │  │ Replica1 │  │   │
│  │               │    │  │(rw SVC)  │  │(ro SVC)  │  │   │
│  └───────────────┘    │  └────┬─────┘  └──────────┘  │   │
│                       │       │  ┌──────────┐          │   │
│                       │       │  │ Replica2 │          │   │
│                       │       │  │(ro SVC)  │          │   │
│                       │  ┌────▼─────────────────────┐ │   │
│                       │  │    PgBouncer Pooler       │ │   │
│                       │  └───────────────────────────┘ │   │
│                       └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

## CloudNativePG Cluster CR

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: learnflow-pg
  namespace: postgres
spec:
  instances: 3
  imageName: ghcr.io/cloudnative-pg/postgresql:16.3

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
      database: appdb
      owner: appuser
      secret:
        name: learnflow-pg-superuser

  storage:
    size: 50Gi
    storageClass: standard

  backup:
    retentionPolicy: "30d"
    barmanObjectStore:
      destinationPath: s3://my-bucket/postgres
      s3Credentials:
        accessKeyId:
          name: s3-creds
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: s3-creds
          key: SECRET_ACCESS_KEY

  resources:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
```

## PgBouncer Pooler

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Pooler
metadata:
  name: learnflow-pg-pooler
  namespace: postgres
spec:
  cluster:
    name: learnflow-pg
  instances: 2
  type: rw  # or ro for read replicas
  pgbouncer:
    poolMode: transaction
    parameters:
      max_client_conn: "1000"
      default_pool_size: "25"
```

## Scheduled Backup

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: learnflow-pg-backup
  namespace: postgres
spec:
  schedule: "0 2 * * *"  # 2am daily
  backupOwnerReference: self
  cluster:
    name: learnflow-pg
```

## Connecting From Applications

```python
# Python (asyncpg / SQLAlchemy)
import asyncpg

# Use PgBouncer service for app connections
conn = await asyncpg.connect(
    host="learnflow-pg-pooler-rw.postgres.svc.cluster.local",
    port=5432,
    database="appdb",
    user="appuser",
    password=os.environ["DB_PASSWORD"],
)
```

```typescript
// TypeScript (pg / Drizzle)
import { Pool } from 'pg';

const pool = new Pool({
  host: 'learnflow-pg-pooler-rw.postgres.svc.cluster.local',
  port: 5432,
  database: 'appdb',
  user: 'appuser',
  password: process.env.DB_PASSWORD,
  max: 10,
});
```

## Services Created

| Service | Purpose | Port |
|---------|---------|------|
| `learnflow-pg-rw` | Primary (read-write) | 5432 |
| `learnflow-pg-ro` | Replicas (read-only) | 5432 |
| `learnflow-pg-r` | All instances (round-robin) | 5432 |
| `learnflow-pg-pooler-rw` | PgBouncer → primary | 5432 |
| `learnflow-pg-pooler-ro` | PgBouncer → replicas | 5432 |

## Monitoring

Key Prometheus metrics (exposed via `PodMonitor`):

| Metric | Alert Threshold |
|--------|----------------|
| `cnpg_pg_replication_lag` | > 30s |
| `cnpg_backends_total` | > 180 (near max_connections) |
| `cnpg_pg_database_size_bytes` | > 80% of PVC size |
| `cnpg_pg_stat_bgwriter_checkpoint_sync_time` | p99 > 5000ms |

## Troubleshooting

**Primary not elected**
```bash
kubectl -n postgres get cluster learnflow-pg -o jsonpath='{.status}'
kubectl -n postgres describe cluster learnflow-pg
```

**Replication lag**
```bash
kubectl -n postgres exec -it learnflow-pg-1 -- \
  psql -U postgres -c "SELECT * FROM pg_stat_replication;"
```

**Connection pool exhausted**
```bash
kubectl -n postgres exec -it deploy/learnflow-pg-pooler-rw -- \
  psql -p 5432 pgbouncer -c "SHOW POOLS;"
```

**Point-in-time recovery**
```yaml
# Create new cluster from backup at specific time
spec:
  bootstrap:
    recovery:
      source: learnflow-pg
      recoveryTarget:
        targetTime: "2024-01-15 03:00:00"
  externalClusters:
    - name: learnflow-pg
      barmanObjectStore:
        destinationPath: s3://my-bucket/postgres
```

## Upgrade Process

```bash
# 1. Update imageName in Cluster CR (e.g., postgresql:16.3 -> 16.4)
kubectl -n postgres patch cluster learnflow-pg \
  --type=merge -p '{"spec":{"imageName":"ghcr.io/cloudnative-pg/postgresql:16.4"}}'

# 2. CNPG performs rolling upgrade automatically (replicas first, then primary)
# Watch: kubectl -n postgres get pods -w
```
