import promClient from "prom-client";

const collectDefaultMetrics = promClient.collectDefaultMetrics;
const register = promClient.register;

// Enable collection of default metrics
collectDefaultMetrics({ register });

// Worker-specific metrics
const jobProcessingDuration = new promClient.Histogram({
  name: 'worker_job_processing_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['worker_type', 'job_type', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60]
});

const jobsProcessedTotal = new promClient.Counter({
  name: 'worker_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['worker_type', 'job_type', 'status']
});

const jobsFailedTotal = new promClient.Counter({
  name: 'worker_jobs_failed_total',
  help: 'Total number of jobs failed',
  labelNames: ['worker_type', 'job_type', 'error_type']
});

const queueDepth = new promClient.Gauge({
  name: 'worker_queue_depth',
  help: 'Current queue depth',
  labelNames: ['worker_type', 'queue_url']
});

const memoryUsage = new promClient.Gauge({
  name: 'worker_memory_usage_bytes',
  help: 'Current memory usage in bytes',
  labelNames: ['worker_type', 'memory_type']
});

const workerUptime = new promClient.Gauge({
  name: 'worker_uptime_seconds',
  help: 'Worker uptime in seconds',
  labelNames: ['worker_type']
});

const workerHealth = new promClient.Gauge({
  name: 'worker_health_status',
  help: 'Worker health status (1=healthy, 0=unhealthy)',
  labelNames: ['worker_type']
});

const activeConnections = new promClient.Gauge({
  name: 'worker_active_connections',
  help: 'Number of active connections',
  labelNames: ['worker_type', 'connection_type']
});

const exceptionsTotal = new promClient.Counter({
  name: 'worker_exceptions_total',
  help: 'Total number of unhandled exceptions',
  labelNames: ['worker_type', 'exception_type']
});

const databaseErrorsTotal = new promClient.Counter({
  name: 'worker_database_errors_total',
  help: 'Total number of database errors',
  labelNames: ['worker_type', 'operation', 'error_type']
});

const redisErrorsTotal = new promClient.Counter({
  name: 'worker_redis_errors_total',
  help: 'Total number of Redis errors',
  labelNames: ['worker_type', 'operation', 'error_type']
});

const sqsErrorsTotal = new promClient.Counter({
  name: 'worker_sqs_errors_total',
  help: 'Total number of SQS errors',
  labelNames: ['worker_type', 'operation', 'error_type']
});

// Export metrics
export {
  register,
  jobProcessingDuration,
  jobsProcessedTotal,
  jobsFailedTotal,
  queueDepth,
  memoryUsage,
  workerUptime,
  workerHealth,
  activeConnections,
  exceptionsTotal,
  databaseErrorsTotal,
  redisErrorsTotal,
  sqsErrorsTotal
};

// Function to get metrics in Prometheus format
export const getMetrics = async () => {
  return await register.metrics();
};

// Helper functions for common metric operations
export const recordJobStart = (workerType, jobType) => {
  return jobProcessingDuration.startTimer({ worker_type: workerType, job_type: jobType });
};

export const recordJobSuccess = (timer, workerType, jobType) => {
  timer({ status: 'success' });
  jobsProcessedTotal.labels(workerType, jobType, 'success').inc();
};

export const recordJobFailure = (timer, workerType, jobType, errorType) => {
  timer({ status: 'failure' });
  jobsFailedTotal.labels(workerType, jobType, errorType).inc();
};

export const updateMemoryUsage = (workerType) => {
  const memUsage = process.memoryUsage();
  memoryUsage.labels(workerType, 'rss').set(memUsage.rss);
  memoryUsage.labels(workerType, 'heapUsed').set(memUsage.heapUsed);
  memoryUsage.labels(workerType, 'heapTotal').set(memUsage.heapTotal);
  memoryUsage.labels(workerType, 'external').set(memUsage.external);
};

export const setWorkerHealth = (workerType, isHealthy) => {
  workerHealth.labels(workerType).set(isHealthy ? 1 : 0);
};

export const recordException = (workerType, exceptionType) => {
  exceptionsTotal.labels(workerType, exceptionType).inc();
};

export const recordDatabaseError = (workerType, operation, errorType) => {
  databaseErrorsTotal.labels(workerType, operation, errorType).inc();
};

export const recordRedisError = (workerType, operation, errorType) => {
  redisErrorsTotal.labels(workerType, operation, errorType).inc();
};

export const recordSQSError = (workerType, operation, errorType) => {
  sqsErrorsTotal.labels(workerType, operation, errorType).inc();
};
