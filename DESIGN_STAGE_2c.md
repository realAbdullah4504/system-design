# Job Processing System – Stage 2b: Fanout & SNS/SQS Experimentation

## 📌 Stage 2b Summary
Stage 2b introduces **fanout design** using AWS messaging services (SNS/SQS) to allow **parallel processing of jobs by multiple workers**.  
This stage builds on Stage 2's background queue setup and focuses on **message-driven architecture**, enabling tasks to be broadcast to multiple consumers (fanout) and supporting future horizontal scaling.

---

## 1️⃣ Problem Statement
The system needs to handle **jobs that can be processed in parallel by multiple workers**.  
Stage 2b explores **fanout patterns** to broadcast jobs to multiple workers using AWS SNS/SQS, allowing multiple consumers to process different tasks or replicate work if needed.  
Additionally, this stage introduces **SNS topics, SQS queues, and message visibility timeouts** to control **parallelism, ordering, and reliable message processing**.

---

## 2️⃣ Current Scope
- **AWS SNS/SQS as the messaging infrastructure**
- SNS topic for publishing jobs
- Multiple SQS queues subscribed to SNS topic for fanout
- Producers publish jobs to SNS topic
- Consumers (workers) poll from SQS queues and process jobs asynchronously
- Jobs stored in MongoDB (or preferred DB)
- Single Node.js API process publishes jobs (horizontal scaling not yet implemented)
- Session management still in-memory (shared sessions added later in Stage 3)
- Logging of produced and consumed messages for testing and observation
- **Retry mechanism** with configurable max retries and backoff strategies
- **Dead-Letter Queue (DLQ)** for jobs that exceed retry limits
- **Multi-service architecture** with notification service as fanout example
- **Idempotent processing** to handle duplicate messages safely

---

## 3️⃣ Core Concepts

| Concept       | Description                                                                 |
|---------------|-----------------------------------------------------------------------------|
| **Producer**  | Publishes jobs/events to SNS topic                                         |
| **Consumer**  | Polls messages from SQS queues and processes jobs asynchronously           |
| **SNS Topic** | Central message distribution point for fanout pattern                       |
| **SQS Queue** | Message buffer for consumers; handles visibility and delivery guarantees    |
| **Message ID**| Unique identifier for each message; used for deduplication                  |
| **Fanout**    | SNS topic broadcasts to multiple SQS queues independently                   |
| **Job**       | Unit of work, may be CPU-bound or I/O-bound                                  |
| **Status**    | Job lifecycle tracked in DB (`CREATED` → `RUNNING` → `FAILED` → `FINISHED`) |
| **Visibility Timeout** | Time window where message is invisible to other consumers after polling |
| **Idempotency** | Required to safely handle redelivered messages and at-least-once delivery  |
| **Retry** | Automatic reprocessing of failed jobs with exponential backoff  |
| **DLQ** | Dead-Letter Queue for permanently failed jobs after max retries  |
| **Multi-Service** | Multiple independent services consuming from same SNS topic (fanout)  |


---

## 4️⃣ API Endpoints
- `POST /jobs` → Submit a new job (publishes to SNS topic)
- `GET /jobs/:id` → Retrieve job status/result
- `GET /jobs` → (Optional) List all jobs
- `POST /login` → Authenticate user (in-memory session for Stage 2b)
- `POST /logout` → Destroy session

---

## 5️⃣ Implementation Notes
- Jobs are **published** to SNS topic instead of directly adding to a local queue
- **SNS fanout** automatically distributes messages to all subscribed SQS queues
- **SQS queues** provide message buffering, visibility timeouts, and at-least-once delivery
- **Consumers poll messages from SQS queues** and execute them
- **Fanout design** allows:
  - Multiple SQS queues for different services (workers, notifications, analytics)
  - Each service processes jobs independently without affecting others
- **Parallelism is controlled by**:
  - Number of consumers per SQS queue
  - Visibility timeout settings
  - SQS queue configuration (standard vs FIFO)
- **Message visibility management**:
  - Messages become invisible to other consumers when being processed
  - Visibility timeout must be longer than processing time
  - Messages reappear in queue if not deleted within timeout
- **Logging tracks**:
  - Which consumer processed which job
  - Job lifecycle updates
- **CPU-bound and I/O-bound tasks continue to be simulated**
- **Single Node.js API process publishes jobs; scaling to multiple producers happens in Stage 3**
- **Retry mechanism implemented**:
  - Configurable `MAX_RETRIES` (default: 3)
  - Delay queues with different visibility timeouts for backoff
  - Exponential backoff through queue selection
- **DLQ functionality implemented**:
  - Failed jobs sent to dedicated DLQ SQS queue after max retries
  - DLQ messages include error details, retry count, and failure timestamp
- **Multi-service fanout implemented**:
  - Notification service has its own SQS queue subscribed to SNS topic
  - Demonstrates broadcasting pattern for multiple services
- **Observability is limited; focus is on learning SNS/SQS, fanout, visibility timeouts, and message delivery**

---

## 6️⃣ Stage 2b Postmortem

### ✅ Works
- Jobs successfully published to SNS topic and distributed to SQS queues
- Consumers pick up jobs from SQS queues and update lifecycle in DB
- Fanout pattern demonstrates multiple services can process same jobs independently
- Parallel processing achieved through multiple SQS queues and consumers
- API remains responsive while consumers process jobs asynchronously
- **Retry mechanism** successfully reprocesses failed jobs with backoff
- **DLQ** captures permanently failed jobs for manual inspection
- **Multi-service architecture** enables notification service to consume independently
- **Idempotent processing** prevents duplicate job execution
- **Message visibility timeouts** prevent duplicate processing during failures

### ⚠️ Limitations
- Single API process only (no horizontal scaling yet)
- In-memory sessions; not shared across processes
- Limited monitoring and metrics
- **Retry configuration is basic** (fixed backoff intervals)
- **DLQ monitoring requires manual inspection**
- **No circuit breaker pattern** for cascading failures
- **Message ordering is not guaranteed** across multiple SQS queues (unless using FIFO queues)
- **Visibility timeout configuration** requires careful tuning for different job types
- **AWS service dependencies** add external complexity and cost considerations

### 🧠 Assumptions
- AWS credentials and permissions are properly configured
- SNS topic and SQS queues are created and properly subscribed
- Workers are single-process Node.js consumers
- Jobs are short (<5 seconds) for testing fanout
- Visibility timeout is set appropriately for job processing time
- Focus is **educational / experimental**, not production-ready

### 🔧 Next Stage Triggers
- Stage 3: integrate SNS/SQS with **multiple Node.js processes** for horizontal scaling
- **Enhance retry mechanisms** with configurable exponential backoff and jitter
- **Implement DLQ monitoring** and automated alerting
- **Add circuit breaker pattern** for fault tolerance
- **Consider FIFO queues** for message ordering requirements
- Use shared sessions (Redis) for multi-process consistency
- **Optimize visibility timeouts** for different job processing patterns

---

## 7️⃣ Metrics / Observations (Optional)
- Time from publishing a job to consumption
- Number of consumers processing jobs concurrently per SQS queue
- Job lifecycle tracking in DB
- Logging shows which consumer handled which job
- **Message visibility timeout effectiveness** and reprocessing rates
- **Retry metrics**: number of retries per job, retry success rate
- **DLQ metrics**: number of jobs in DLQ, failure patterns
- **Multi-service metrics**: notification service processing time
- **SNS delivery metrics** and SQS queue depth monitoring

---

## 8️⃣ Future Ideas (Stage 3+)
- Multiple Node.js API processes producing jobs to SNS
- Horizontal scaling with multiple worker processes consuming from SQS
- **FIFO queues** for guaranteed message ordering when required
- Observability: metrics, dashboards, alerts
- Integration with Redis sessions and failure recovery
- Sticky sessions or advanced routing for jobs if required
- **Advanced retry patterns**: exponential backoff with jitter, custom retry policies
- **DLQ automation**: automated replay, monitoring dashboards, alerting
- **Service mesh integration** for multi-service communication patterns
- **Circuit breaker implementation** for fault tolerance
- **Distributed tracing** across multi-service job processing
- **AWS service optimization**: cost monitoring, queue provisioning, auto-scaling
