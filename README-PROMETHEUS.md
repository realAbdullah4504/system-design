# Prometheus Monitoring Setup

This document explains how to set up and run Prometheus locally for monitoring the system design application.

## Files Created

1. **`backend/services/prom.js`** - Prometheus metrics service with custom metrics
2. **`prometheus.yml`** - Prometheus configuration file
3. **`docker-compose.prometheus.yml`** - Docker Compose setup for local monitoring

## Quick Start

### 1. Install prom-client dependency

```bash
cd backend
npm install prom-client
```

### 2. Start your backend application

```bash
cd backend
npm start
```

The backend will now expose metrics at `http://localhost:3000/metrics`

### 3. Start Prometheus stack

```bash
docker-compose -f docker-compose.prometheus.yml up -d
```

### 4. Access the services

- **Prometheus UI**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Node Exporter**: http://localhost:9100/metrics
- **Application Metrics**: http://localhost:3000/metrics

## Available Metrics

### Application Metrics

- `http_request_duration_seconds` - HTTP request duration histogram
- `http_requests_total` - Total HTTP requests counter
- `active_connections` - Current active connections gauge

### Default Prometheus Metrics

- Node.js process metrics (memory, CPU, etc.)
- System metrics via node-exporter

## Prometheus Configuration

The `prometheus.yml` file configures:

- Scrape interval: 15 seconds
- Backend app scraping: Every 5 seconds from `localhost:3000/metrics`
- Node exporter scraping: Every 5 seconds from `localhost:9100/metrics`

## Grafana Setup

1. Access Grafana at http://localhost:3001
2. Login with admin/admin
3. Add Prometheus as data source:
   - URL: `http://prometheus:9090`
   - Access: Server

## Sample Queries

### HTTP Request Rate
```
rate(http_requests_total[5m])
```

### HTTP Request Duration
```
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Active Connections
```
active_connections
```

## Stopping the Services

```bash
docker-compose -f docker-compose.prometheus.yml down
```

## Troubleshooting

1. **Backend not accessible from Prometheus**: Ensure backend is running on port 3000
2. **Metrics not showing**: Check the `/metrics` endpoint is accessible
3. **Connection issues**: Verify Docker networking and port mappings
