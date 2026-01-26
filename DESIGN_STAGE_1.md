# Job Processing System – Stage 1

## 1️⃣ Problem Statement
This system allows users to submit jobs and view their results.
Stage 1 focuses on a **minimal working loop** with synchronous processing to ensure the end-to-end job lifecycle works and to simulate CPU-bound tasks for testing concurrency limits.

---

## 2️⃣ Current Scope
- Single Node.js API (Express)
- Jobs stored in MongoDB (or any preferred DB)
- Synchronous job processing executed immediately on submission
- Minimal logging
- CPU-bound simulation using `while` loop
- Optional I/O simulation using `setTimeout` to mimic slow operations
- No queue, no background workers, no scaling

---

## 3️⃣ Core Concepts
- **User** → Submits jobs
- **Job** → Unit of work (task)
- **Status** → Tracks job lifecycle (`CREATED` → `RUNNING` → `FAILED` → `FINISHED`)
- **Result** → Output of the job (simulated in Stage 1)

---

## 4️⃣ API Endpoints
- `POST /jobs` → Submit a new job
- `GET /jobs/:id` → Retrieve job status/result
- `GET /jobs` → (Optional) List all jobs

---

## 5️⃣ Implementation Notes
- Node.js API handles all job processing **synchronously**
- Jobs stored in DB with lifecycle: `CREATED` → `RUNNING` → `FINISHED`
- Minimal validation for input
- CPU-bound simulation via blocking `while` loop
- I/O-bound simulation via `setTimeout` (optional)
- Simple logging for job creation, start, finish, or failure
- Single-user and low concurrency assumed
- **Sessions are in-memory only** (no global store yet)

---

## 6️⃣ Stage 1 Postmortem

### ✅ Works
- Job creation and synchronous processing complete correctly
- API endpoints respond as expected
- Job lifecycle transitions observable (`CREATED` → `RUNNING` → `FINISHED`)
- CPU-bound simulation demonstrates blocking behavior for testing

### ⚠️ Limitations
- Long jobs block the API → concurrent requests fail to progress
- Only one job processed per thread at a time
- No retries or failure handling
- Memory-based sessions (single process only) → not suitable for clusters
- Not designed for heavy load or multiple users

### 🧠 Assumptions
- Jobs are short (<2–3 seconds)
- Single-user or minimal concurrency
- CPU/I-O simulation only, not real production load
- Sessions are in-memory; Stage 3 will introduce shared session store when clustering

### 🔧 Next Stage Triggers
- Introduce background queue + workers for parallel CPU-bound jobs
- Add retries and failure handling
- Simulate multiple users and higher load

---

## 7️⃣ Metrics / Observations (Optional)
- Time taken per job: 2–5 seconds (including CPU-bound simulation)
- Number of jobs processed concurrently: 1 per process
- Logs show correct job state transitions
- API blocked while CPU-bound tasks run → triggers Stage 2 improvements

---

## 8️⃣ Future Ideas (Stage 2+)
- Background queue (Redis/Kafka) for CPU-bound and slow I/O tasks
- Worker processes / horizontal scaling
- Retry mechanisms, dead-letter queue
- Observability: logs, metrics, dashboards
- Multi-user authentication & roles
- Kubernetes deployment for scalable production
