# Stage 4b: Observability and Monitoring (Implemented)

## Overview

This document describes the **observability pieces that are implemented in this repository today**.

Implemented capabilities:

- **Metrics**: Prometheus metrics exposed by the backend at `GET /metrics`.
- **Logging**: Structured JSON logs written by the backend and workers to `logs/*.log`.
- **Traces**: Distributed tracing with OpenTelemetry, visualized in Jaeger UI.
- **Local observability stack**: Docker Compose stack providing Prometheus, Grafana, Loki, Promtail, Jaeger, node-exporter, redis-exporter, and OpenTelemetry Collector.

## Current Status

### ✅ Implemented

- Backend metrics collection (Prometheus)
- Structured logging (Winston)
- Distributed tracing (OpenTelemetry)
- Local observability stack (Docker Compose)
- Worker tracing with context propagation
- Log aggregation (Loki/Promtail)

### 🔄 Not Yet Implemented (Future Stage 4 sub-stages)

- **CI/CD Pipelines** (Stage 4a)
- **Secrets Management** (Stage 4c)
- **Circuit Breakers & Advanced Reliability Patterns** (Stage 4d)
- **Multi-Service Orchestration** (Stage 4e)
- **Cost Optimization & Auto-Scaling** (Stage 4f)
- **Frontend observability** (No tracing/metrics implemented)
- **Alerting** (No automated alerts configured)

## Architecture (Local)

```text
backend (Express)
  - /metrics  -> Prometheus scrape
  - logs/*.log -> Promtail -> Loki
  - traces     -> OpenTelemetry Collector -> Jaeger

workers (Node.js)
  - traces     -> OpenTelemetry Collector -> Jaeger
  - logs/*.log -> Promtail -> Loki

docker-compose.prometheus.yml
  - Prometheus -> Grafana
  - Loki <- Promtail
  - Jaeger <- OpenTelemetry Collector
  - node-exporter
  - redis-exporter
```

## Repo Entry Points

- **Prometheus metrics service**: `backend/services/prom.js`
- **Metrics middleware + endpoint**: `backend/index.js`
- **Structured logger**: `backend/config/logger.js`
- **OpenTelemetry configuration**: `backend/config/otel.js`, `workers/config/otel.js`
- **Local stack**: `docker-compose.prometheus.yml`
- **Prometheus scrape config**: `prometheus.yml`
- **Loki + Promtail configs**:
  - `loki-config.yml`
  - `promtail-config.yml`
- **OpenTelemetry Collector config**: `otel-collector-config.yaml`
- **Worker service**: `workers/worker.js`
- **Notification worker**: `workers/notification-worker.js`

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

## Tracing

### Distributed Tracing Setup

The backend uses OpenTelemetry for distributed tracing with automatic instrumentation:

- **Backend Service Name**: `system-design-service`
- **Worker Service Name**: `worker-service`
- **Trace Exporter**: OTLP HTTP to OpenTelemetry Collector
- **Collector Endpoint**: `http://localhost:4318/v1/traces`
- **Visualization**: Jaeger UI

### OpenTelemetry Configuration

The backend and workers are instrumented with OpenTelemetry SDK:

```js
// backend/config/otel.js & workers/config/otel.js
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
```

Auto-instrumentation automatically creates spans for:

- HTTP requests (Express routes)
- Database operations (MongoDB)
- External service calls (SNS, Redis, SQS)
- Worker message processing

### OpenTelemetry Collector Pipeline

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:

exporters:
  otlp:
    endpoint: http://jaeger:4317
    tls:
      insecure: true
```

### Jaeger Trace Visualization

Access Jaeger UI to explore traces:

- **URL**: `http://localhost:16686`
- **Features**:
  - Search traces by service, operation, or trace ID
  - View span timelines and dependencies
  - Filter by duration, status, and tags
  - Download trace data for analysis

### Trace Correlation with Logs

OpenTelemetry auto-instrumentation automatically injects trace context into logs. The Winston logger is configured to capture trace IDs and other OpenTelemetry context when available.

```json
{
  "level": "info",
  "method": "POST",
  "url": "/events/send",
  "trace_id": "1234567890abcdef1234567890abcdef",
  "span_id": "abcdef1234567890",
  "userAgent": "curl/7.68.0",
  "ip": "::1"
}
```

> **Note**: Trace ID injection is handled automatically by OpenTelemetry's auto-instrumentation.

### Manual Span Creation

Add custom spans for business logic:

```js
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("custom-tracer");

app.post("/events/send", async (req, res) => {
  const span = tracer.startSpan("publish-event");
  
  try {
    await publishJobEvent({ type, payload });
    span.setAttribute("event.type", type);
    span.setStatus({ code: 1 });
    res.json({ message: "Event sent successfully" });
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: 2 });
    res.status(500).json({ error: "Failed to send event" });
  } finally {
    span.end();
  }
});
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

### 2) Run the workers

From the `workers` folder:

```bash
npm install
npm start
```

### 3) Start the observability stack

From repo root:

```bash
docker-compose -f docker-compose.prometheus.yml up -d
```

### 4) Access UIs

- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3001` (admin/admin)
- **Jaeger**: `http://localhost:16686`
- **Loki**: `http://localhost:3100`

### 5) Generate Test Traces

```bash
# Generate HTTP request traces
curl http://localhost:3000/events
curl -X POST http://localhost:3000/events/send \
  -H "Content-Type: application/json" \
  -d '{"type":"test","payload":{"message":"hello"}}'
```

### 6) View Traces in Jaeger

1. Open `http://localhost:16686`
2. Select Service: `system-design-service` or `worker-service`
3. Click "Find Traces" to see recent requests
4. Click on any trace to view detailed span information

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

## Trace Analysis

### Common Trace Patterns

#### HTTP Request Flow

```text
HTTP GET /events
├── Express Route Handler
├── MongoDB Query (Event.find())
└── Response
```

#### Event Publishing Flow

```text
HTTP POST /events/send
├── Express Route Handler
├── SNS Publish
└── Response
```

### Performance Investigation

1. **Identify Slow Requests**
   - In Jaeger: Sort by duration
   - Look for traces with high total duration

2. **Pinpoint Bottlenecks**
   - Click on trace to view span timeline
   - Identify longest spans (red/orange in timeline)

3. **Correlate with Logs**
   - Copy Trace ID from Jaeger
   - Search in Loki for that trace_id
   - Analyze error messages and context

### Troubleshooting Traces

#### No Traces in Jaeger

1. **Check backend is running** with OpenTelemetry
2. **Verify collector is running**: `docker ps | grep otel-collector`
3. **Check collector health**: `curl http://localhost:13133`
4. **Test with requests**: Make HTTP requests to generate traces

#### Missing Trace IDs in Logs

OpenTelemetry auto-instrumentation should automatically inject trace context. If you're not seeing trace IDs in logs:

1. **Check OpenTelemetry is running**: Look for "OpenTelemetry started" in backend logs
2. **Verify auto-instrumentation**: Ensure requests are generating traces in Jaeger
3. **Check logger configuration**: Winston should capture OpenTelemetry context automatically
4. **Test with requests**: Make HTTP requests to generate traces and logs

If trace IDs are still missing, verify the OpenTelemetry initialization happens before any other imports.

## Integration Workflow

### Complete Observability Flow

1. **Metrics Alert** → High latency detected in Grafana
2. **Trace Investigation** → Find slow requests in Jaeger
3. **Log Analysis** → Search trace_id in Loki for root cause
4. **Resolution** → Fix identified bottleneck

### Example: Debugging Slow Event Publishing

```bash
# 1. Check metrics for high latency
# In Grafana: Look for high p95 latency

# 2. Find slow traces
# In Jaeger: Filter by operation "POST /events/send"
# Sort by duration

# 3. Get trace ID
# Copy trace ID from slow trace (e.g., "1234567890abcdef")

# 4. Search logs
# In Loki/Grafana: Search for trace_id="1234567890abcdef"

# 5. Analyze root cause
# Look for SNS timeouts, DB connection issues, etc.
```
