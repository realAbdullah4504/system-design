import promClient from "prom-client";

const collectDefaultMetrics = promClient.collectDefaultMetrics;
const register = promClient.register;

// Enable collection of default metrics
collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 3, 5, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// Export metrics
export {
  register,
  httpRequestDuration,
  httpRequestTotal,
  activeConnections
};

// Function to get metrics in Prometheus format
export const getMetrics = async () => {
  return await register.metrics();
};
