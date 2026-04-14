import mongoose from "mongoose";
import { redis, subscriber, publisher } from "../config/redis.js";
import { snsClient } from "../config/sns.js";
import logger from "../config/logger.js";

class HealthController {
  async getHealth(req, res) {
    const healthStatus = {
      status: "ok",
      service: "system-design-service",
      instanceId: process.env.HOSTNAME || "unknown",
      timestamp: new Date().toISOString(),
      services: {}
    };

    try {
      logger.debug('Starting health check');
      
      // Check MongoDB connection
      if (mongoose.connection.readyState === 1) {
        healthStatus.services.mongodb = { status: "connected", readyState: mongoose.connection.readyState };
      } else {
        healthStatus.services.mongodb = { status: "disconnected", readyState: mongoose.connection.readyState };
        healthStatus.status = "degraded";
      }

      // Check Redis connections
      const redisStatus = {};
      
      try {
        await redis.ping();
        redisStatus.main = { status: "connected" };
      } catch (err) {
        redisStatus.main = { status: "disconnected", error: err.message };
        healthStatus.status = "degraded";
      }

      try {
        await subscriber.ping();
        redisStatus.subscriber = { status: "connected" };
      } catch (err) {
        redisStatus.subscriber = { status: "disconnected", error: err.message };
        healthStatus.status = "degraded";
      }

      try {
        await publisher.ping();
        redisStatus.publisher = { status: "connected" };
      } catch (err) {
        redisStatus.publisher = { status: "disconnected", error: err.message };
        healthStatus.status = "degraded";
      }

      healthStatus.services.redis = redisStatus;

      // Check SNS (AWS SDK doesn't have a direct ping, so we'll check if client is initialized)
      if (snsClient && process.env.TOPIC_ARN) {
        healthStatus.services.sns = { 
          status: "configured",
          region: process.env.AWS_REGION,
          topicArn: process.env.TOPIC_ARN ? "***" + process.env.TOPIC_ARN.split(":").pop() : "not configured"
        };
      } else {
        healthStatus.services.sns = { status: "not configured" };
        healthStatus.status = "degraded";
      }

      logger.info('Health check completed', { status: healthStatus.status, services: healthStatus.services });
      const statusCode = healthStatus.status === "ok" ? 200 : 503;
      res.status(statusCode).json(healthStatus);

    } catch (error) {
      logger.error('Health check error', { error: error.message, stack: error.stack });
      res.status(503).json({
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async getMetrics(req, res) {
    try {
      const { getMetrics } = await import("../services/prom.js");
      logger.debug('Generating Prometheus metrics');
      const metrics = await getMetrics();
      res.set('Content-Type', 'text/plain');
      res.end(metrics);
      logger.debug('Prometheus metrics generated successfully');
    } catch (error) {
      logger.error('Error generating metrics', { error: error.message, stack: error.stack });
      res.status(500).end('Error generating metrics');
    }
  }

  async getAsyncWait(req, res) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    res.json({
      ok: true,
      type: "Async I/O-bound",
    });
  }
}

export default new HealthController();
