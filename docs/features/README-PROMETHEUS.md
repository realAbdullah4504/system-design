# Prometheus Monitoring Setup

This document explains how to set up and validate the Prometheus (metrics) part of the observability stack. For the full Stage 4b observability context (metrics + logging + tracing + local stack), see `docs/system.md`.

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
- **Redis Exporter**: http://localhost:9121/metrics
- **Application Metrics**: http://localhost:3000/metrics

## Available Metrics

### Application Metrics

- `http_request_duration_seconds` - HTTP request duration histogram
- `http_requests_total` - Total HTTP requests counter
- `active_connections` - Current active connections gauge

### Redis Metrics

- `redis_connected_clients` - Number of connected clients
- `redis_used_memory` - Memory used by Redis in bytes
- `redis_commands_processed_total` - Total number of commands processed
- `redis_keyspace_hits_total` - Total number of successful key lookups
- `redis_keyspace_misses_total` - Total number of failed key lookups
- `redis_connected_slaves` - Number of connected replicas
- `redis_uptime_in_seconds` - Redis server uptime in seconds

### Default Prometheus Metrics

- Node.js process metrics (memory, CPU, etc.)
- System metrics via node-exporter

## Prometheus Configuration

The `prometheus.yml` file defines scrape targets and intervals for:

- Backend app scraping: `http://localhost:3000/metrics`
- Node exporter scraping: `http://localhost:9100/metrics`
- Redis exporter scraping: `http://localhost:9121/metrics`

Scrape intervals are configured in `prometheus.yml`; check that file for the exact values.

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

### Redis Memory Usage
```
redis_used_memory
```

### Redis Hit Rate
```
rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))
```

### Redis Commands per Second
```
rate(redis_commands_processed_total[5m])
```

## Stopping the Services

```bash
docker-compose -f docker-compose.prometheus.yml down
```

## Troubleshooting

1. **Backend not accessible from Prometheus**: Ensure backend is running on port 3000
2. **Metrics not showing**: Check the `/metrics` endpoint is accessible
3. **Connection issues**: Verify Docker networking and port mappings
4. **Redis exporter not accessible**: Ensure Redis is running and exporter can connect to Redis instance
5. **Redis metrics missing**: Check Redis connection configuration in docker-compose file
6. **Prometheus targets not UP**: Open the Prometheus UI and check `Status -> Targets` for errors
