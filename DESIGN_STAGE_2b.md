# Job Processing System – Stage 2b: Fanout & Kafka Experimentation

## 📌 Stage 2b Summary
Stage 2b introduces **fanout design** using a message broker (Kafka) to allow **parallel processing of jobs by multiple workers**.  
This stage builds on Stage 2’s background queue setup and focuses on **message-driven architecture**, enabling tasks to be broadcast to multiple consumers (fanout) and supporting future horizontal scaling.

---

## 1️⃣ Problem Statement
The system needs to handle **jobs that can be processed in parallel by multiple workers**.  
Stage 2b explores **fanout patterns** to broadcast jobs to multiple workers using Kafka, allowing multiple consumers to process different tasks or replicate work if needed.  
Additionally, this stage introduces **Kafka partitions, keys, and offsets** to control **parallelism, ordering, and reliable message processing**.

---

## 2️⃣ Current Scope
- Kafka as the **message broker**
- Producers publish jobs to topics
- Consumers (workers) subscribe to topics and process jobs asynchronously
- Jobs stored in MongoDB (or preferred DB)
- Single Node.js API process publishes jobs (horizontal scaling not yet implemented)
- Session management still in-memory (shared sessions added later in Stage 3)
- Logging of produced and consumed messages for testing and observation
- Simple partitioning strategy: **jobId as key** to assign partitions
- **Retry mechanism** with configurable max retries and backoff strategies
- **Dead-Letter Queue (DLQ)** for jobs that exceed retry limits
- **Multi-service architecture** with notification service as fanout example
- **Idempotent processing** to handle duplicate messages safely

---

## 3️⃣ Core Concepts

| Concept       | Description                                                                 |
|---------------|-----------------------------------------------------------------------------|
| **Producer**  | Publishes jobs/events to Kafka topics                                        |
| **Consumer**  | Subscribes to topics and processes jobs asynchronously                       |
| **Topic**     | Logical channel for a type of job or task                                    |
| **Partition** | Sub-log inside a topic; messages in a partition are ordered; defines parallelism |
| **Key**       | Determines partition assignment for each message (hash(key) % partitions)    |
| **Fanout**    | Multiple consumer groups can consume the same topic independently           |
| **Job**       | Unit of work, may be CPU-bound or I/O-bound                                  |
| **Status**    | Job lifecycle tracked in DB (`CREATED` → `RUNNING` → `FAILED` → `FINISHED`) |
| **Offset**    | Position of a message in a partition; controls where consumers resume        |
| **Idempotency** | Required to safely handle redelivered messages and at-least-once delivery  |
| **Retry** | Automatic reprocessing of failed jobs with exponential backoff  |
| **DLQ** | Dead-Letter Queue for permanently failed jobs after max retries  |
| **Multi-Service** | Multiple independent services consuming from same topic (fanout)  |


---

## 4️⃣ API Endpoints
- `POST /jobs` → Submit a new job (publishes to Kafka topic with key)
- `GET /jobs/:id` → Retrieve job status/result
- `GET /jobs` → (Optional) List all jobs
- `POST /login` → Authenticate user (in-memory session for Stage 2b)
- `POST /logout` → Destroy session

---

## 5️⃣ Implementation Notes
- Jobs are **produced** to Kafka topics instead of directly adding to a local queue
- **Keys** (e.g., jobId) are used to assign partitions → controls ordering and load distribution
- **Consumers pull jobs asynchronously from partitions** and execute them
- **Fanout design** allows:
  - Multiple consumers processing jobs from the same topic independently
  - Broadcasting tasks to several worker services (e.g., analytics, notifications)
- **Parallelism is limited by the number of partitions**:
  - Max active jobs in parallel = number of partitions per topic per consumer group
  - Multiple jobs in the same partition are processed sequentially
- **Offset management**:
  - Each partition has its own offset
  - Auto-commit vs manual commit determines whether unprocessed jobs are redelivered
- **Logging tracks**:
  - Which consumer processed which job
  - Job lifecycle updates
- **CPU-bound and I/O-bound tasks continue to be simulated**
- **Single Node.js API process publishes jobs; scaling to multiple producers happens in Stage 3**
- **Retry mechanism implemented**:
  - Configurable `MAX_RETRIES` (default: 3)
  - Retry topics with delays: `jobs.retry.5s`, `jobs.retry.30s`
  - Exponential backoff through topic selection
- **DLQ functionality implemented**:
  - Failed jobs sent to `jobs.DLQ` topic after max retries
  - DLQ messages include error details, retry count, and failure timestamp
- **Multi-service fanout implemented**:
  - Notification service consumes from `jobs` topic independently
  - Demonstrates broadcasting pattern for multiple services
- **Observability is limited; focus is on learning Kafka, fanout, partitions, keys, and offsets**

---

## 6️⃣ Stage 2b Postmortem

### ✅ Works
- Jobs successfully produced to Kafka topics with keys
- Consumers pick up jobs and update lifecycle in DB
- Fanout pattern demonstrates multiple workers can process same or partitioned jobs
- Max parallelism = number of partitions per topic per consumer group
- API remains responsive while consumers process jobs asynchronously
- **Retry mechanism** successfully reprocesses failed jobs with backoff
- **DLQ** captures permanently failed jobs for manual inspection
- **Multi-service architecture** enables notification service to consume independently
- **Idempotent processing** prevents duplicate job execution

### ⚠️ Limitations
- Single API process only (no horizontal scaling yet)
- In-memory sessions; not shared across processes
- Limited monitoring and metrics
- **Retry configuration is basic** (fixed backoff intervals)
- **DLQ monitoring requires manual inspection**
- **No circuit breaker pattern** for cascading failures
- Ordering is **guaranteed only within partitions**, not across partitions

### 🧠 Assumptions
- Kafka broker is running locally or in simple dev cluster
- Workers are single-process Node.js consumers
- Jobs are short (<5 seconds) for testing fanout
- Each job has a unique key (jobId) → partition assignment controlled by hash
- Focus is **educational / experimental**, not production-ready

### 🔧 Next Stage Triggers
- Stage 3: integrate Kafka with **multiple Node.js processes** for horizontal scaling
- **Enhance retry mechanisms** with configurable exponential backoff and jitter
- **Implement DLQ monitoring** and automated alerting
- **Add circuit breaker pattern** for fault tolerance
- Use shared sessions (Redis) for multi-process consistency
- Increase partitions if parallelism becomes a bottleneck

---

## 7️⃣ Metrics / Observations (Optional)
- Time from producing a job to consumption
- Number of consumers processing jobs concurrently vs partitions
- Job lifecycle tracking in DB
- Logging shows which consumer handled which job
- Observed duplicate processing when offsets are not committed manually
- **Retry metrics**: number of retries per job, retry success rate
- **DLQ metrics**: number of jobs in DLQ, failure patterns
- **Multi-service metrics**: notification service processing time

---

## 8️⃣ Future Ideas (Stage 3+)
- Multiple Node.js API processes producing jobs to Kafka
- Horizontal scaling with multiple worker processes consuming jobs
- Partitioning strategies for Kafka topics to balance load
- Observability: metrics, dashboards, alerts
- Integration with Redis sessions and failure recovery
- Sticky sessions or advanced routing for jobs if required
- **Advanced retry patterns**: exponential backoff with jitter, custom retry policies
- **DLQ automation**: automated replay, monitoring dashboards, alerting
- **Service mesh integration** for multi-service communication patterns
- **Circuit breaker implementation** for fault tolerance
- **Distributed tracing** across multi-service job processing
