# System Design Project

A comprehensive MERN stack system with ECS Fargate deployment, monitoring, and CI/CD pipeline.
VENDER Locking left for future reference

## 🏗️ Project Structure

```
system-design/
├── infrastructure/
│   ├── aws/
│   │   └── cloudformation/
│   │       ├── ecs-cluster.yaml          # Main ECS cluster with Fargate
│   │       ├── app-build.yaml           # CodeBuild for Docker images
│   │       └── sqs-sns-stack.yaml     # SQS + SNS notification stack
│   └── docker-compose/
│       ├── development.yml          # Local development with databases
│       └── monitoring.yml           # Full monitoring stack
├── monitoring/
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── percentile-rules.yml
│   ├── loki/
│   │   ├── loki-config.yml
│   │   └── promtail-config.yml
│   └── jaeger/
│       └── otel-collector-config.yaml
├── deployment/
│   ├── buildspec.yml                 # CodeBuild specification
│   └── docker-compose.prod.yml        # Production compose file
├── backend/                        # Node.js API service
├── workers/                        # Background workers
├── frontend/                       # React frontend
└── docs/                          # Documentation
```

## 🚀 Quick Start

### Local Development
```bash
# Start development environment
docker-compose -f infrastructure/docker-compose/development.yml up
# Start monitoring stack
docker-compose -f infrastructure/docker-compose/monitoring.yml up
```

## 📊 Monitoring Stack

- **Prometheus**: Metrics collection on port 9090
- **Grafana**: Visualization on port 3001 (admin/admin)
- **Loki**: Log aggregation on port 3100
- **Jaeger**: Distributed tracing on ports 16686/14250/14268

## 🔧 Services

- **Backend API**: Node.js/Express on port 3000
- **Notification Worker**: SQS + SNS integration
- **Main Worker**: Background job processing

## 🛠️ Technologies

- **Backend**: Node.js, Express, MongoDB, Redis
- **Frontend**: React, Vite
- **Infrastructure**: AWS ECS Fargate, CloudFormation
- **Monitoring**: Prometheus, Grafana, Loki, Jaeger
- **CI/CD**: AWS CodeBuild, ECR

## 📝 Environment Variables

Use parameter overrides for configuration:

```bash
--parameter-overrides \
  MongoUri="your-mongodb-uri" \
  SqsQueueUrl="your-sqs-url" \
  TopicArn="your-sns-topic-arn"
```
