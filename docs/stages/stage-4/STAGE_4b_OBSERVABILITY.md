# Observability & Monitoring

## Objective
Observability in a distributed system provides operational visibility into how requests flow, where failures occur, and why performance degrades. Its purpose is to reduce detection and diagnosis time, improve reliability under load and failure, and give teams confidence that system behavior is understood in production.

---

## 1. Request Lifecycle Visibility
A complete request path should be observable from initiation to final outcome, including synchronous and asynchronous transitions.

- **Entry point (API Gateway / Service):** Request arrival, route selection, authentication/authorization outcomes, and initial request metadata.
- **Internal service communication:** Service-to-service calls, dependency chains, response outcomes, and propagation of request context.
- **Queue publishing and consumption:** Message publication success/failure, enqueue timestamp, consumer pickup, and delivery attempts.
- **Worker processing:** Job start/end, processing stage transitions, retries, and terminal state (success/failure).
- **Database interactions:** Query execution timing, result status, contention signals, and transaction outcomes.
- **External API calls:** Outbound request attempts, response codes, timeout behavior, and fallback/circuit-break outcomes.

---

## 2. Metrics (What Must Be Measured)
Metrics should quantify demand, correctness, latency, saturation, and asynchronous pipeline health.

### Traffic Metrics
- Request count
- Throughput (RPS)
- Request distribution per route

### Error Metrics
- Error rate
- Failed jobs
- DLQ size

### Latency Metrics
- Request latency (P50, P95, P99)
- Queue processing time
- Worker execution time

### Resource Metrics
- CPU usage
- Memory usage
- Disk I/O
- Network I/O

### Queue Metrics
- Queue depth
- Message delay
- Retry count

---

## 3. Logging (What Must Be Logged)
Logs should capture events and failure context with enough detail to reconstruct what happened without replaying production traffic.

- Structured logs (JSON format)
- Correlation identifiers (`traceId`, `requestId`)
- Key events (request start, request end, errors)
- Business events (job processed, event published)
- Error logs with full context
- Retry and failure logs

---

## 4. Distributed Tracing (What Must Be Traceable)
Tracing should show causal flow and timing across all boundaries, including asynchronous handoffs.

- End-to-end trace across services
- Trace propagation across async boundaries (queues/events)
- Spans for:
  - API request handling
  - External calls
  - DB queries
  - Queue publish/consume
- Error tagging in spans
- Latency breakdown per component

---

## 5. Failure Visibility
Failure analysis should be possible from telemetry alone, without guesswork.

- Where did the request fail?
- Which service failed?
- What was the last successful step?
- Retry attempts visibility
- DLQ inspection capability

---

## 6. Alerting (What Should Trigger Alerts)
Alerts should reflect user impact, operational risk, and degradation trends.

- High error rate
- Increased latency
- Queue backlog spike
- Worker failure rate
- Resource exhaustion

---

## 7. Correlation Across Signals
Operational triage depends on connecting all telemetry types into one investigation flow.

- Logs linked to `traceId`
- Metrics correlated with traces
- Ability to jump from trace -> logs -> metrics

---

## 8. Debugging Workflow (Mental Model)
A consistent investigation path helps teams debug quickly during incidents.

1. Identify failing request via metrics/alerts
2. Open trace to locate failure point
3. Inspect logs for detailed error context
4. Validate system health via metrics

---

## 9. System Coverage Expectations
Coverage should ensure no critical runtime path is invisible.

- All services emit logs, metrics, and traces
- All async workflows are traceable
- No blind spots in request lifecycle

---

## 10. Observability Maturity Checklist
Use this checklist to evaluate whether observability is actionable in production.

- Can we trace a request end-to-end?
- Can we identify bottlenecks?
- Can we detect failures in real time?
- Can we debug without reproducing locally?
