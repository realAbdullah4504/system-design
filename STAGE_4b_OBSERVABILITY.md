# Stage 4b: Observability and Monitoring (Implemented)

## Overview

This document describes the **observability pieces that are implemented in this repository today**.

Implemented capabilities:

- **Metrics**: Prometheus metrics exposed by the backend at `GET /metrics`.
- **Logging**: Structured JSON logs written by the backend to `backend/logs/*.log`.
- **Local observability stack**: Docker Compose stack providing Prometheus, Grafana, Loki, Promtail, node-exporter, and redis-exporter.

## Architecture (Local)

```text
backend (Express)
  - /metrics  -> Prometheus scrape
  - logs/*.log -> Promtail -> Loki

docker-compose.prometheus.yml
  - Prometheus -> Grafana
  - Loki <- Promtail
  - node-exporter
  - redis-exporter
```

## Repo Entry Points

- **Prometheus metrics service**: `backend/services/prom.js`
- **Metrics middleware + endpoint**: `backend/index.js`
- **Structured logger**: `backend/config/logger.js`
- **Local stack**: `docker-compose.prometheus.yml`
- **Prometheus scrape config**: `prometheus.yml`
- **Loki + Promtail configs**:
  - `loki-config.yml`
  - `promtail-config.yml`

## Metrics

### Backend metrics endpoint

- **URL**: `http://localhost:3000/metrics`
- **Implementation**:
  - Default Node.js process metrics via `prom-client` default collectors.
  - Custom metrics:
    - `http_request_duration_seconds` (Histogram)
    - `http_requests_total` (Counter)
    - `active_connections` (Gauge)

### Prometheus scrape

Prometheus is configured to scrape the backend via `host.docker.internal` (Docker Desktop):

```yaml
  - job_name: 'backend-app'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s
```

## Logging

### Backend structured logs

The backend uses Winston to emit JSON logs to:

- `backend/logs/combined.log`
- `backend/logs/error.log`

### Log shipping (Promtail -> Loki)

Promtail reads the backend log files mounted into the container and pushes them to Loki:

```yaml
  - job_name: app-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: api-service
          __path__: /var/log/app/*.log
```

## Local Setup

### 1) Run the backend

From the `backend` folder:

```bash
npm install
npm start
```

Verify metrics:

```bash
curl http://localhost:3000/metrics
```

### 2) Start the observability stack

From repo root:

```bash
docker-compose -f docker-compose.prometheus.yml up -d
```

### 3) Access UIs

- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3001` (admin/admin)

## Useful Prometheus Queries

```promql
rate(http_requests_total[5m])
```

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

```promql
active_connections
```
