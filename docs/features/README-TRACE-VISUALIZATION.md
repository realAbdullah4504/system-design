# Trace Collection Guide

## 🎯 Overview

This guide shows how traces are collected using the **OpenTelemetry Collector** and visualized in **Jaeger UI**.

---

## 🚀 Quick Start

### 1. Start Services

```bash
docker-compose -f docker-compose.prometheus.yml up -d
```

### 2. Verify Services

- **OpenTelemetry Collector**: http://localhost:13133 (health check)
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

---

## Current Trace Collection Setup

### OpenTelemetry Pipeline

```text
Backend Service → OpenTelemetry Collector → Jaeger UI
```

Your backend application sends traces to the collector at `http://localhost:4318/v1/traces`. The collector forwards them to Jaeger so you can explore request traces in the Jaeger UI.

---

## Viewing Trace Data

### Method 1: Collector Logs (optional)

```bash
docker logs otel-collector
```

Check this output for received spans and any export errors.

### Method 2: View in Jaeger UI

Open `http://localhost:16686`, select `system-design-service` or `worker-service`, then click **Find Traces** to see recent requests.

If Jaeger shows no new traces, verify collector health at `http://localhost:13133`.

---

## What You'll See in Jaeger and Collector Logs

### Trace Information
- **Trace ID**: Unique identifier for the request
- **Span ID**: Unique identifier for each operation
- **Duration**: Time taken for each operation
- **Service Name**: "system-design-service"
- **Operation Names**: Like "publish-event", "HTTP GET /events"
- **Attributes**: Metadata (HTTP method, route, status, etc.)

### Example Debug Output

```text
TraceID:    1234567890abcdef1234567890abcdef
SpanID:     abcdef1234567890
TraceFlags: 01
Resource: attributes=[
    service.name=system-design-service
]
InstrumentationLibraryName=@opentelemetry/instrumentation-express
InstrumentationLibraryVersion=0.34.0
Span #0
    TraceID:     1234567890abcdef1234567890abcdef
    SpanID:      abcdef1234567890
    ParentSpanID:
    SpanKind:    SpanKindSERVER
    Name:        HTTP GET /events
    Start:       2023-12-01 10:30:45.123 +0000 UTC
    End:         2023-12-01 10:30:45.456 +0000 UTC
    Attributes:  http.method=GET, http.route=/events, http.status_code=200
```

---

## 🎯 Common Use Cases

### 1. Verify Tracing is Working

Make requests to your endpoints and check collector logs:

```bash
# Make a request
curl http://localhost:3000/events

# Check collector logs
docker logs otel-collector -f
```

### 2. Monitor Specific Operations

Your backend automatically creates spans for:
- HTTP requests (Express routes)
- SNS publishing operations
- Database operations (if instrumented)

### 3. Debug Performance Issues

Look for long durations in Jaeger to identify slow operations.

---

## 🔗 Integration with Existing Stack

### Logs + Traces

Your logs already include `trace_id` from the OpenTelemetry setup. Use it to:

1. **Find trace ID in logs**: Look for `trace_id` in log entries
2. **Search for that trace ID**: In collector logs
3. **Correlate operations**: Match log timestamps with trace spans

### Metrics + Traces

To connect metrics and traces during debugging, you can still:
- **Monitor metrics** in Grafana (latency, error rates)
- **Correlate metrics spikes** with trace data from collector logs
- **Use trace IDs** from logs to investigate performance issues

---

## 📋 Example Trace Flow

When you make a request to your backend:

```
HTTP Request → Express Route → Business Logic → SNS → Response
     ↓              ↓              ↓        ↓         ↓
   Span 1         Span 2         Span 3   Span 4    Span 5
```

In the collector logs and Jaeger, you'll see:
- **Total duration**: Entire request lifecycle
- **Individual spans**: Each operation's timing
- **Service information**: Service name and operation details
- **Error information**: If any operations fail

---

## 🛠️ Troubleshooting

### No Traces in Jaeger

1. **Check backend is running** with OpenTelemetry
2. **Verify collector is running**: `docker ps | grep otel-collector`
3. **Check collector logs**: `docker logs otel-collector`
4. **Test data flow**: Make some HTTP requests to generate traces
5. **Verify collector config**: Check `otel-collector-config.yaml`

### Collector Connection Issues

1. **Check collector health**: `curl http://localhost:13133`
2. **Verify backend config**: Check `backend/config/otel.js`
3. **Check network**: Ensure backend can reach localhost:4318
4. **Restart services**: `docker-compose restart otel-collector`

### Backend Not Sending Traces

1. **Check OpenTelemetry startup**: Look for "OpenTelemetry started" in backend logs
2. **Verify exporter URL**: Should be `http://localhost:4318/v1/traces`
3. **Check instrumentation**: Ensure auto-instrumentation is loaded
4. **Restart backend**: Restart the Node.js application

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
3. **✅ Configure trace storage** (Jaeger backend configured)
4. **✅ Set up trace visualization** in Jaeger UI
5. **Add service dependency mapping**

---

## 📚 Quick Reference

| URL | Purpose |
|-----|---------|
| <http://localhost:3001> | Grafana (metrics) |
| <http://localhost:9090> | Prometheus (metrics) |
| <http://localhost:3100> | Loki (logs) |
| <http://localhost:16686> | **Jaeger (traces visualization)** |
| <http://localhost:13133> | OpenTelemetry Collector (health) |

| Command | Purpose |
|---------|---------|
| `docker logs otel-collector` | View trace data |
| `docker logs otel-collector -f` | Follow trace data live |
| `curl http://localhost:13133` | Check collector health |
| `curl http://localhost:3000/events` | Generate test traces |
| `curl http://localhost:16686` | Access Jaeger UI |

---

## 💡 Pro Tips

- **Use collector logs** to verify tracing is working
- **Check trace IDs in logs** to correlate requests
- **Monitor span durations** to identify performance issues
- **Use attributes** for debugging context
- **Combine with Loki logs** for full observability

Happy tracing! 🚀
