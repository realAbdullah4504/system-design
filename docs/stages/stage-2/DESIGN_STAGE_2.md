# Job Processing System – Stage 2

## 📌 Stage 2 Summary
Stage 2 introduces a **background job queue and asynchronous processing**.  
Jobs are no longer executed during API requests; instead, they are persisted and processed by a background worker. This stage focuses on **decoupling API responsiveness from job execution**, understanding failures, and handling crashes safely.

---

## 1️⃣ Problem Statement
Stage 1 exposed a major limitation: job execution was tightly coupled to API requests, causing blocking behavior for long-running tasks.

Stage 2 addresses this by introducing a **background queue**, allowing APIs to remain responsive while work is processed asynchronously. The focus is on **correctness, visibility, and failure awareness**, not performance or scaling.

---

## 2️⃣ Current Scope
- Single Node.js API (Express)
- Jobs persisted in MongoDB
- Logical queue implemented using job status (`QUEUED`)
- Background worker running in the same Node.js process
- Startup recovery for interrupted or crashed jobs
- No frontend (Postman / curl / scripts only)
- Single-process execution (no clustering)

---

## 3️⃣ Core Concepts
- **User / Producer** → Submits jobs
- **Job** → Persistent unit of work
- **Queue** → Derived from DB (`status = QUEUED`)
- **Worker** → Background loop polling the database
- **Status** → Tracks lifecycle  
  `CREATED → QUEUED → RUNNING → FAILED / FINISHED`
- **Recovery** → Re-queues orphaned `RUNNING` jobs on startup

---

## 4️⃣ API Endpoints
- `POST /jobs` → Create a new job (`CREATED`)
- `POST /jobs/:id/enqueue` → Enqueue job (`CREATED → QUEUED`)
- `GET /jobs/:id` → Retrieve job status/result
- `GET /jobs` → List jobs (optional status filtering)

---

## 5️⃣ Implementation Notes
- API layer only handles job creation and enqueueing
- Background worker polls DB on a fixed interval
- Worker claims jobs atomically using `findOneAndUpdate`
- Job execution is simulated using delays and random failures
- Results and errors are persisted in DB
- On server startup:
  - All jobs in `RUNNING` state are assumed orphaned
  - These jobs are moved back to `QUEUED`
- Execution model is **at-least-once**
- Duplicate execution is possible and acceptable in Stage 2
- Extensive logging used to observe failures and race conditions

---

## 6️⃣ Stage 2 Postmortem

### ✅ Works
- API remains responsive during long-running jobs
- Jobs survive server and database restarts
- Background execution is observable and debuggable
- Startup recovery prevents job loss
- Clear separation between API handling and execution

### ⚠️ Limitations
- Jobs may execute more than once
- No worker identity or heartbeat
- Polling-based queue is inefficient
- Only safe for a single worker
- No rate limiting or abuse protection

### 🧠 Assumptions
- Single Node.js process
- Low traffic
- Manual inspection acceptable
- Duplicate execution is tolerable
- Database availability assumed

### 🔧 Next Stage Triggers
- Duplicate execution becomes harmful
- Need multiple workers or processes
- Increased throughput requirements
- Need deterministic job ownership and retries

---

## 7️⃣ Metrics / Observations (Optional)
- Queue backlog size
- Average job execution time
- Number of jobs recovered on startup
- Frequency of job failures

---

## 8️⃣ Future Ideas (Stage 3+)
- Redis-backed queue
- Multiple workers / horizontal scaling
- Worker identity, leases, and heartbeats
- Retry limits and dead-letter queues
- Rate limiting and abuse protection
- Observability (metrics, dashboards)
- Kubernetes deployment