# Job Processing System – Stage 3

## 📌 Stage 3 Summary
Stage 3 implements **horizontal scaling** for the job processing system. Multiple Node.js processes (or workers) handle requests concurrently, and sessions are stored in a **shared Redis store** to ensure consistency across processes. Background jobs can now be processed in parallel, and the system is prepared for higher concurrency and multiple users.

---

## 1️⃣ Problem Statement
The system must scale horizontally to handle **multiple concurrent users and jobs**.  
Stage 3 focuses on distributing requests and background jobs across multiple processes, maintaining session consistency, and ensuring jobs can run in parallel without conflicts.

---

## 2️⃣ Current Scope
- Multiple Node.js API processes (clustered or separate servers)
- Redis used for **shared session storage**
- Jobs stored in MongoDB (or any preferred DB)
- Background queue workers process CPU-bound and I/O-bound tasks in parallel
- Load balancing simulated via cluster or multiple processes
- Logging enhanced for multiple processes
- Sessions no longer in-memory; accessible across all workers

---

## 3️⃣ Core Concepts
- **User** → Can connect to any worker process
- **Session** → Stored in Redis; shared across all processes
- **Worker / Process** → Handles incoming requests and background jobs independently
- **Job** → Unit of work executed by available worker
- **Status** → Tracks job lifecycle (`CREATED` → `RUNNING` → `FAILED` → `FINISHED`)
- **Result** → Output of the job (simulated or real)

---

## 4️⃣ API Endpoints
- `POST /jobs` → Submit a new job
- `GET /jobs/:id` → Retrieve job status/result
- `GET /jobs` → (Optional) List all jobs
- `POST /login` → Authenticate user and store session in Redis
- `POST /logout` → Destroy session in Redis
- `GET /status` → Check which worker handled the request (for testing scaling)

---

## 5️⃣ Implementation Notes
- Multiple Node.js processes can handle requests concurrently
- Sessions are stored in Redis to ensure **session consistency**
- Jobs can now be executed in parallel by different worker processes
- Job lifecycle updates are visible from any process
- CPU-bound and I/O-bound simulations continue in background queues
- Logging tracks worker ID, job status, and session info
- Load balancing is simulated; real-world deployment may use PM2, Kubernetes, or external load balancers
- Retry mechanisms and failure handling are **not yet fully implemented** (planned for Stage 4)

---

## 6️⃣ Stage 3 Postmortem

### ✅ Works
- Multiple processes handle requests concurrently
- Shared session store (Redis) ensures session consistency across processes
- Background jobs can run in parallel without conflicts
- API remains responsive while jobs execute in background
- Worker and job logs track processing accurately

### ⚠️ Limitations
- Clustered processes still require Redis; Redis availability is critical
- No full failover strategy yet for crashed workers
- Load balancing is simulated, not fully production-ready
- Retry and dead-letter handling still missing
- Observability is limited; metrics dashboards not yet implemented

### 🧠 Assumptions
- Redis is reliable and accessible to all processes
- Jobs are short and manageable for current worker setup
- Stage 2 background queue already implemented and functional
- Sessions need to be shared across processes; no sticky sessions assumed
- Each worker is independent; communication is via Redis and DB

### 🔧 Next Stage Triggers
- Introduce **reliability & observability**:
  - Monitor worker health and Redis availability
  - Implement retries for failed jobs
  - Add logging, metrics, and dashboards
- Consider multiple physical servers and real load balancing
- Implement failover for crashed workers

---

## 7️⃣ Metrics / Observations (Optional)
- CPU usage per worker process
- Number of jobs processed concurrently across all workers
- Redis latency for session reads/writes
- Logs indicate proper job lifecycle tracking across multiple processes

---

## 8️⃣ Future Ideas (Stage 4+)
- Advanced reliability and observability (monitoring dashboards, alerts)
- Retry mechanisms and dead-letter queue for failed jobs
- Autoscaling of workers based on CPU/memory thresholds
- Sticky sessions if needed for certain APIs
- Kubernetes deployment for full horizontal scaling and failover
- Session replication or backup for Redis
