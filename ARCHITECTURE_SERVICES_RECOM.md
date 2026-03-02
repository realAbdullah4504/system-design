# Stage 4 – Production Architecture (Managed Services Reference)

## Quick Start

**New to this guide?** Start with Stage 1-3 documents in sequence:
1. `DESIGN_STAGE_1.md` - Basic system design
2. `DESIGN_STAGE_2.md` - Service architecture
3. `DESIGN_STAGE_3.md` - Self-hosted infrastructure

**Ready for production?** This document assumes you have:
- Working Stage 3 system with Docker Compose
- Understanding of Redis, Kafka, and observability tools
- Basic cloud provider knowledge (AWS/GCP/Azure)

**Immediate next steps:**
1. Review your current Stage 3 setup
2. Identify services to migrate to managed versions
3. Estimate costs and team capacity
4. Plan migration strategy (section 7)

## Purpose

This document explains how to transition from self-hosted infrastructure (Stage 3 learning environment) to production-grade managed services.

Goal:
- Reduce operational overhead
- Improve reliability
- Increase fault tolerance
- Focus engineering time on product features

---

# 1. Messaging & Queue Layer

## Learning (Stage 3)

- BullMQ
- Redis (Docker)
- Kafka (Docker)

Used to understand:
- Job processing
- Retry strategies
- Backoff handling
- Event-driven architecture
- Partitioning and consumer groups

---

## Production Options

### Option A – Managed Redis + BullMQ
- Use managed Redis (e.g., ElastiCache)
- Keep BullMQ workers
- Suitable for small to medium scale

### Option B – SQS
- Fully managed queue
- Built-in durability
- Dead-letter queue support
- No Redis dependency

### Option C – SNS + SQS
- Pub/Sub fanout pattern
- Multiple services consuming events
- High-scale event-driven architecture

### Option D – Managed Kafka (MSK / Confluent Cloud)
- For high throughput event streaming
- Partitioned logs
- Replay capability
- Suitable for analytics + microservices

---

# 2. Redis Layer

## Learning Setup
- Single Redis container
- No replication
- No failover

## Production Requirements

- Multi-AZ replication
- Automatic failover
- Snapshot backups
- Monitoring
- Memory eviction policies

Recommended:
- Managed Redis (ElastiCache or equivalent)

Do NOT run single-node Redis in production.

---

# 3. Kafka Layer

## Learning Setup
- Single broker
- Docker-based
- No replication

## Production Requirements

- Multiple brokers
- Replication factor >= 3
- Partition planning
- Storage monitoring
- Backup & retention policies

Recommended:
- Managed Kafka (MSK or Confluent)

Self-host only if:
- Dedicated SRE team
- Very large scale
- Need deep control

---

# 4. Observability Stack

## Learning Setup

- Prometheus
- Grafana
- Loki
- Docker-based

Used to understand:
- Metrics
- Histograms
- Event loop lag
- Request latency
- Log aggregation

---

## Production Options

### Option A – Grafana Cloud
- Managed Prometheus
- Managed Loki
- Managed Alerting
- Long-term retention

### Option B – Cloud Provider Monitoring
- CloudWatch (AWS)
- Stackdriver (GCP)
- Azure Monitor

### Option C – SaaS Observability
- Datadog
- New Relic

---

# 5. Container Orchestration

## Learning Setup
- Docker Compose
- Manual scaling

## Production Setup

- ECS / Fargate
- Kubernetes (EKS)
- Auto-scaling policies
- Rolling deployments
- Blue/Green deployments
- Health checks

---

# 6. Production Architecture Example

Instead of:

- Redis (Docker)
- Kafka (Docker)
- Prometheus (Docker)
- Grafana (Docker)

Use:

- Managed Redis
- Managed Kafka or SQS
- Managed Observability
- Container orchestration (ECS/EKS)

---

# 7. Decision Framework (Senior-Level Thinking)

When deciding self-hosted vs managed, evaluate:

1. Team size
2. Operational complexity
3. On-call burden
4. Compliance requirements
5. Cost comparison
6. Scaling expectations

---

# 8. Stage Mapping

Stage 3:
- Learn internals
- Self-host everything
- Break things intentionally
- Understand failure modes

Stage 4:
- Replace components with managed services
- Add monitoring and alerting
- Implement CI/CD
- Ensure fault tolerance

Stage 5:
- Cost optimization
- Multi-region design
- Disaster recovery planning
- SLA/SLO definition
- Architectural trade-off analysis

---

# 9. Key Production Principles

- Prefer managed services unless strong reason not to
- Never run single-node critical services
- Observability is mandatory
- Plan for failure
- Automate everything
- Monitor cost continuously

---

# Final Note

Learning requires self-hosting.

Production requires reliability.

Senior engineers know when to switch.