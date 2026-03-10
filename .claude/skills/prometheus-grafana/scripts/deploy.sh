#!/usr/bin/env bash
# prometheus-grafana/scripts/deploy.sh
# Deploys kube-prometheus-stack with dashboards and alerting rules.
# Usage: bash deploy.sh [namespace] [grafana_password] [storage_size] [retention]
# Returns: "✓ Done" on success

set -euo pipefail

NAMESPACE="${1:-monitoring}"
GRAFANA_PASSWORD="${2:-changeme}"
STORAGE_SIZE="${3:-50Gi}"
RETENTION="${4:-30d}"

log() { echo "  [monitoring] $*"; }

# ── 1. Install kube-prometheus-stack ─────────────────────────────────────────
log "Adding prometheus-community Helm repo..."
helm repo add prometheus-community \
  https://prometheus-community.github.io/helm-charts \
  --force-update > /dev/null 2>&1
helm repo update > /dev/null 2>&1

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - > /dev/null

log "Installing kube-prometheus-stack (storage=${STORAGE_SIZE}, retention=${RETENTION})..."

cat > /tmp/monitoring-values.yaml << VALEOF
prometheus:
  prometheusSpec:
    retention: ${RETENTION}
    retentionSize: ""
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: standard
          accessModes: [ReadWriteOnce]
          resources:
            requests:
              storage: ${STORAGE_SIZE}
    # Discover ServiceMonitors and PrometheusRules across ALL namespaces
    serviceMonitorSelectorNilUsesHelmValues: false
    podMonitorSelectorNilUsesHelmValues: false
    ruleSelectorNilUsesHelmValues: false
    resources:
      requests:
        memory: 512Mi
        cpu: 250m
      limits:
        memory: 2Gi
        cpu: "1"

grafana:
  adminPassword: "${GRAFANA_PASSWORD}"
  persistence:
    enabled: true
    size: 10Gi
  sidecar:
    dashboards:
      enabled: true
      searchNamespace: ALL
    datasources:
      enabled: true
  resources:
    requests:
      memory: 256Mi
      cpu: 100m
    limits:
      memory: 512Mi
      cpu: 500m

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

# Disable components not accessible in managed Kubernetes (EKS/GKE/AKS)
kubeEtcd:
  enabled: false
kubeControllerManager:
  enabled: false
kubeScheduler:
  enabled: false

# Node exporter
nodeExporter:
  enabled: true

# Kube state metrics
kubeStateMetrics:
  enabled: true
VALEOF

helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace "$NAMESPACE" \
  --values /tmp/monitoring-values.yaml \
  --wait \
  --timeout 10m \
  > /dev/null

log "kube-prometheus-stack installed."

# ── 2. Create custom PrometheusRule ──────────────────────────────────────────
log "Creating custom alerting rules..."

kubectl apply -f - << EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: learnflow-alerts
  namespace: ${NAMESPACE}
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: learnflow.workload
      interval: 30s
      rules:
        - alert: PodCrashLooping
          expr: |
            increase(kube_pod_container_status_restarts_total[1h]) > 5
          for: 0m
          labels:
            severity: critical
          annotations:
            summary: "Pod {{ \$labels.namespace }}/{{ \$labels.pod }} crash looping"
            description: "Container {{ \$labels.container }} restarted >5 times in 1h"

        - alert: HighCPUUsage
          expr: |
            sum(rate(container_cpu_usage_seconds_total{
              namespace!="",container!="",container!="POD"
            }[5m])) by (namespace, pod, container)
            / sum(kube_pod_container_resource_limits{resource="cpu",container!=""}) by (namespace, pod, container)
            > 0.9
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "High CPU: {{ \$labels.namespace }}/{{ \$labels.pod }}"
            description: "Container {{ \$labels.container }} using >90% CPU limit for 10m"

        - alert: HighMemoryUsage
          expr: |
            container_memory_working_set_bytes{container!="",container!="POD"}
            / kube_pod_container_resource_limits{resource="memory",container!=""}
            > 0.85
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High memory: {{ \$labels.namespace }}/{{ \$labels.pod }}"
            description: "Container {{ \$labels.container }} using >85% memory limit"

        - alert: PVCNearlyFull
          expr: |
            (kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes) > 0.85
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "PVC nearly full: {{ \$labels.namespace }}/{{ \$labels.persistentvolumeclaim }}"
            description: "PVC usage >85%"

    - name: learnflow.availability
      rules:
        - alert: DeploymentReplicasMismatch
          expr: |
            kube_deployment_spec_replicas != kube_deployment_status_ready_replicas
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Deployment replicas mismatch: {{ \$labels.namespace }}/{{ \$labels.deployment }}"
            description: "Desired {{ \$value }} replicas not ready"

        - alert: ServiceEndpointsDown
          expr: |
            kube_endpoint_address_available == 0
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "No endpoints: {{ \$labels.namespace }}/{{ \$labels.endpoint }}"
            description: "Service has zero available endpoints"
EOF

# ── 3. Create Alertmanager config (Slack) ─────────────────────────────────────
log "Creating Alertmanager Slack config template..."

kubectl apply -f - << 'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-slack-config
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m
      # slack_api_url: https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

    route:
      group_by: [alertname, namespace, severity]
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 12h
      receiver: null-receiver  # Change to slack-notifications to enable
      routes:
        - match:
            severity: critical
          receiver: null-receiver
          continue: true

    receivers:
      - name: null-receiver

      # Uncomment and configure to enable Slack alerts:
      # - name: slack-notifications
      #   slack_configs:
      #     - api_url: https://hooks.slack.com/services/XXX/YYY/ZZZ
      #       channel: "#alerts"
      #       send_resolved: true
      #       title: '[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}'
      #       text: '{{ range .Alerts }}{{ .Annotations.description }}{{ "\n" }}{{ end }}'
EOF

# ── 4. Create Grafana dashboard (cluster overview) ────────────────────────────
log "Creating Grafana cluster overview dashboard..."

kubectl apply -f - << 'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: learnflow-cluster-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  learnflow-cluster.json: |
    {
      "title": "LearnFlow - Cluster Overview",
      "uid": "learnflow-cluster",
      "tags": ["learnflow", "kubernetes"],
      "time": {"from": "now-1h", "to": "now"},
      "refresh": "30s",
      "panels": [
        {
          "id": 1,
          "title": "CPU Usage by Namespace",
          "type": "timeseries",
          "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
          "targets": [{
            "expr": "sum(rate(container_cpu_usage_seconds_total{namespace!=''}[5m])) by (namespace)",
            "legendFormat": "{{namespace}}"
          }]
        },
        {
          "id": 2,
          "title": "Memory Usage by Namespace",
          "type": "timeseries",
          "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8},
          "targets": [{
            "expr": "sum(container_memory_working_set_bytes{namespace!=''}) by (namespace)",
            "legendFormat": "{{namespace}}"
          }]
        },
        {
          "id": 3,
          "title": "Pod Restarts (1h)",
          "type": "stat",
          "gridPos": {"x": 0, "y": 8, "w": 6, "h": 4},
          "targets": [{
            "expr": "sum(increase(kube_pod_container_status_restarts_total[1h]))"
          }]
        },
        {
          "id": 4,
          "title": "Active Pods",
          "type": "stat",
          "gridPos": {"x": 6, "y": 8, "w": 6, "h": 4},
          "targets": [{
            "expr": "sum(kube_pod_status_phase{phase='Running'})"
          }]
        }
      ]
    }
EOF

# ── 5. Port-forward info ──────────────────────────────────────────────────────
log "Getting Grafana service info..."
GRAFANA_SVC="kube-prometheus-stack-grafana"

echo ""
echo "  Monitoring stack ready!"
echo "  Namespace: ${NAMESPACE}"
echo "  Prometheus retention: ${RETENTION}"
echo "  Storage: ${STORAGE_SIZE}"
echo ""
echo "  Grafana:"
echo "    URL: kubectl port-forward -n ${NAMESPACE} svc/${GRAFANA_SVC} 3001:80"
echo "    Then: http://localhost:3001"
echo "    Login: admin / ${GRAFANA_PASSWORD}"
echo ""
echo "  Prometheus:"
echo "    kubectl port-forward -n ${NAMESPACE} svc/kube-prometheus-stack-prometheus 9090:9090"
echo "    Then: http://localhost:9090"
echo ""
echo "  To enable Slack alerts:"
echo "    kubectl edit secret alertmanager-slack-config -n ${NAMESPACE}"
echo ""
echo "✓ Done"
