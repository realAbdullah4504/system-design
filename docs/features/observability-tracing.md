# OpenTelemetry Minimal Integration (Stage 4 - Step 1)

## 🎯 Goal

Add **basic distributed tracing** using OpenTelemetry to the existing Express backend **without breaking current functionality**.

We are NOT replacing logging or metrics.

We are ONLY adding:

* Trace creation
* Span tracking
* Trace ID injection into logs

---

## 📦 Dependencies

Install:

```bash
npm install @opentelemetry/sdk-node \
@opentelemetry/auto-instrumentations-node \
@opentelemetry/exporter-trace-otlp-http \
@opentelemetry/resources \
@opentelemetry/semantic-conventions
```

---

## 📁 File Structure Changes

Create new file:

```
/src/config/otel.js
```

---

## ⚙️ Step 1: Setup OpenTelemetry

### `/config/otel.js`

```js
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "system-design-service",
  }),
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:4318/v1/traces", // Collector endpoint
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

export const startTracing = async () => {
  await sdk.start();
  console.log("OpenTelemetry started");
};
```

---

## ⚙️ Step 2: Initialize Tracing EARLY

### IMPORTANT: This must run before anything else

Update your entry file (top of file):

```js
import { startTracing } from "./config/otel.js";

await startTracing();
```

👉 This should be the **FIRST import execution**

---

## ⚙️ Step 3: Add Trace Context to Logs

Update your logger middleware:

```js
import { context, trace } from "@opentelemetry/api";
```

Modify logging middleware:

```js
app.use((req, res, next) => {
  if (req.path === '/metrics') return next();

  const span = trace.getSpan(context.active());
  const traceId = span?.spanContext().traceId;

  logger.info('HTTP request', {
    method: req.method,
    url: req.url,
    trace_id: traceId, // ✅ ADD THIS
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  next();
});
```

---

## ⚙️ Step 4: Add Manual Span (Example)

Inside any route (example: `/events/send`):

```js
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("custom-tracer");

app.post("/events/send", async (req, res) => {
  const span = tracer.startSpan("publish-event");

  try {
    const { type, payload } = req.body;

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

---

## ⚙️ Step 5: Run OpenTelemetry Collector (Docker)

Create `otel-collector-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      http:

exporters:
  logging:
    loglevel: debug

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [logging]
```

Run:

```bash
docker run -p 4318:4318 \
-v $(pwd)/otel-collector-config.yaml:/etc/otelcol/config.yaml \
otel/opentelemetry-collector
```

---

## ✅ Expected Result

After running:

* Requests generate traces
* Spans appear in collector logs
* Logs contain `trace_id`
* No existing functionality is broken

---

## 🚫 What We Are NOT Doing (Important)

* NOT replacing Loki
* NOT adding Grafana/Jaeger yet
* NOT tracing Redis/SNS deeply
* NOT handling async propagation yet

---

## 🧠 Learning Outcome

After this step, you should understand:

* What a trace is
* How spans are created
* How trace_id connects logs
* How auto-instrumentation works

---

## 🔜 Next Step (Do NOT skip)

After this works:

👉 Add tracing across:

* SNS
* Redis pub/sub
* Worker service

This is where real distributed tracing begins.

---

## ⚠️ Common Mistakes

* Initializing OpenTelemetry AFTER app start ❌
* Forgetting trace context in logs ❌
* Expecting UI without Jaeger ❌

---

## 💡 Rule

Start SIMPLE → Verify → Then scale tracing

---
