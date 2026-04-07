# Job Processing System – Stage 1

## 📌 Stage 1 Summary
Stage 1 implements a **minimal working job processing system**. It allows users to submit jobs and observe their lifecycle, with basic CPU-bound and I/O-bound task simulations. This stage focuses on validating the **end-to-end flow**, logging, and minimal API behavior without background queues, retries, or scaling.

---

## 1️⃣ Problem Statement
This system allows users to submit jobs and view their results.  
Stage 1 focuses on a **minimal working loop** with synchronous and simulated asynchronous processing to ensure the end-to-end job lifecycle works and to simulate CPU/I-O-bound tasks for testing concurrency limits.

---

## 2️⃣ Current Scope
- Single Node.js API (Express)
- Jobs stored in MongoDB (or any preferred DB)
- Synchronous job processing executed immediately on submission
- Minimal logging
- CPU-bound simulation using `while` loop (blocks Node.js for long tasks; acceptable for Stage 1)
- I/O-bound simulation using `setTimeout` to mimic slow operations asynchronously
- No queue, no background workers, no scaling
- Single-process sessions only (no global session store yet)

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
- `GET /jobs` → (Optional) List all jobs (not optimized for large datasets yet)

---

## 5️⃣ Implementation Notes
- Node.js API handles job creation and starts execution immediately
- Jobs stored in DB with lifecycle: `CREATED` → `RUNNING` → `FINISHED`
- Minimal input validation
- CPU-bound simulation may block Node.js (`while` loop); acceptable for Stage 1
- I/O-bound simulation uses `setTimeout` to mimic async behavior
- Response sent immediately with `Job started` message
- Background simulation continues updating job status (`FAILED` or `FINISHED`) in DB
- Console logging for all state changes for postmortem testing
- Single-user and low concurrency assumed
- **Sessions are in-memory only** (no global store yet)

---

## 6️⃣ Stage 1 Postmortem

### ✅ Works
- Job creation and execution triggers correctly
- Response sent immediately to client (`Job started`)
- Job lifecycle updates (`RUNNING` → `FAILED`/`FINISHED`) logged in console
- Polling `/jobs/:id` shows final status
- CPU/I-O simulation demonstrates asynchronous behavior

### ⚠️ Limitations
- CPU-bound simulation can block Node.js event loop for long tasks
- Only one job processed per process for CPU-bound tasks
- No retries or failure handling
- Memory-based sessions (single process only) → not suitable for clusters
- Not designed for heavy load or multiple users

### 🧠 Assumptions
- Jobs are short (<2–3 seconds)
- Single-user or minimal concurrency
- CPU/I-O simulation after response mimics background execution
- Sessions are in-memory; Stage 3 will introduce shared session store when clustering

### 🔧 Next Stage Triggers
- Introduce background queue + workers for parallel CPU-bound jobs
- Add retries and failure handling
- Simulate multiple users and higher load

---

## 7️⃣ Metrics / Observations (Optional)
- Time taken per job: 2–5 seconds (including simulation)
- Number of jobs processed concurrently: 1 per process for CPU-bound tasks
- Logs show correct state transitions
- API responds immediately while simulation continues in background

---

## 8️⃣ Future Ideas (Stage 2+)
- Background queue (Redis/Kafka) for CPU-bound and slow I/O tasks
- Worker processes / horizontal scaling
- Retry mechanisms, dead-letter queue
- Observability: logs, metrics, dashboards
- Multi-user authentication & roles
- Kubernetes deployment for scalable production