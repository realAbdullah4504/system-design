# Job Processing System – Stage 2a (Real Queue & Worker Ownership)

## 📌 Stage 2a Summary

Stage 2a introduces a **real distributed job queue** while still primarily single-process for API but **with multiple workers consuming from a central queue**.

The database is no longer used as a logical queue. Instead, a **Redis-backed queue** becomes the **source of truth for job execution**.

Correctness, ownership, and crash safety are now **enforced by infrastructure**, not conventions.

---

## 1️⃣ Problem Statement

Stage 2 relied on:

* Single-process execution
* Database polling
* Best-effort ownership semantics

These approaches break down when:

* Multiple workers exist
* Job duplication is harmful
* Crash recovery is needed

Stage 2a solves this by introducing a **real queue system** that provides:

* Deterministic job ownership
* Safe concurrency
* Automatic crash recovery
* Prepares system for horizontal scaling in Stage 3

---

## 1.1 Idempotency Implementation

**Reference:** [Understanding Idempotency: A Guide to Reliable System Design](https://leapcell.medium.com/understanding-idempotency-a-guide-to-reliable-system-design-d4c9ad8c19b8)

We've implemented **token-based idempotency** to prevent duplicate job creation:

### Token-Based Idempotency Flow:
1. **Generate Token** (`POST /tokens`) - Creates unique token with expiration
2. **Consume Token** - Atomic Redis DELETE operation validates and consumes token
3. **Create Job** - Only proceeds if token is valid and successfully consumed
4. **One-Time Use** - Token cannot be reused after successful job creation

### Implementation Details:
- **Token Service**: UUID-based tokens stored in Redis with TTL
- **Atomic Operations**: Redis DELETE ensures thread-safe token consumption
- **Frontend Integration**: React UI handles token lifecycle and job submission
- **Error Handling**: Clear feedback for expired/invalid tokens

### API Endpoints:
- `POST /tokens` - Generate new token with configurable expiration
- `POST /jobs` - Create job with token (token consumed on success)

### Frontend Features:
- Token generation and display
- Job creation form with token validation
- Real-time feedback on token status and job submission
- Automatic token cleanup after successful job creation

---

## 2️⃣ Current Scope

* Single API process (stateless)
* Multiple worker processes consuming from Redis
* MongoDB as **system of record** for job metadata and results
* Redis-backed queue (execution source of truth)
* React frontend with token-based job submission
* Token-based idempotency system

---

## 3️⃣ Core Concepts

### Queue (New Authority)

* Redis-backed queue (e.g. BullMQ)
* Responsible for:

  * Job ordering
  * Job locking / leasing
  * Retry behavior
  * Failure handling

### Job (Persistent State)

* Stored in MongoDB
* Contains:

  * jobId
  * status
  * result / error
  * timestamps
* DB reflects **what happened**, not *who should run next*

### Worker

* Independent process
* Subscribes to queue
* Receives exclusive job ownership from queue
* Updates MongoDB with execution results

### API

* Stateless
* Produces jobs into the queue
* Never executes jobs directly

---

## 4️⃣ Ownership Model (Critical Change)

| Layer    | Responsibility                |
| -------- | ----------------------------- |
| Queue    | Decides **who executes**      |
| Worker   | Executes job exactly once     |
| Database | Records lifecycle and outcome |

**The database no longer decides execution order.**

---

## 5️⃣ Job Lifecycle (Stage 2a)

API Request
↓
MongoDB Job Created (CREATED)
↓
Job Enqueued (Redis)
↓
Worker Claims Job (Queue Lock)
↓
RUNNING
↓ success ↓ failure
FINISHED FAILED
↓ retry limit
DEAD-LETTER


---

## 6️⃣ API Endpoints

* `POST /jobs` – Create job in DB and enqueue in Redis  
* `GET /jobs/:id` – Retrieve job status and result  
* `GET /jobs` – List jobs with filters  

(Enqueue endpoint happens automatically.)

---

## 7️⃣ Failure & Recovery Model

### Worker Crash

* Queue lock expires
* Job is retried automatically

### API Crash

* Job already enqueued remains safe

### Duplicate Execution

* Prevented by queue locks

### Retry Policy

* Limited retries
* Exponential backoff

### Dead Letter Queue (DLQ)

* Jobs exceeding retry limits are parked
* Requires manual inspection

---

## 8️⃣ Observability (Basic)

* Queue metrics:

  * waiting
  * active
  * failed
  * completed

* Worker logs include:

  * workerId
  * jobId

---

## 🔟 Stage 2a Postmortem

### ✅ Works

* Safe parallel execution by multiple workers
* No duplicate jobs
* Automatic recovery
* Prepares system for horizontal scaling

### ⚠️ Limitations

* Redis is a single dependency
* No API scaling yet
* No advanced monitoring
* Single API process (no real horizontal scaling)

### 🧠 Assumptions

* Redis availability assumed
* Jobs are idempotent
* Moderate traffic

### 🔧 Next Stage Triggers (→ Stage 3)

* Introduce multiple API processes / servers
* Add shared session store
* Full horizontal scaling

---

## 🎯 Mental Model Shift

**Stage 2**: "My code decides when jobs run"  

**Stage 2a**: "The system (queue) decides who runs jobs"  

---

## 🚦 Non-Goals (Explicit)

* Kubernetes
* Auto-scaling
* Advanced rate limiting
* Multi-region support

These belong to later stages.