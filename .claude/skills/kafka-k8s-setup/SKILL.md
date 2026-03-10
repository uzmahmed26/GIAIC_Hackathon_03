---
name: kafka-k8s-setup
version: 1.0.0
description: Deploy production-ready Apache Kafka on Kubernetes with Strimzi operator
triggers:
  - "deploy kafka"
  - "kafka kubernetes"
  - "setup kafka k8s"
  - "kafka cluster"
parameters:
  - name: namespace
    description: Kubernetes namespace for Kafka
    default: kafka
  - name: replicas
    description: Number of Kafka broker replicas
    default: "3"
  - name: storage_size
    description: Persistent volume size per broker
    default: 100Gi
script: scripts/deploy.sh
# ~85 tokens
---

## Usage

```
/kafka-k8s-setup namespace=kafka replicas=3 storage_size=100Gi
```

## What it does

1. Installs Strimzi Kafka Operator via Helm
2. Creates KafkaCluster CR with ZooKeeper / KRaft mode
3. Creates KafkaTopic and KafkaUser CRs
4. Configures PodDisruptionBudgets and NetworkPolicies
5. Runs smoke test (producer → consumer round-trip)

## Prerequisites

- kubectl configured with cluster-admin
- Helm 3 installed
- StorageClass with ReadWriteOnce support
