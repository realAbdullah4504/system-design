import express from "express";
import { getMetrics } from "./services/prom.js";
import logger from "./config/logger.js";

const app = express();
const PORT = process.env.WORKER_METRICS_PORT || 4000;

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    logger.debug('Generating worker Prometheus metrics');
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.end(metrics);
    logger.debug('Worker Prometheus metrics generated successfully');
  } catch (error) {
    logger.error('Error generating worker metrics', { error: error.message, stack: error.stack });
    res.status(500).end('Error generating metrics');
  }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'worker-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  logger.info('Worker metrics server started', { port: PORT });
});

export default app;
