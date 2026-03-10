# prometheus-grafana Reference

## Overview

Deploys the kube-prometheus-stack Helm chart, which bundles Prometheus, Alertmanager, Grafana, node-exporter, kube-state-metrics, and a set of pre-built dashboards and alerting rules — all managed as Kubernetes-native resources.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                         │
│                                                            │
│  ┌──────────────┐  scrapes  ┌──────────────────────────┐  │
│  │  Prometheus  │◀─────────│  ServiceMonitors           │  │
│  │  (TSDB)      │           │  PodMonitors               │  │
│  │              │           │  (all namespaces)          │  │
│  │              │──alerts──▶│  Alertmanager              │  │
│  └──────┬───────┘           └────────────┬───────────────┘  │
│         │                               │                   │
│         │ queries                       │ routes to         │
│         ▼                               ▼                   │
│  ┌──────────────┐            ┌──────────────────────┐       │
│  │   Grafana    │            │  Slack / PagerDuty   │       │
│  │  (dashboards)│            │  (alert receivers)   │       │
│  └──────────────┘            └──────────────────────┘       │
└────────────────────────────────────────────────────────────┘
```

## Helm Installation

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values monitoring-values.yaml
```

## Helm Values (monitoring-values.yaml)

```yaml
prometheus:
  prometheusSpec:
    retention: 30d
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: standard
          accessModes: [ReadWriteOnce]
          resources:
            requests:
              storage: 50Gi
    # Discover ServiceMonitors across all namespaces
    serviceMonitorSelectorNilUsesHelmValues: false
    podMonitorSelectorNilUsesHelmValues: false
    ruleSelectorNilUsesHelmValues: false

grafana:
  adminPassword: changeme
  ingress:
    enabled: true
    ingressClassName: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
      - grafana.example.com
    tls:
      - secretName: grafana-tls
        hosts:
          - grafana.example.com
  # Auto-provision dashboards from ConfigMaps
  sidecar:
    dashboards:
      enabled: true
      searchNamespace: ALL
    datasources:
      enabled: true

alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: standard
          accessModes: [ReadWriteOnce]
          resources:
            requests:
              storage: 10Gi

# Disable default etcd alerts (not accessible in managed k8s)
kubeEtcd:
  enabled: false
kubeControllerManager:
  enabled: false
kubeScheduler:
  enabled: false
```

## ServiceMonitor Example (FastAPI)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: chat-service
  namespace: default
  labels:
    release: kube-prometheus-stack  # Must match Prometheus selector
spec:
  selector:
    matchLabels:
      app: chat-service
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
      scrapeTimeout: 10s
```

## PrometheusRule (Custom Alerts)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: learnflow-alerts
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: learnflow.rules
      rules:
        - alert: HighCPUUsage
          expr: |
            sum(rate(container_cpu_usage_seconds_total{namespace="default"}[5m]))
            by (pod) > 0.8
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Pod {{ $labels.pod }} high CPU"
            description: "CPU usage > 80% for 5 minutes"

        - alert: PodRestartingFrequently
          expr: |
            increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 0m
          labels:
            severity: critical
          annotations:
            summary: "Pod {{ $labels.pod }} restarting"

        - alert: PVCNearlyFull
          expr: |
            (kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes) > 0.85
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "PVC {{ $labels.persistentvolumeclaim }} is 85%+ full"
```

## Alertmanager Config (Slack)

```yaml
# alertmanager-config-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-kube-prometheus-stack-alertmanager
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    global:
      slack_api_url: https://hooks.slack.com/services/xxx/yyy/zzz

    route:
      group_by: [alertname, cluster]
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 12h
      receiver: slack-notifications
      routes:
        - match:
            severity: critical
          receiver: pagerduty-critical

    receivers:
      - name: slack-notifications
        slack_configs:
          - channel: "#alerts"
            send_resolved: true
            title: '[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}'
            text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

      - name: pagerduty-critical
        pagerduty_configs:
          - service_key: your-pagerduty-integration-key
```

## Importing Grafana Dashboards

```yaml
# Custom dashboard ConfigMap (auto-imported via sidecar)
apiVersion: v1
kind: ConfigMap
metadata:
  name: learnflow-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"  # Triggers Grafana sidecar import
data:
  learnflow.json: |
    {
      "title": "LearnFlow Overview",
      "panels": [...]
    }
```

## Useful Prometheus Queries

```promql
# HTTP request rate by endpoint
rate(http_requests_total{job="chat-service"}[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Pod memory usage
container_memory_working_set_bytes{namespace="default"}

# CPU throttling %
rate(container_cpu_throttled_seconds_total[5m])
  / rate(container_cpu_usage_seconds_total[5m])
```

## Troubleshooting

**Prometheus not scraping a service**
```bash
# Check targets in Prometheus UI: https://prometheus.example.com/targets
# Verify ServiceMonitor label matches prometheusSpec.serviceMonitorSelector
kubectl get servicemonitor -A
kubectl describe servicemonitor chat-service
```

**Grafana can't query Prometheus**
```bash
kubectl -n monitoring logs deploy/kube-prometheus-stack-grafana -c grafana
# Check datasource URL: http://kube-prometheus-stack-prometheus.monitoring:9090
```

**Alert not firing**
```bash
# Check rule evaluation in Prometheus UI: /rules
kubectl -n monitoring exec -it prometheus-kube-prometheus-stack-prometheus-0 -- \
  promtool check rules /etc/prometheus/rules/*.yaml
```
