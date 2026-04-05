# P95 and P99 Percentile Tracking Guide

This guide explains how to track and monitor p95 and p99 response times for your system using Artillery and Prometheus.

## Overview

- **P95**: 95th percentile - 95% of requests complete faster than this time
- **P99**: 99th percentile - 99% of requests complete faster than this time

## Setup Components

### 1. Enhanced Prometheus Histograms

Updated histogram buckets for better percentile resolution:

**Worker Service** (`workers/services/prom.js`):
```javascript
buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2, 5, 10, 20, 30, 60]
```

**Backend API** (`backend/services/prom.js`):
```javascript
buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 3, 5, 7, 10]
```

### 2. Artillery Load Testing

Enhanced load test configuration (`backend/load-test.yml`):
- Multiple test phases with increasing load
- Custom percentile tracking
- Response time capture and logging

### 3. Prometheus Recording Rules

Automatically calculated percentiles (`percentile-rules.yml`):
- `http_request_duration_seconds:p95:5m`
- `http_request_duration_seconds:p99:5m`
- `worker_job_processing_duration_seconds:p95:5m`
- `worker_job_processing_duration_seconds:p99:5m`

## Usage

### Running Load Tests

**Windows:**
```bash
cd backend
run-load-test.bat
```

**Linux/Mac:**
```bash
cd backend
chmod +x run-load-test.sh
./run-load-test.sh
```

### Monitoring in Prometheus

Access Prometheus at http://localhost:9090 and query:

```promql
# HTTP P95 Response Time
http_request_duration_seconds:p95:5m

# HTTP P99 Response Time  
http_request_duration_seconds:p99:5m

# Worker Job P95 Processing Time
worker_job_processing_duration_seconds:p95:5m

# Worker Job P99 Processing Time
worker_job_processing_duration_seconds:p99:5m
```

### Grafana Dashboard Queries

Use these queries in your Grafana dashboard:

**HTTP Response Time Percentiles:**
```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, method, route))
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, method, route))
```

**Worker Processing Percentiles:**
```promql
histogram_quantile(0.95, sum(rate(worker_job_processing_duration_seconds_bucket[5m])) by (le, worker_type, job_type))
histogram_quantile(0.99, sum(rate(worker_job_processing_duration_seconds_bucket[5m])) by (le, worker_type, job_type))
```

## Artillery Results Interpretation

After running the load test, check `results.json` for:

```json
{
  "aggregate": {
    "latency": {
      "p50": 45,
      "p95": 120,
      "p99": 250,
      "max": 500
    },
    "rps": {
      "mean": 198.5,
      "count": 11910
    }
  }
}
```

## Best Practices

1. **Baseline First**: Establish baseline p95/p99 metrics before optimization
2. **Monitor Trends**: Track percentiles over time, not just snapshots
3. **Set Alerts**: Configure alerts for p95/p99 thresholds
4. **Correlate with Load**: Monitor percentiles under different load conditions
5. **Business Context**: Align percentile targets with user experience goals

## Alerting Examples

```yaml
# Prometheus Alerting Rules
- alert: HighP95ResponseTime
  expr: http_request_duration_seconds:p95:5m > 0.5
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "P95 response time is {{ $value }}s"

- alert: HighP99ResponseTime
  expr: http_request_duration_seconds:p99:5m > 1.0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "P99 response time is {{ $value }}s"
```

## Troubleshooting

### High P95/P99 Values

1. **Check Resource Usage**: CPU, memory, I/O bottlenecks
2. **Database Performance**: Slow queries, connection pool exhaustion
3. **Network Latency**: External service calls, network congestion
4. **GC Pauses**: Garbage collection affecting response times
5. **Queue Depth**: High queue depth in worker services

### Improving Percentiles

1. **Optimize Code**: Identify and fix slow operations
2. **Caching**: Implement appropriate caching strategies
3. **Connection Pooling**: Optimize database and external service connections
4. **Async Processing**: Use queues for non-critical operations
5. **Horizontal Scaling**: Add more instances under load
