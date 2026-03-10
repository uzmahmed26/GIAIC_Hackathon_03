# kafka-k8s-setup Reference

## Overview

Deploys Apache Kafka on Kubernetes using the Strimzi operator. Strimzi is the CNCF-graduated operator that manages Kafka clusters as Kubernetes-native resources via Custom Resource Definitions (CRDs).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                  │
│                                                     │
│  ┌─────────────┐    ┌────────────────────────────┐  │
│  │   Strimzi   │    │     Kafka Namespace         │  │
│  │  Operator   │───▶│  ┌───────┐  ┌───────────┐  │  │
│  │  (watches   │    │  │ Kafka │  │ ZooKeeper │  │  │
│  │   CRDs)     │    │  │ x3    │  │ x3        │  │  │
│  └─────────────┘    │  └───────┘  └───────────┘  │  │
│                     │  ┌───────────────────────┐  │  │
│                     │  │  Kafka Topics / Users │  │  │
│                     │  └───────────────────────┘  │  │
│                     └────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Strimzi Custom Resources

### KafkaCluster

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: learnflow-kafka
  namespace: kafka
spec:
  kafka:
    version: 3.7.0
    replicas: 3
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
      - name: tls
        port: 9093
        type: internal
        tls: true
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
      default.replication.factor: 3
      min.insync.replicas: 2
      inter.broker.protocol.version: "3.7"
    storage:
      type: persistent-claim
      size: 100Gi
      class: standard
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 10Gi
      class: standard
  entityOperator:
    topicOperator: {}
    userOperator: {}
```

### KafkaTopic

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: chat-events
  namespace: kafka
  labels:
    strimzi.io/cluster: learnflow-kafka
spec:
  partitions: 12
  replicas: 3
  config:
    retention.ms: 604800000  # 7 days
    segment.bytes: 1073741824
```

### KafkaUser

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaUser
metadata:
  name: learnflow-producer
  namespace: kafka
  labels:
    strimzi.io/cluster: learnflow-kafka
spec:
  authentication:
    type: scram-sha-512
  authorization:
    type: simple
    acls:
      - resource:
          type: topic
          name: chat-events
        operations: [Write, Describe]
```

## Helm Values

```yaml
# strimzi-operator values.yaml
replicas: 1
watchNamespaces: ["kafka"]
resources:
  limits:
    memory: 512Mi
    cpu: 500m
```

## Connecting From Applications

```python
# Python (confluent-kafka)
from confluent_kafka import Producer, Consumer

producer = Producer({
    'bootstrap.servers': 'learnflow-kafka-kafka-bootstrap.kafka:9092',
    'security.protocol': 'SASL_PLAINTEXT',
    'sasl.mechanism': 'SCRAM-SHA-512',
    'sasl.username': 'learnflow-producer',
    'sasl.password': '<from-secret>',
})
```

```typescript
// TypeScript (kafkajs)
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  brokers: ['learnflow-kafka-kafka-bootstrap.kafka:9092'],
  sasl: {
    mechanism: 'scram-sha-512',
    username: 'learnflow-producer',
    password: process.env.KAFKA_PASSWORD!,
  },
});
```

## Monitoring

Strimzi exposes Prometheus metrics via `PodMonitor` CRs. Key metrics:

| Metric | Alert Threshold |
|--------|----------------|
| `kafka_server_replicamanager_underreplicatedpartitions` | > 0 for 5m |
| `kafka_controller_kafkacontroller_activecontrollercount` | != 1 |
| `kafka_network_requestmetrics_totaltimems` | p99 > 1000ms |
| Consumer lag (`kafka_consumergroup_lag`) | > 10000 |

## Troubleshooting

**Brokers not forming cluster**
```bash
kubectl -n kafka logs deployment/strimzi-cluster-operator | tail -50
kubectl -n kafka get kafka learnflow-kafka -o jsonpath='{.status.conditions}'
```

**Topic not created**
```bash
kubectl -n kafka get kafkatopic
kubectl -n kafka describe kafkatopic chat-events
```

**Consumer lag growing**
```bash
# Check partition count vs consumer instances
kubectl -n kafka exec -it learnflow-kafka-kafka-0 -- bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group my-consumer-group
```

**Storage full**
```bash
# Increase PVC size (requires StorageClass with allowVolumeExpansion: true)
kubectl -n kafka patch pvc data-learnflow-kafka-kafka-0 \
  -p '{"spec":{"resources":{"requests":{"storage":"200Gi"}}}}'
```

## KRaft Mode (No ZooKeeper)

For Kafka 3.6+, use KRaft mode to eliminate ZooKeeper dependency:

```yaml
spec:
  kafka:
    metadataVersion: 3.7-IV4
  zookeeper: null  # Remove zookeeper section
  # Add to kafka spec:
  roles:
    - broker
    - controller
```
