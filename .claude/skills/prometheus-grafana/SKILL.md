---
name: prometheus-grafana
version: 1.0.0
description: Deploy kube-prometheus-stack with pre-built dashboards and alerting rules
triggers:
  - "setup monitoring"
  - "prometheus grafana"
  - "deploy prometheus"
  - "kubernetes monitoring"
parameters:
  - name: namespace
    description: Kubernetes namespace for monitoring stack
    default: monitoring
  - name: grafana_password
    description: Grafana admin password
    default: changeme
  - name: storage_size
    description: Prometheus TSDB persistent volume size
    default: 50Gi
  - name: retention
    description: Prometheus data retention period
    default: 30d
script: scripts/deploy.sh
# ~90 tokens
---

## Usage

```
/prometheus-grafana namespace=monitoring storage_size=50Gi retention=30d
```

## What it does

1. Installs kube-prometheus-stack via Helm
2. Configures ServiceMonitor CRs for common services
3. Imports Grafana dashboards (cluster, pods, ingress, postgres)
4. Creates PrometheusRule CRs for alerting (CPU, memory, pod restarts)
5. Configures Alertmanager with Slack/PagerDuty receiver
