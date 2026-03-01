# Stage 4b: Observability and Monitoring Implementation

## 📌 Overview

This document provides the complete implementation guide for Stage 4b - Observability and Monitoring, transforming the job processing system into a fully observable production-ready platform.

---

## 🎯 Objectives

- Ensure full system visibility for metrics, logs, and traces
- Enable proactive monitoring and alerting
- Provide comprehensive debugging capabilities
- Establish performance baselines and SLI/SLO tracking
- Support rapid incident response and root cause analysis

---

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Service   │    │   Worker Nodes  │    │   Database      │
│                 │    │                 │    │   (MongoDB)     │
│ • OpenTelemetry │    │ • OpenTelemetry │    │                 │
│ • CloudWatch    │    │ • CloudWatch    │    │ • MongoDB       │
│ • Custom Metrics│    │ • Custom Metrics│    │   Exporter      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │   Observability Stack     │
                    │                           │
                    │ • CloudWatch              │
                    │ • Prometheus              │
                    │ • Grafana                 │
                    │ • AWS X-Ray               │
                    │ • OpenTelemetry Collector │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │   Alerting & Notification │
                    │                           │
                    │ • CloudWatch Alarms       │
                    │ • Alertmanager           │
                    │ • PagerDuty              │
                    │ • Slack Integration      │
                    └───────────────────────────┘
```

---

## 📊 1. Metrics Collection Setup

### 1.1 CloudWatch Integration

#### ECS Task Configuration
```yaml
# task-definition.json
{
  "family": "job-processor-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "api-container",
      "image": "your-account.dkr.ecr.region.amazonaws.com/job-processor-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/job-processor-api",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "environment": [
        {
          "name": "AWS_REGION",
          "value": "us-west-2"
        }
      ],
      "readonlyRootFilesystem": false,
      "pseudoTerminal": false
    }
  ]
}
```

#### CloudWatch Agent Configuration
```json
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "cwagent"
  },
  "metrics": {
    "namespace": "JobProcessor",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          "cpu_usage_idle",
          "cpu_usage_iowait",
          "cpu_usage_user",
          "cpu_usage_system"
        ],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": [
          "used_percent"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "diskio": {
        "measurement": [
          "io_time"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "mem": {
        "measurement": [
          "mem_used_percent"
        ],
        "metrics_collection_interval": 60
      }
    }
  }
}
```

### 1.2 Custom Application Metrics

#### API Service Metrics Implementation
```javascript
// metrics.js
const prometheus = require('prom-client');

// Create a Registry to register the metrics
const register = new prometheus.Registry();

// Add a default label which can be used to identify metrics
register.setDefaultLabels({
  app: 'job-processor-api'
});

// Enable the collection of default metrics
prometheus.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

const queueDepth = new prometheus.Gauge({
  name: 'queue_depth',
  help: 'Number of jobs in queue',
  labelNames: ['queue_name']
});

const jobProcessingTime = new prometheus.Histogram({
  name: 'job_processing_duration_seconds',
  help: 'Time taken to process jobs',
  labelNames: ['job_type', 'worker_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

const databaseConnections = new prometheus.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

// Register the custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);
register.registerMetric(queueDepth);
register.registerMetric(jobProcessingTime);
register.registerMetric(databaseConnections);

module.exports = {
  register,
  httpRequestDuration,
  httpRequestTotal,
  activeConnections,
  queueDepth,
  jobProcessingTime,
  databaseConnections
};
```

#### Express Middleware Integration
```javascript
// app.js
const express = require('express');
const { 
  httpRequestDuration, 
  httpRequestTotal,
  register 
} = require('./metrics');

const app = express();

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
      
    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});
```

### 1.3 Prometheus Exporters Setup

#### Docker Compose for Monitoring Stack
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'

  mongodb-exporter:
    image: percona/mongodb_exporter:latest
    ports:
      - "9216:9216"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017
    depends_on:
      - mongodb

  redis-exporter:
    image: oliver006/redis_exporter:latest
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis://redis:6379
    depends_on:
      - redis

volumes:
  prometheus_data:
  grafana_data:
```

#### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'job-processor-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'job-processor-workers'
    static_configs:
      - targets: ['worker1:3001', 'worker2:3001', 'worker3:3001']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'mongodb-exporter'
    static_configs:
      - targets: ['mongodb-exporter:9216']

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']
```

---

## 🔍 2. Distributed Tracing Implementation

### 2.1 OpenTelemetry Setup

#### API Service Configuration
```javascript
// tracing.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'job-processor-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'job-processor-api',
});

sdk.start();

module.exports = sdk;
```

#### Worker Service Configuration
```javascript
// worker-tracing.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { trace } = require('@opentelemetry/api');

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'job-processor-worker',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Manual tracing for job processing
const tracer = trace.getTracer('job-processor-worker');

async function processJobWithTracing(job) {
  const span = tracer.startSpan(`process-job-${job.type}`, {
    attributes: {
      'job.id': job.id,
      'job.type': job.type,
      'job.priority': job.priority
    }
  });

  try {
    span.addEvent('job-processing-started');
    
    // Extract trace context from SQS message if available
    if (job.traceContext) {
      const context = trace.setSpan(context, span);
      // Process job with trace context
    }
    
    const result = await processJob(job);
    
    span.addEvent('job-processing-completed');
    span.setAttributes({
      'job.result': result.status,
      'job.duration': Date.now() - job.startTime
    });
    
    return result;
  } catch (error) {
    span.recordException(error);
    span.setAttributes({
      'job.error': error.message,
      'job.error_type': error.constructor.name
    });
    throw error;
  } finally {
    span.end();
  }
}

module.exports = { sdk, processJobWithTracing, tracer };
```

### 2.2 AWS X-Ray Integration

#### X-Ray Configuration for ECS
```json
{
  "version": "1.0",
  "tracing": {
    "mode": "active",
    "default_sampling_rate": 0.1
  },
  "local_daemon": {
    "address": "localhost:2000"
  },
  "logging": {
    "level": "info",
    "log_group_name": "/aws/xray/job-processor"
  }
}
```

#### X-Ray Middleware
```javascript
// xray.js
const AWSXRay = require('aws-xray-sdk-core');
const captureHttp = require('aws-xray-sdk-capture-http');

// Capture outgoing HTTP requests
captureHttp.captureHTTPsGlobal(require('http'));
captureHttp.captureHTTPsGlobal(require('https'));

// Capture AWS SDK
AWSXRay.captureAWS(require('aws-sdk'));

// Express middleware
function xRayMiddleware(req, res, next) {
  const segment = AWSXRay.getSegment();
  if (segment) {
    const subsegment = segment.addNewSubsegment(req.path);
    subsegment.addAnnotation('http.method', req.method);
    subsegment.addAnnotation('http.url', req.url);
    
    req.segment = subsegment;
    
    res.on('finish', () => {
      subsegment.addAnnotation('http.status_code', res.statusCode);
      subsegment.close();
    });
  }
  
  next();
}

module.exports = { xRayMiddleware, AWSXRay };
```

### 2.3 Trace Correlation

#### SQS Message with Trace Context
```javascript
// sqs-tracing.js
const { trace, context } = require('@opentelemetry/api');

function injectTraceContext(message) {
  const span = trace.getActiveSpan();
  if (span) {
    const carrier = {};
    trace.inject(context.active(), carrier);
    
    return {
      ...message,
      traceContext: carrier,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId
    };
  }
  return message;
}

function extractTraceContext(message) {
  if (message.traceContext) {
    const extractedContext = trace.extract(message.traceContext);
    return context.setSpan(context.active(), extractedContext);
  }
  return context.active();
}

module.exports = { injectTraceContext, extractTraceContext };
```

---

## 📝 3. Logging Strategy

### 3.1 Structured Logging Implementation

#### Winston Logger Configuration
```javascript
// logger.js
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: process.env.SERVICE_NAME || 'job-processor',
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      traceId: meta.traceId,
      spanId: meta.spanId,
      userId: meta.userId,
      jobId: meta.jobId,
      requestId: meta.requestId,
      ...meta
    });
  })
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
];

// Add Elasticsearch transport if configured
if (process.env.ELASTICSEARCH_URL) {
  transports.push(
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL
      },
      index: 'job-processor-logs'
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false
});

// Add trace context to logs
function logWithTrace(level, message, meta = {}) {
  const span = trace.getActiveSpan();
  if (span) {
    meta.traceId = span.spanContext().traceId;
    meta.spanId = span.spanContext().spanId;
  }
  
  logger.log(level, message, meta);
}

module.exports = { logger, logWithTrace };
```

#### Express Logging Middleware
```javascript
// logging-middleware.js
const { logger } = require('./logger');
const { v4: uuidv4 } = require('uuid');

function requestLogger(req, res, next) {
  const requestId = uuidv4();
  req.requestId = requestId;
  
  const startTime = Date.now();
  
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id
  });
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id
    });
  });
  
  res.on('error', (error) => {
    logger.error('Request error', {
      requestId,
      method: req.method,
      url: req.url,
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
  });
  
  next();
}

module.exports = { requestLogger };
```

### 3.2 CloudWatch Logs Configuration

#### Log Group Setup Script
```bash
#!/bin/bash
# setup-cloudwatch-logs.sh

# Create log groups
aws logs create-log-group --log-group-name /ecs/job-processor-api
aws logs create-log-group --log-group-name /ecs/job-processor-worker
aws logs create-log-group --log-group-name /aws/xray/job-processor

# Set retention policies
aws logs put-retention-policy --log-group-name /ecs/job-processor-api --retention-in-days 30
aws logs put-retention-policy --log-group-name /ecs/job-processor-worker --retention-in-days 30
aws logs put-retention-policy --log-group-name /aws/xray/job-processor --retention-in-days 30

# Create metric filters
aws logs put-metric-filter \
  --log-group-name /ecs/job-processor-api \
  --filter-name "ErrorCount" \
  --filter-pattern "{$.level = \"ERROR\"}" \
  --metric-transformations metricName=ErrorCount,metricNamespace=JobProcessor,metricValue=1

aws logs put-metric-filter \
  --log-group-name /ecs/job-processor-api \
  --filter-name "JobProcessingTime" \
  --filter-pattern "{$.jobProcessingTime}" \
  --metric-transformations metricName=JobProcessingTime,metricNamespace=JobProcessor,metricValue=$.jobProcessingTime
```

---

## 📊 4. Dashboard Creation

### 4.1 Grafana Dashboard Configuration

#### System Overview Dashboard
```json
{
  "dashboard": {
    "id": null,
    "title": "Job Processor System Overview",
    "tags": ["job-processor", "system"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "yAxes": [
          {
            "label": "Requests/sec"
          }
        ]
      },
      {
        "id": 2,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ],
        "yAxes": [
          {
            "label": "Seconds"
          }
        ]
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "yAxes": [
          {
            "label": "Percentage",
            "max": 1,
            "min": 0
          }
        ]
      },
      {
        "id": 4,
        "title": "Queue Depth",
        "type": "graph",
        "targets": [
          {
            "expr": "queue_depth",
            "legendFormat": "{{queue_name}}"
          }
        ],
        "yAxes": [
          {
            "label": "Jobs"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

#### Worker Performance Dashboard
```json
{
  "dashboard": {
    "id": null,
    "title": "Worker Performance",
    "tags": ["job-processor", "workers"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Job Processing Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(job_processing_duration_seconds_count[5m])",
            "legendFormat": "{{job_type}} - {{worker_type}}"
          }
        ],
        "yAxes": [
          {
            "label": "Jobs/sec"
          }
        ]
      },
      {
        "id": 2,
        "title": "Job Processing Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(job_processing_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile - {{job_type}}"
          }
        ],
        "yAxes": [
          {
            "label": "Seconds"
          }
        ]
      },
      {
        "id": 3,
        "title": "Active Workers",
        "type": "stat",
        "targets": [
          {
            "expr": "count(up{job=\"job-processor-workers\"})",
            "legendFormat": "Active Workers"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

### 4.2 CloudWatch Dashboard Setup

#### CloudFormation Template for Dashboards
```yaml
# cloudwatch-dashboards.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'CloudWatch Dashboards for Job Processor'

Resources:
  JobProcessorDashboard:
    Type: AWS::CloudWatch::Dashboard
    Properties:
      DashboardName: JobProcessor-System
      DashboardBody: |
        {
          "widgets": [
            {
              "type": "metric",
              "x": 0,
              "y": 0,
              "width": 12,
              "height": 6,
              "properties": {
                "metrics": [
                  ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "app/job-processor-alb"],
                  [".", "TargetResponseTime", ".", "."],
                  [".", "HTTPCode_Target_5XX_Count", ".", "."]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "us-west-2",
                "title": "ALB Metrics",
                "period": 300
              }
            },
            {
              "type": "metric",
              "x": 12,
              "y": 0,
              "width": 12,
              "height": 6,
              "properties": {
                "metrics": [
                  ["AWS/ECS", "CPUUtilization", "ServiceName", "job-processor-api"],
                  [".", "MemoryUtilization", ".", "."],
                  ["AWS/ECS", "CPUUtilization", "ServiceName", "job-processor-worker"],
                  [".", "MemoryUtilization", ".", "."]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "us-west-2",
                "title": "ECS Service Metrics",
                "period": 300
              }
            },
            {
              "type": "metric",
              "x": 0,
              "y": 6,
              "width": 12,
              "height": 6,
              "properties": {
                "metrics": [
                  ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "job-processor-queue"],
                  [".", "ApproximateNumberOfMessagesNotVisible", ".", "."],
                  [".", "NumberOfMessagesDeleted", ".", "."]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "us-west-2",
                "title": "SQS Queue Metrics",
                "period": 300
              }
            }
          ]
        }
```

---

## 🚨 5. Alerting Configuration

### 5.1 Prometheus Alert Rules

#### Alert Rules Configuration
```yaml
# alert_rules.yml
groups:
  - name: job-processor-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      - alert: QueueDepthHigh
        expr: queue_depth > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Queue depth is high"
          description: "Queue {{ $labels.queue_name }} has {{ $value }} messages"

      - alert: WorkerDown
        expr: up{job="job-processor-workers"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Worker is down"
          description: "Worker {{ $labels.instance }} has been down for more than 1 minute"

      - alert: DatabaseConnectionsHigh
        expr: database_connections_active > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "Database has {{ $value }} active connections"

      - alert: JobProcessingSlow
        expr: histogram_quantile(0.95, rate(job_processing_duration_seconds_bucket[5m])) > 30
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow job processing"
          description: "95th percentile job processing time is {{ $value }}s"
```

### 5.2 Alertmanager Configuration

#### Alertmanager Setup
```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@jobprocessor.com'
  smtp_auth_username: 'alerts@jobprocessor.com'
  smtp_auth_password: 'your-password'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://localhost:5001/'

  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@jobprocessor.com'
        subject: '[CRITICAL] Job Processor Alert'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts-critical'
        title: 'Critical Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  - name: 'warning-alerts'
    email_configs:
      - to: 'team@jobprocessor.com'
        subject: '[WARNING] Job Processor Alert'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts-warning'
        title: 'Warning Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
```

### 5.3 CloudWatch Alarms

#### CloudFormation for CloudWatch Alarms
```yaml
# cloudwatch-alarms.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'CloudWatch Alarms for Job Processor'

Resources:
  HighErrorRateAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: JobProcessor-HighErrorRate
      AlarmDescription: "High error rate detected"
      MetricName: ErrorCount
      Namespace: JobProcessor
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 2
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref SNSTopicArn

  HighResponseTimeAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: JobProcessor-HighResponseTime
      AlarmDescription: "High response time detected"
      MetricName: JobProcessingTime
      Namespace: JobProcessor
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 5
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref SNSTopicArn

  QueueDepthAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: JobProcessor-QueueDepthHigh
      AlarmDescription: "Queue depth is high"
      MetricName: ApproximateNumberOfMessagesVisible
      Namespace: AWS/SQS
      Dimensions:
        - Name: QueueName
          Value: job-processor-queue
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 1000
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref SNSTopicArn

  SNSTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: JobProcessor-Alerts
      Subscription:
        - Protocol: email
          Endpoint: team@jobprocessor.com
        - Protocol: https
          Endpoint: https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

---

## 📈 6. Performance Monitoring

### 6.1 SLI/SLO Implementation

#### Service Level Indicators
```javascript
// sli-monitoring.js
class SLIMonitor {
  constructor() {
    this.requestCounts = new Map();
    this.errorCounts = new Map();
    this.responseTimes = new Map();
  }

  recordRequest(endpoint, responseTime, isError = false) {
    const now = Date.now();
    const minute = Math.floor(now / 60000) * 60000; // Round to minute
    
    // Initialize if not exists
    if (!this.requestCounts.has(endpoint)) {
      this.requestCounts.set(endpoint, new Map());
      this.errorCounts.set(endpoint, new Map());
      this.responseTimes.set(endpoint, new Map());
    }
    
    // Record metrics
    this.requestCounts.get(endpoint).set(minute, (this.requestCounts.get(endpoint).get(minute) || 0) + 1);
    
    if (isError) {
      this.errorCounts.get(endpoint).set(minute, (this.errorCounts.get(endpoint).get(minute) || 0) + 1);
    }
    
    const times = this.responseTimes.get(endpoint).get(minute) || [];
    times.push(responseTime);
    this.responseTimes.get(endpoint).set(minute, times);
  }

  getAvailability(endpoint, windowMinutes = 30) {
    const now = Date.now();
    const windowStart = now - (windowMinutes * 60000);
    
    let totalRequests = 0;
    let totalErrors = 0;
    
    const requestCounts = this.requestCounts.get(endpoint) || new Map();
    const errorCounts = this.errorCounts.get(endpoint) || new Map();
    
    for (const [timestamp, count] of requestCounts) {
      if (timestamp >= windowStart) {
        totalRequests += count;
        totalErrors += errorCounts.get(timestamp) || 0;
      }
    }
    
    return totalRequests > 0 ? (totalRequests - totalErrors) / totalRequests : 1;
  }

  getLatency(endpoint, percentile = 95, windowMinutes = 30) {
    const now = Date.now();
    const windowStart = now - (windowMinutes * 60000);
    
    const allTimes = [];
    const responseTimes = this.responseTimes.get(endpoint) || new Map();
    
    for (const [timestamp, times] of responseTimes) {
      if (timestamp >= windowStart) {
        allTimes.push(...times);
      }
    }
    
    if (allTimes.length === 0) return 0;
    
    allTimes.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * allTimes.length) - 1;
    return allTimes[index];
  }

  getThroughput(endpoint, windowMinutes = 30) {
    const now = Date.now();
    const windowStart = now - (windowMinutes * 60000);
    
    let totalRequests = 0;
    const requestCounts = this.requestCounts.get(endpoint) || new Map();
    
    for (const [timestamp, count] of requestCounts) {
      if (timestamp >= windowStart) {
        totalRequests += count;
      }
    }
    
    return totalRequests / windowMinutes; // requests per minute
  }
}

module.exports = SLIMonitor;
```

#### SLO Monitoring Dashboard
```javascript
// slo-dashboard.js
const SLIMonitor = require('./sli-monitor');

class SLODashboard {
  constructor() {
    this.sliMonitor = new SLIMonitor();
    this.slos = {
      availability: {
        target: 0.999, // 99.9%
        window: 30, // 30 days
        alertThreshold: 0.995
      },
      latency: {
        target: 0.2, // 200ms
        percentile: 95,
        window: 30, // 30 days
        alertThreshold: 0.5
      },
      throughput: {
        target: 1000, // requests per minute
        window: 30, // 30 days
        alertThreshold: 500
      }
    };
  }

  checkSLOs() {
    const results = {};
    
    for (const endpoint of ['/api/jobs', '/api/workers', '/health']) {
      const availability = this.sliMonitor.getAvailability(endpoint);
      const latency = this.sliMonitor.getLatency(endpoint, 95);
      const throughput = this.sliMonitor.getThroughput(endpoint);
      
      results[endpoint] = {
        availability: {
          current: availability,
          target: this.slos.availability.target,
          status: availability >= this.slos.availability.target ? 'PASS' : 'FAIL'
        },
        latency: {
          current: latency,
          target: this.slos.latency.target,
          status: latency <= this.slos.latency.target ? 'PASS' : 'FAIL'
        },
        throughput: {
          current: throughput,
          target: this.slos.throughput.target,
          status: throughput >= this.slos.throughput.target ? 'PASS' : 'FAIL'
        }
      };
    }
    
    return results;
  }

  generateReport() {
    const results = this.checkSLOs();
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalEndpoints: Object.keys(results).length,
        passingEndpoints: Object.values(results).filter(r => 
          r.availability.status === 'PASS' && 
          r.latency.status === 'PASS' && 
          r.throughput.status === 'PASS'
        ).length
      },
      details: results
    };
    
    return report;
  }
}

module.exports = SLODashboard;
```

### 6.2 Performance Baselines

#### Load Testing Configuration
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must be below 500ms
    http_req_failed: ['rate<0.1'], // Error rate must be below 10%
    errors: ['rate<0.1'], // Custom error rate below 10%
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  // Test API endpoints
  let responses = [
    http.get(`${BASE_URL}/api/jobs`),
    http.post(`${BASE_URL}/api/jobs`, JSON.stringify({
      type: 'email',
      data: { to: 'test@example.com', subject: 'Test' }
    }), {
      headers: { 'Content-Type': 'application/json' }
    }),
    http.get(`${BASE_URL}/health`)
  ];

  responses.forEach((response, index) => {
    let success = check(response, {
      [`endpoint_${index}_status_is_200`]: (r) => r.status === 200,
      [`endpoint_${index}_response_time_ok`]: (r) => r.timings.duration < 500,
    });

    errorRate.add(!success);
  });

  sleep(1);
}
```

---

## ✅ Validation Criteria

### 7.1 Implementation Checklist

#### Metrics Collection
- [ ] CloudWatch agents installed on all ECS tasks
- [ ] Prometheus exporters configured for all services
- [ ] Custom metrics implemented for business logic
- [ ] Metric collection intervals optimized
- [ ] Metric retention policies configured

#### Distributed Tracing
- [ ] OpenTelemetry SDK integrated in all services
- [ ] Trace context propagation through SQS messages
- [ ] X-Ray integration configured for AWS services
- [ ] Sampling strategies optimized for production
- [ ] Trace aggregation and analysis working

#### Logging Strategy
- [ ] Structured logging implemented across all services
- [ ] Log aggregation to CloudWatch Logs configured
- [ ] Log retention and archival policies set
- [ ] Error logging with stack traces and context
- [ ] Log parsing and indexing for searchability

#### Dashboard Creation
- [ ] Grafana dashboards created for all key metrics
- [ ] CloudWatch dashboards configured for AWS services
- [ ] Real-time monitoring capabilities verified
- [ ] Historical data analysis working
- [ ] Dashboard sharing and access control configured

#### Alerting Configuration
- [ ] Critical alerts configured and tested
- [ ] Warning alerts configured and tested
- [ ] Alert channels (email, Slack, PagerDuty) working
- [ ] Alert escalation policies defined
- [ ] Alert fatigue prevention measures in place

#### Performance Monitoring
- [ ] SLI/SLO definitions created and tracked
- [ ] Performance baselines established
- [ ] Load testing scenarios implemented
- [ ] Capacity planning based on metrics
- [ ] Performance regression detection working

### 7.2 Testing Procedures

#### Functional Testing
```bash
#!/bin/bash
# test-observability.sh

echo "Testing metrics collection..."
curl -f http://localhost:3000/metrics || exit 1

echo "Testing distributed tracing..."
curl -f -X POST http://localhost:3000/api/test-trace || exit 1

echo "Testing logging..."
curl -f http://localhost:3000/api/test-logging || exit 1

echo "Testing alerting..."
# Trigger alert conditions
for i in {1..100}; do
  curl -f http://localhost:3000/api/error-test || true
done

echo "All observability tests passed!"
```

#### Load Testing
```bash
#!/bin/bash
# run-load-test.sh

echo "Running load test..."
k6 run load-test.js --out json=results.json

echo "Analyzing results..."
node analyze-results.js results.json

echo "Load test completed!"
```

---

## 🛠️ Tools and Technologies

### 8.1 Monitoring Stack
- **Metrics**: CloudWatch, Prometheus, Grafana
- **Tracing**: AWS X-Ray, OpenTelemetry, Jaeger
- **Logging**: CloudWatch Logs, Fluentd/Fluent Bit, Elasticsearch
- **Alerting**: CloudWatch Alarms, Alertmanager, PagerDuty
- **Visualization**: Grafana, CloudWatch Dashboards

### 8.2 Implementation Tools
- **Infrastructure**: AWS ECS, Fargate, CloudFormation
- **Load Testing**: k6, Artillery, JMeter
- **Configuration**: Terraform, AWS CLI
- **CI/CD**: GitHub Actions, AWS CodePipeline

### 8.3 Cost Considerations
- CloudWatch metrics: $0.30 per metric per month
- CloudWatch logs: $0.50 per GB ingested
- X-Ray tracing: $5.00 per million traces
- Custom monitoring: Variable based on infrastructure

---

## 📚 Next Steps

### 9.1 Implementation Timeline
1. **Week 1**: Metrics collection setup
2. **Week 2**: Distributed tracing implementation
3. **Week 3**: Logging strategy and aggregation
4. **Week 4**: Dashboard creation and alerting
5. **Week 5**: Performance monitoring and SLO setup
6. **Week 6**: Testing, validation, and optimization

### 9.2 Success Metrics
- 100% service coverage with metrics and tracing
- < 5 minute MTTR (Mean Time To Resolution)
- 99.9% availability SLO achieved
- < 200ms p95 response time SLO achieved
- Proactive alerting preventing incidents

### 9.3 Maintenance
- Regular dashboard reviews and updates
- Alert threshold tuning based on usage patterns
- Performance baseline updates
- Cost optimization reviews
- Team training on observability tools

---

## 📞 Support and Documentation

### 10.1 Runbooks
- Incident response procedures
- Alert troubleshooting guides
- Performance investigation steps
- Dashboard interpretation guides

### 10.2 Training Materials
- Observability tool tutorials
- Dashboard usage guides
- Alert response procedures
- Performance optimization techniques

This comprehensive implementation guide provides everything needed to establish production-grade observability for the job processing system. Each section includes practical code examples, configuration files, and step-by-step instructions for successful implementation.
