# Event-Driven Processing Platform on AWS

## Project Summary

This project is a production-pattern event processing system built on AWS managed infrastructure. It demonstrates how to decouple event ingestion from background processing using an asynchronous, queue-based architecture without sacrificing real-time user experience.

The system accepts events through a thin REST API, fans them out through a durable messaging pipeline, processes them asynchronously in background workers, and delivers results back to users via real-time server push. The result is an architecture that handles burst traffic gracefully, isolates failures, and provides production-grade observability across two independently scalable services.

The design decisions reflect real-world trade-offs: using managed AWS services instead of self-hosted alternatives, choosing operational simplicity over flexibility where the use case permits, and separating infrastructure concerns (tracing, metrics, secrets) from application logic.

---

## Problem

The core engineering challenge is handling event ingestion reliably while keeping the user-facing API responsive. A synchronous model — where the API processes events directly and writes to a database before responding — creates coupling between write latency and user experience. Burst traffic, downstream database contention, or slow processing paths can degrade API latency or cause dropped requests.

Real-time feedback introduces additional complexity: users expect immediate visual confirmation of events. Polling the database for changes wastes resources and introduces latency. Long-polling or WebSockets add client-side complexity and require careful connection management across service instances.

Observability makes this harder, not easier. Instrumenting distributed traces across a messaging boundary requires explicit context propagation. Monitoring multiple services means unifying metrics, logs, and traces across process and infrastructure boundaries. Security constraints (no hardcoded credentials, least-privilege access) must be enforced without making local development painful.

---

## Solution

The architecture replaces synchronous processing with an asynchronous event pipeline.

When a client submits an event, the API publishes it to an SNS topic and returns immediately. SNS delivers the event to an SQS queue, which acts as a durable buffer. A background worker polls this queue, processes the event (enriches it with session context, persists it to MongoDB), and publishes the result to Redis pub/sub. The API — which is subscribed to the same Redis channel — receives the processed event and pushes it to the user's browser via Server-Sent Events.

The entire flow is asynchronous after the initial API call. The user sees confirmation of their submission instantly, then receives the processed result in real time without refreshing or polling.

---

## Architecture Highlights

**Backend Service (API)**: An Express.js application running in ECS Fargate. It serves REST endpoints for session management, event submission, and event history, and runs an SSE server for real-time push. It publishes events to SNS and subscribes to Redis for processed event broadcasts.

**Worker Service**: A Node.js consumer process running in ECS Fargate. It continuously polls SQS, processes messages (session enrichment, database write, Redis publish), and exposes Prometheus metrics. It implements circuit breakers and bounded retry logic.

**Event Queue (SQS)**: The durable buffer between producers and consumers. Provides at-least-once delivery, visibility timeouts for retry, and a Dead Letter Queue for poison messages.

**MongoDB**: The event store. Chosen for flexible JSON document storage that accommodates free-form event payloads without schema migrations.

**Redis**: Dual role: session cache for user context enrichment, and pub/sub event bus for real-time SSE broadcasting to API instances.

**Observability Pipeline**: OpenTelemetry instrumentation in both services sends traces to an ADOT Collector sidecar, which exports to AWS X-Ray. Prometheus scrapes application metrics from both services. CloudWatch collects ECS logs. Promtail ships structured logs to Loki for logQL querying.

---

## Key Engineering Decisions

### Why Event-Driven Processing?

Synchronous processing creates a direct dependency between event write latency and API response time. In an event-driven model, the API accepts and acknowledges events as fast as it can publish to SNS, then returns. Processing happens asynchronously in workers. This means slow database writes, third-party API calls, or complex business logic cannot back up the API response path.

The trade-off is eventual consistency: the client sees the processed event a short time after submission, not instantaneously. For this use case, that gap is acceptable because SSE delivers the result within milliseconds of completion.

### Why SNS + SQS?

SNS provides infrastructure-level pub/sub decoupling. Any number of producers can publish without knowing about consumers. SQS adds durability — messages survive worker crashes, task replacements, and ECS interruptions. SQS handles visibility timeouts, DLQ routing, and approximate message counts out of the box. Together they replace the need for a custom message broker (Kafka, RabbitMQ) with a fully managed, auditable, and cost-effective alternative.

The backend publishes to SNS rather than directly to SQS to keep the architecture extensible: adding a new consumer (analytics worker, notification worker) requires only subscribing a new SQS queue to the existing SNS topic.

### Why Redis Pub/Sub?

Redis pub/sub is used to broadcast processed events from workers back to API instances for SSE delivery. This is specifically *not* for durability — events are already in MongoDB. Pub/sub is chosen for latency: it is sub-millisecond broadcast with no acknowledgment overhead.

The alternative is polling MongoDB from each API instance, which scales poorly with client count and adds database load. WebSockets would require explicit connection management and a sticky routing layer. SSE with Redis pub/sub gives the backend the lowest operational complexity while supporting multiple API instances behind a load balancer in the future.

### Why ECS Fargate?

ECS Fargate was chosen over EC2 Auto Scaling Groups, EKS, and Lambda for a specific set of constraints.

- **vs Lambda**: Workers need long-running SQS polling loops with unlimited runtime. Lambda has 15-minute execution limits and cold-start variance that complicate persistent consumers. The API also needs consistent response latency, which Lambda's concurrency burst limits can compromise under load.
- **vs EKS**: Kubernetes is powerful but introduces etcd, control plane management, \u0001oad balancing configuration, and operator overhead. For two services with standard deployment needs, ECS Fargate provides equivalent scheduling semantics with roughly one-tenth the moving parts.
- **vs EC2 ASG**: No patching, SSH access, or capacity planning is required. Fargate tasks are replaced transparently.

Fargate Spot reduces compute cost significantly. The only operational consideration is Spot interruption, which is handled by SQS message durability — an interrupted worker task restarts and resumes polling without data loss.

### Why OpenTelemetry + ADOT + AWS X-Ray?

OpenTelemetry was chosen as the instrumentation layer because it is vendor-neutral. The application code uses standard OTLP exporters, meaning the telemetry backend can be changed without modifying instrumentation logic.

The ADOT Collector as a sidecar separates the export pipeline from application logic. The collector configuration lives in SSM Parameter Store, not in the container image. Changing batch sizes, adding processors, or switching to a different trace backend requires only a Parameter Store update and container restart — no application redeployment.

AWS X-Ray is the trace sink, chosen for native integration with the ECS ecosystem, pre-built service maps, and per-segment trace inspection. The trade-off is vendor lock-in at the storage layer, but application-level instrumentation remains portable.

---

## Reliability & Resilience

The system's resilience strategy operates at multiple layers.

**SQS Retries**: Messages that fail processing are re-delivered by SQS after their visibility timeout expires. This handles transient worker failures without any application code. The `receiveCount` attribute tracks delivery attempts; after three failures, messages enter the DLQ for manual inspection.

**Circuit Breakers**: The worker maintains circuit breakers for MongoDB and Redis. When either dependency fails repeatedly, the circuit opens and the worker stops calling it, reducing error volume and giving the dependency time to recover. State transitions (CLOSED → OPEN → HALF-OPEN → CLOSED) are exposed as Prometheus gauges, enabling pre-alerting on dependency degradation before job failures spike.

**Retry Service**: SQS API calls (`receiveMessages`, `deleteMessage`, `testSQSConnection`) use a bounded exponential backoff retry implementation. Transient errors (`ECONNRESET`, `ETIMEDOUT`, `ServiceUnavailable`) are retried; permanent errors fail fast. The startup connection test with 5 retries ensures the worker exits quickly if the queue is unreachable, rather than entering a silent failure state.

**Failure Isolation**: If the backend fails, events queue in SQS and workers continue processing. If a worker fails, events queue and the backend continues accepting submissions. If Redis fails, SSE updates stop but MongoDB and SQS remain operational. Each dependency's failure domain is bounded.

---

## Observability

The observability strategy unifies traces, metrics, and logs across service boundaries without coupling any single tooling decision to the application.

**Distributed Traces** — OpenTelemetry spans flow from the API through SNS/SQS into the worker. Context propagation across the messaging boundary is explicit: the backend includes the `traceparent` in SNS message attributes, and the worker extracts it on consumption. This preserves the causal trace chain across two separate ECS tasks and two independent processes.

**Metrics** — Both services expose `/metrics` in Prometheus format using `prom-client`. The backend tracks request latency, request volume, and active connections. The worker tracks job throughput, duration, queue depth, circuit breaker state, database operation timing, Redis errors, SQS errors, and worker uptime. These metrics enable per-job-type SLA measurement and automated scaling decisions.

**Logs** — CloudWatch Logs capture all application output and ADOT collector logs with 7-day retention. A separate Loki/Promtail pipeline ships structured JSON logs for developers, enabling logQL queries correlated with metrics and traces. This dual approach satisfies compliance retention requirements while preserving the developer experience.

**Diagnostic Flow** — When something degrades, engineers can start from a rising queue depth in Prometheus, drill into specific failed jobs in X-Ray, and cross-reference error logs in Loki or CloudWatch. Circuit breaker state provides early warning before failures become user-visible.

---

## Security

No credentials exist in the codebase, environment files, or container images.

All secrets — MongoDB connection string, Redis password, SQS ARNs, SNS topic ARN — are stored in AWS Secrets Manager and injected at task runtime via the ECS secrets integration. The ADOT collector configuration is in SSM Parameter Store, scoped to `ssm:GetParameters` on the specific `observability/adot-config` path.

IAM uses two distinct roles with least-privilege policies. The ECS execution role (image pull, SSM reads, Secrets Manager reads, CloudWatch writes) is separate from the task role (SNS publish, SQS access, X-Ray writes). No IAM credentials appear in application code.

---

## Scalability

The architecture scales horizontally at each layer without coordinated deployments.

The backend is stateless. SSE connections are ephemeral — clients reconnect via `EventSource` and reload state from the API. Session state lives in Redis, not in process memory. Adding backend tasks increases client capacity without touching any other component.

The worker scales by increasing the ECS service `DesiredCount`. SQS distributes messages across all pollers automatically. Each worker task is small (256 CPU / 512 MB), making per-unit cost low and enabling many instances during load spikes.

Redis pub/sub is inherently decoupled: workers publish without knowing which API instances are listening. Adding API instances increases SSE delivery capacity without any coordination with the worker layer.

Queue-based decoupling means burst traffic is absorbed by SQS while workers drain at their own pace. Event producers are never blocked by consumer capacity.

---

## Technologies Used

**Infrastructure**
- AWS ECS Fargate
- AWS CloudFormation
- AWS IAM (task roles, execution roles)
- AWS SNS
- AWS SQS + DLQ
- AWS Secrets Manager
- AWS SSM Parameter Store
- AWS CloudWatch Logs
- AWS X-Ray

**Backend**
- Node.js, Express
- MongoDB (Mongoose)
- Prometheus (`prom-client`)
- OpenTelemetry (`@opentelemetry/api`, `@opentelemetry/sdk-node`)

**Worker**
- Node.js
- OpenTelemetry
- Prometheus (`prom-client`)
- Circuit Breaker pattern
- Bounded exponential retry

**Frontend**
- React (SSE via `EventSource`)

**Logging & Observability**
- Loki
- Promtail
- ADOT Collector

---

## What I Learned

**On distributed systems**: Explicit trace context propagation across message boundaries is essential. Without it, a trace from the API to SNS to the worker shows as three disconnected spans — making it impossible to understand end-to-end latency or attribute failures to a root cause.

**On event-driven architecture**: Decoupling producers from consumers with a managed queue is significantly simpler than building a custom broker, but it requires accepting eventual consistency. Designing the consumer to be idempotent (or at least tolerant of duplicates) is a prerequisite, not an afterthought.

**On production observability**: Instrumentation is most valuable when it answers operational questions: "How many events are stuck?" "Which dependency is failing?" "What was the latency distribution for job type X?" Custom metrics aligned to business operations matter more than generic infrastructure dashboards.

**On AWS infrastructure**: Fargate Spot with SQS is a practical combination. The Spot interruption risk is real, but when the queue is durable, the worst case is a processing delay. This cost trade-off is worth evaluating early instead of defaulting to on-demand.

**On designing for failure**: Circuit breakers are most useful when their state is observable. Exposing circuit breaker state as a metric means you can alert on infrastructure degradation (Redis becoming flaky) before it surfaces as a job failure rate spike.

---

## Future Improvements

These represent realistic production-hardening steps, ordered by operational impact.

1. **Auto Scaling**: ECS target tracking on worker `queue_depth` and backend `active_connections` would eliminate manual scaling during load spikes.

2. **Private Networking**: Moving tasks to private subnets with a NAT Gateway and an Application Load Balancer improves the security posture and removes public IP exposure.

3. **Amazon Managed Prometheus + Grafana**: Replacing self-hosted Prometheus with AMP and AMG removes operational overhead while providing the same query and dashboard capabilities.

4. **Authentication**: Integrating with Cognito or JWT-based auth would replace the current self-declared identity model, enabling per-user rate limits and actual authorization enforcement.

5. **Rate Limiting**: Express-level or ALB-level rate limiting protects the API from abusive clients and prevents a single session from monopolizing worker capacity.

6. **Multi-Worker Deployments**: The worker codebase already supports multiple worker types via the `WORKER_TYPE` constant. Extending this to separate services (notification, analytics) would allow independent scaling and deployment per pipeline stage.

7. **Distributed Caching**: Moving from a single Redis instance to ElastiCache Cluster mode eliminates the single-node bottleneck and provides automatic failover for session state.

---

## Conclusion

This project demonstrates that production-grade distributed systems don't require hundreds of services or Kubernetes clusters. Careful selection of managed services, explicit failure handling at the worker layer, and a unified observability strategy are what make a system reliable in practice. The architecture prioritizes operational clarity — every component has a single responsibility, failure domains are bounded, and the telemetry stack covers the full request lifecycle from API ingress to SSE delivery.
