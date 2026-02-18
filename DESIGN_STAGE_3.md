# Job Processing System – Stage 3: Horizontal Scaling

## 📌 Stage 3 Summary

Stage 3 introduces **horizontal scaling** to your system. The focus is **incremental complexity**, gradually scaling services, workers, queues, and multi-service orchestration.
This stage builds on Stage 2c’s fanout and queue experimentation, emphasizing **AWS ECS/Fargate, EC2, ALB, SQS, SNS/Kafka, MongoDB replica sets, and monitoring** to create a production-grade horizontally scalable system.

---

## 1️⃣ Problem Statement

The system must handle **higher workloads with multiple workers and services**, maintaining reliability, fault tolerance, and observability.
Stage 3 aims to incrementally test and scale:

* Single services horizontally
* Database replication and load handling
* Queues with multiple workers
* Multi-service orchestration and fanout
* Observability and failure recovery

The goal is **progressive complexity**, ensuring each component scales safely before moving to the next.

---

## 2️⃣ Current Scope

* Single notification service already works with SNS/SQS and fanout (Stage 2c)
* Jobs stored in MongoDB
* Retry mechanism and DLQ implemented
* Single Node.js API process for job submission
* Logging in place for testing
* Observability limited; horizontal scaling not yet applied

---

## 3️⃣ Stage 3 Substages

### **3 – Single Service Horizontal Scaling**

**Objective:** Scale one service horizontally without queues or multiple producers.

**Actions:**

* Deploy multiple instances of a service (notification service) using ECS/Fargate or EC2 Auto Scaling
* Add **ALB** for load balancing
* Test response times and latency under load
* Observe CPU, memory, and request throughput metrics

**Outputs:**

* Horizontally scaled service with balanced traffic
* Baseline metrics for service scaling
* Failover testing at service instance level

---

### **3b – Database Scaling**

**Objective:** Ensure the horizontally scaled service handles database load.

**Actions:**

* Implement **MongoDB replica set** (primary + secondaries)
* Test read/write separation for performance
* Monitor replication lag, CPU, memory, and connections
* Validate failover scenarios

**Outputs:**

* Database can handle horizontal service scaling
* Observability of DB performance under load
* Graceful reconnection handling in the service

---

### **3c – Single Queue + Single Worker , Horizontal Worker Scaling**

**Objective:** Introduce background processing to scaled services and Scale multiple workers horizontally to process the same queue.

**Actions:**

* Integrate **SQS/BullMQ** queue for job processing
* Deploy **single worker instance** consuming from the queue
* Test job processing and retry logic under load
* Monitor queue backlog and processing metrics
* Deploy multiple worker instances as ECS tasks or EC2 instances
* Test concurrent processing of jobs
* Ensure **idempotency** to prevent duplicate work
* Observe metrics: queue depth, throughput, retry patterns

**Outputs:**

* Single worker processes jobs reliably
* Queue metrics available
* Baseline for worker scaling
* Horizontally scaled workers reducing backlog
* Observability of queue consumption performance
* Idempotency ensures safe multi-worker processing

### **3d – Full Cluster Orchestration**

**Objective:** Multi-service, multi-queue system with fanout, monitoring, and failure recovery.

**Actions:**

* Deploy multiple services with independent queues
* Add **SNS/SQS fanout or Kafka** for broadcasting events
* Integrate **monitoring & logging** (CloudWatch, Prometheus/Grafana)
* Simulate failures: worker crash, queue unavailability, DB failover
* Validate retries, DLQ handling, and observability

**Outputs:**

* Fully horizontally scaled, multi-service system
* Fault-tolerant job processing across services
* Dashboards for metrics, queue depth, retries, and DLQs
* Production-grade readiness for Stage 4

---

## 4️⃣ Core Concepts

| Concept                 | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| **Service Scaling**     | Multiple instances of a service to handle higher load                 |
| **ALB**                 | Application Load Balancer distributes traffic evenly across instances |
| **Worker Scaling**      | Multiple consumers processing jobs concurrently                       |
| **MongoDB Replica Set** | Primary/secondary setup for read scaling and failover                 |
| **Queue**               | Buffer for background job processing (SQS/BullMQ)                     |
| **Fanout / Broadcast**  | SNS/SQS or Kafka distributes messages to multiple consumers           |
| **DLQ**                 | Dead-Letter Queue for permanently failed jobs                         |
| **Retry**               | Exponential backoff or configurable retry policies                    |
| **Idempotency**         | Ensures safe processing when multiple workers handle the same job     |
| **Observability**       | Monitoring CPU, memory, queue depth, retries, job lifecycle           |
| **Failure Recovery**    | Worker crash, queue downtime, or DB failover handled gracefully       |

---

## 5️⃣ Implementation Notes

* Horizontal scaling applied incrementally: service → database → queue → workers → cluster
* ECS/Fargate or EC2 Auto Scaling used for multiple instances
* ALB ensures traffic distribution
* MongoDB replica set for fault-tolerant database access
* Single queue → multiple workers gradually scaled
* Fanout queues / Kafka for multi-service orchestration
* Logging and metrics are added at each stage for observability
* Retry and DLQ mechanisms integrated into worker processing
* Focus on progressive complexity; each step validated before moving forward

---

## 6️⃣ Stage 3 Postmortem

### ✅ Works

* Services scale horizontally with ALB traffic distribution
* MongoDB replica set handles load with failover
* Workers process jobs concurrently with safe idempotency
* Fanout works for multi-service consumption
* Retry and DLQ mechanisms operational
* Metrics available for scaling validation

### ⚠️ Limitations

* Complexity increases AWS costs
* Observability dashboards may require tuning
* Advanced routing or FIFO queues not yet implemented
* Circuit breaker and distributed tracing not yet applied

### 🧠 Assumptions

* AWS credentials & permissions properly configured
* ECS/EC2, ALB, MongoDB, SQS/SNS/Kafka are ready
* Jobs are safe to retry and idempotent
* Focus is on incremental testing and learning

### 🔧 Next Stage Triggers

* Stage 4: full production-grade deployment
* Implement shared sessions (Redis) for multi-process consistency
* Add circuit breakers and distributed tracing
* Optimize retry policies and DLQ automation
* Monitor scaling costs and performance metrics

---

## 7️⃣ Metrics / Observations

* Service response times under load
* Worker throughput and queue depth
* MongoDB replication lag
* Retry success rates and DLQ entries
* Multi-service job processing latency
* CPU, memory, and network metrics

---

## 8️⃣ Future Ideas (Stage 4+)

* Multi-region deployment for HA
* Advanced circuit breakers and backpressure handling
* Service mesh integration
* Distributed tracing and observability dashboards
* Cost optimization using auto-scaling policies
* FIFO queues for ordering-sensitive jobs
* Automated DLQ replay and alerting
