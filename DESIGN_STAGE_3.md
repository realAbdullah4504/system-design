# Job Processing System – Stage 3 (Horizontal Scaling & Real Queue)

## 📌 Stage 3 Summary

Stage 3 introduces **true distributed job processing**.

The database is no longer used as a logical queue. Instead, a **real queue system** is introduced to safely distribute work across **multiple workers and multiple Node.js processes**.

This stage marks the transition from *"background processing"* to *"horizontally scalable execution"*.

Correctness, ownership, and crash safety are now **enforced by infrastructure**, not conventions.

---

## 1️⃣ Problem Statement

Stages 1 and 2 (including 2a) relied on:

* Single-process execution
* Database polling
* Best-effort ownership semantics

These approaches break down when:

* Multiple Node.js processes exist
* Multiple workers compete for jobs
* Duplicate execution becomes harmful

Stage 3 solves this by introducing a **real distributed queue** that provides:

* Deterministic job ownership
* Safe concurrency
* Automatic crash recovery
* Horizontal scalability

---

## 2️⃣ Current Scope

* Multiple Node.js processes (API + workers)
* Express API (stateless)
* MongoDB as **system of record** for job metadata and results
* Redis-backed real queue (execution source of truth)
* Multiple workers consuming from the same queue
* No frontend (API-only)

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

## 5️⃣ Job Lifecycle (Stage 3)

```
API Request
   ↓
MongoDB Job Created (CREATED)
   ↓
Job Enqueued (Redis)
   ↓
Worker Claims Job (Queue Lock)
   ↓
RUNNING
   ↓ success            ↓ failure
FINISHED            FAILED
                      ↓ retry limit
                   DEAD-LETTER
```

---

## 6️⃣ API Endpoints

* `POST /jobs`

  * Create job in DB
  * Enqueue job in Redis

* `GET /jobs/:id`

  * Retrieve job status and result

* `GET /jobs`

  * List jobs with filters

(No enqueue endpoint needed — enqueue happens automatically.)

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

## 8️⃣ Horizontal Scaling Model

### API Scaling

* Multiple stateless API instances
* Load balanced

### Worker Scaling

* Multiple worker processes
* All consuming from same queue

### Queue Scaling

* Redis as central coordination layer

---

## 9️⃣ Observability (Basic)

* Queue metrics:

  * waiting
  * active
  * failed
  * completed
* Worker logs include:

  * workerId
  * jobId

---

## 🔟 Stage 3 Postmortem

### ✅ Works

* Safe parallel execution
* No duplicate jobs
* Automatic recovery
* Horizontal scalability

### ⚠️ Limitations

* Redis is a single dependency
* No advanced monitoring yet
* No SLA enforcement

### 🧠 Assumptions

* Redis availability assumed
* Jobs are idempotent
* Moderate traffic

### 🔧 Next Stage Triggers (→ Stage 4)

* Need visibility into latency and failures
* Need alerting
* Need performance tuning
* Need system-wide observability

---

## 🎯 Mental Model Shift

**Stage 2**: "My code decides when jobs run"

**Stage 3**: "The system decides who runs jobs"

---

## 🚦 Non-Goals (Explicit)

* Kubernetes
* Auto-scaling
* Advanced rate limiting
* Multi-region support

These belong to later stages.
