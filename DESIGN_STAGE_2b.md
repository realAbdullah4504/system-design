# Job Processing System – Stage 2b: Fanout & Kafka Experimentation

## 📌 Stage 2b Summary
Stage 2b introduces **fanout design** using a message broker (Kafka) to allow **parallel processing of jobs by multiple workers**. This stage builds on Stage 2’s background queue setup and focuses on **message-driven architecture**, enabling tasks to be broadcast to multiple consumers (fanout) and supporting future horizontal scaling.

---

## 1️⃣ Problem Statement
The system needs to handle **jobs that can be processed in parallel by multiple workers**.  
Stage 2b explores **fanout patterns** to broadcast jobs to multiple workers using Kafka, allowing multiple consumers to process different tasks or replicate work if needed.

---

## 2️⃣ Current Scope
- Kafka as the **message broker**
- Producers publish jobs to topics
- Consumers (workers) subscribe to topics and process jobs asynchronously
- Jobs stored in MongoDB (or preferred DB)
- Single Node.js API process publishes jobs (horizontal scaling not yet implemented)
- Session management still in-memory (shared sessions added later in Stage 3)
- Logging of produced and consumed messages for testing and observation

---

## 3️⃣ Core Concepts
- **Producer** → Publishes jobs/events to Kafka topics
- **Consumer** → Subscribes to topics and processes jobs
- **Topic** → Logical channel for a type of job or task
- **Fanout** → Multiple consumers can receive the same message or different partitions of work
- **Job** → Unit of work, may be CPU-bound or I/O-bound
- **Status** → Job lifecycle tracked in DB (`CREATED` → `RUNNING` → `FAILED` → `FINISHED`)

---

## 4️⃣ API Endpoints
- `POST /jobs` → Submit a new job (publishes to Kafka topic)
- `GET /jobs/:id` → Retrieve job status/result
- `GET /jobs` → (Optional) List all jobs
- `POST /login` → Authenticate user (in-memory session for Stage 2b)
- `POST /logout` → Destroy session

---

## 5️⃣ Implementation Notes
- Jobs are **produced** to Kafka topics instead of directly adding to a local queue
- Consumers pull jobs asynchronously from Kafka and execute them
- Fanout design allows:
  - Multiple consumers processing jobs from the same topic
  - Broadcasting tasks to several workers if needed
- Logging tracks:
  - Which consumer processed which job
  - Job lifecycle updates
- CPU-bound and I/O-bound tasks continue to be simulated
- Single Node.js API process publishes jobs; scaling to multiple producers happens in Stage 3
- Observability is limited; focus is on learning Kafka and fanout behavior

---

## 6️⃣ Stage 2b Postmortem

### ✅ Works
- Jobs successfully produced to Kafka topics
- Consumers pick up jobs and update lifecycle in DB
- Fanout pattern demonstrates multiple workers can process same or partitioned jobs
- API remains responsive while consumers process jobs asynchronously

### ⚠️ Limitations
- Single API process only (no horizontal scaling yet)
- In-memory sessions; not shared across processes
- Limited monitoring and metrics
- Retries, dead-letter queues, and exact-once processing not implemented yet

### 🧠 Assumptions
- Kafka broker is running locally or in simple dev cluster
- Workers are single-process Node.js consumers
- Jobs are short (<5 seconds) for testing fanout
- Focus is **educational / experimental**, not production-ready

### 🔧 Next Stage Triggers
- Stage 3: integrate Kafka with **multiple Node.js processes** for horizontal scaling
- Implement retries, dead-letter queues, and monitoring
- Use shared sessions (Redis) for multi-process consistency

---

## 7️⃣ Metrics / Observations (Optional)
- Time from producing a job to consumption
- Number of consumers processing jobs concurrently
- Job lifecycle tracking in DB
- Logging shows which consumer handled which job

---

## 8️⃣ Future Ideas (Stage 3+)
- Multiple Node.js API processes producing jobs to Kafka
- Horizontal scaling with multiple worker processes consuming jobs
- Partitioning strategies for Kafka topics to balance load
- Observability: metrics, dashboards, alerts
- Integration with Redis sessions and failure recovery
- Sticky sessions or advanced routing for jobs if required
