# Trace Visualization Guide

## 🎯 Overview

This guide shows how to visualize distributed traces using **Tempo + Grafana** in your observability stack.

---

## 🚀 Quick Start

### 1. Start Services

```bash
docker-compose -f docker-compose.prometheus.yml up -d
```

### 2. Verify Services

- **Tempo**: http://localhost:3200
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

---

## 🔧 Grafana Setup

### Add Tempo as Data Source

1. Open Grafana: http://localhost:3001
2. Go to **Configuration** → **Data Sources** → **Add data source**
3. Select **"Tempo"**
4. Configure:
   - **Name**: `Tempo`
   - **URL**: `http://tempo:3200`
5. Click **"Save & Test"**

---

## 📊 How to View Traces

### Method 1: Grafana Explore (Recommended)

1. In Grafana, go to **Explore** (🔍 icon)
2. Select **"Tempo"** from data source dropdown
3. Click **"Search Traces"**

### Method 2: Direct Tempo UI

1. Open http://localhost:3200
2. Use the search interface

---

## 🔍 Trace Search & Filtering

### Search by Service

```
service.name = "system-design-service"
```

### Search by Duration

```
duration > 100ms
duration < 1s
```

### Search by Tags

```
http.method = "GET"
http.status_code = 200
```

### Combined Search

```
service.name = "system-design-service" AND duration > 100ms
```

---

## 📈 What You'll See

### Trace List View
- **Trace ID**: Unique identifier
- **Duration**: Total request time
- **Number of Spans**: Operations performed
- **Service**: Which service handled it
- **Timestamp**: When it occurred

### Span Details
- **Operation Name**: What was done (e.g., "HTTP GET /events")
- **Duration**: How long it took
- **Tags**: Metadata (HTTP method, status, etc.)
- **Logs**: Connected log entries with trace_id
- **Parent/Child**: Relationship to other spans

### Waterfall View
- **Timeline**: Visual representation of execution
- **Concurrency**: Parallel operations
- **Bottlenecks**: Slow operations clearly visible

---

## 🎯 Common Use Cases

### 1. Find Slow Requests

```
service.name = "system-design-service" AND duration > 500ms
```

### 2. Debug Errors

```
http.status_code >= 400
```

### 3. Track Specific Endpoints

```
http.route = "/events/send"
```

### 4. Correlate with Logs

Use the **trace_id** from traces to find corresponding logs in Loki/Grafana.

---

## 🔗 Integration with Existing Stack

### Logs + Traces

Your logs already include `trace_id` from the OpenTelemetry setup. Use it to:

1. **Find trace ID in logs**
2. **Search for that trace ID in Tempo**
3. **See the full request context**

### Metrics + Traces

In Grafana, you can:
- **Create dashboards** with both metrics and traces
- **Jump from metrics to traces** (if configured)
- **Correlate latency spikes** with specific traces

---

## 📋 Example Trace Flow

When you make a request to your backend:

```
HTTP Request → Express Route → Business Logic → Redis/SNS → Response
     ↓              ↓              ↓           ↓         ↓
   Span 1         Span 2         Span 3     Span 4    Span 5
```

In Tempo, you'll see:
- **Total duration**: Entire request lifecycle
- **Individual spans**: Each operation's timing
- **Service map**: How services interact
- **Error propagation**: Where failures occur

---

## 🛠️ Troubleshooting

### No Traces Appearing

1. **Check backend is running** with OpenTelemetry
2. **Verify collector logs**: `docker logs otel-collector`
3. **Check Tempo logs**: `docker logs tempo`
4. **Test data flow**: Make some HTTP requests to generate traces

### Tempo Connection Issues

1. **Verify network**: `docker network ls`
2. **Check DNS**: `docker exec otel-collector nslookup tempo`
3. **Validate config**: `docker exec otel-collector otelcol validate /etc/otelcol/config.yaml`

### Grafana Data Source Issues

1. **URL should be**: `http://tempo:3200` (not localhost)
2. **Check Tempo is accessible**: `curl http://localhost:3200/ready`
3. **Restart Grafana**: `docker restart grafana`

---

## 🎯 Best Practices

### 1. Meaningful Span Names
```javascript
// Good
span.setAttribute("operation.name", "publish-event-to-sns")

// Bad
span.setAttribute("operation.name", "op1")
```

### 2. Add Useful Attributes
```javascript
span.setAttribute("user.id", userId);
span.setAttribute("event.type", eventType);
span.setAttribute("db.query", "SELECT * FROM events");
```

### 3. Record Exceptions
```javascript
try {
  // operation
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: 2 }); // Error
}
```

---

## 🔜 Next Steps

1. **Add custom spans** for business logic
2. **Instrument external services** (Redis, SNS)
3. **Create Grafana dashboards** combining metrics + traces
4. **Set up alerts** based on trace data
5. **Add service dependency mapping**

---

## 📚 Quick Reference

| URL | Purpose |
|-----|---------|
| http://localhost:3001 | Grafana (traces + metrics) |
| http://localhost:3200 | Tempo (traces only) |
| http://localhost:9090 | Prometheus (metrics) |
| http://localhost:3100 | Loki (logs) |

| Command | Purpose |
|---------|---------|
| `docker logs otel-collector` | Check collector |
| `docker logs tempo` | Check Tempo |
| `docker logs grafana` | Check Grafana |
| `curl http://localhost:3200/ready` | Test Tempo health |

---

## 💡 Pro Tips

- **Start with Grafana Explore** - it's the most user-friendly
- **Use trace IDs from logs** to jump directly to specific requests
- **Filter by duration** to find performance issues quickly
- **Check span attributes** for debugging context
- **Combine with Loki logs** for full observability

Happy tracing! 🚀
