import { startTracing } from "./config/otel.js";

await startTracing();

import express from "express";
import { publishJobEvent } from "./services/sns.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import cors from "cors";
import { subscribeToEvents, listenToEvents } from "./services/redis.js";
import mongoose from "mongoose";
import { redis, subscriber, publisher } from "./config/redis.js";
import { snsClient } from "./config/sns.js";
import { httpRequestDuration, httpRequestTotal, activeConnections, getMetrics } from "./services/prom.js";
import logger from "./config/logger.js";
import { context, trace, SpanStatusCode } from "@opentelemetry/api";

const app = express();
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  if (req.path === '/metrics') return next();

  const span = trace.getSpan(context.active());
  const traceId = span?.spanContext().traceId;

  logger.info('HTTP request', {
    method: req.method,
    url: req.url,
    trace_id: traceId,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  next();
});

// Prometheus metrics middleware
app.use((req, res, next) => {
  if (req.path === '/metrics') return next();
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
  });
  
  next();
});

// Track active connections
app.use((req, res, next) => {
  activeConnections.inc();
  res.on('finish', () => {
    activeConnections.dec();
  });
  next();
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    logger.debug('Generating Prometheus metrics');
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.end(metrics);
    logger.debug('Prometheus metrics generated successfully');
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message, stack: error.stack });
    res.status(500).end('Error generating metrics');
  }
});

// Endpoint to fetch all events
app.get("/events", async (req, res) => {
  try {
    logger.info('Fetching all events');
    const events = await Event.find().sort({ createdAt: -1 });
    logger.info('Events fetched successfully', { count: events.length });
    res.json(events);
  } catch (err) {
    logger.error('Error fetching events', { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Error fetching events" });
  }
});

app.post("/events/send", async (req, res) => {
  const tracer = trace.getTracer("system-design-service");
  
  // Start span with proper context
  const span = tracer.startSpan("publish-event", {
    attributes: {
      "http.method": "POST",
      "http.route": "/events/send",
      "service.name": "system-design-service"
    }
  });

  // Set the span in context for downstream operations
  const ctx = trace.setSpan(context.active(), span);

  const { type, payload } = req.body;

  logger.info('Received event request', { type, payload });

  if (!type || !payload) {
    logger.warn('Missing required fields', { type, payload });
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.setAttributes({ "error.type": "validation_error" });
    span.end();
    return res.status(400).json({ error: "type and payload are required" });
  }

  try {
    // Execute within the span context
    await context.with(ctx, async () => {
      logger.info('Publishing to SNS', { topicArn: process.env.TOPIC_ARN, type });
      await publishJobEvent({ type, payload });
      logger.info('Successfully published to SNS', { type });
    });

    span.setAttribute("event.type", type);
    span.setAttribute("event.success", true);
    span.setStatus({ code: SpanStatusCode.OK });

    res.json({
      message: "Event sent successfully",
      type: type,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Failed to publish to SNS', { error: err.message, stack: err.stack, type });
    
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.setAttributes({ 
      "event.success": false,
      "error.message": err.message 
    });

    res.status(500).json({ error: "Failed to send event" });
  } finally {
    span.end();
  }
});

// Async "I/O-bound" simulation (does NOT block event loop)
app.get("/async-wait", async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  res.json({
    ok: true,
    type: "Async I/O-bound",
  });
});

app.get("/health", async (req, res) => {
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
});

const clients = new Map();

subscribeToEvents();
listenToEvents(clients);

app.get("/events/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  const clientId = Date.now();
  const client = { id: clientId, res };
  clients.set(clientId, client);
  logger.info('SSE client connected', { clientId });


  // Initial handshake
  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      instance: process.env.HOSTNAME,
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  // Heartbeat (important for ALB/ECS)
  const heartbeat = setInterval(() => {
    res.write(":\n\n"); // keep connection alive
  }, 25000);

  req.on("close", () => {
    logger.info('SSE client disconnected', { clientId });
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
});


// SSE endpoint for real-time event updates
// app.get("/events/stream", async (req, res) => {
//   res.writeHead(200, {
//     "Content-Type": "text/event-stream",
//     "Cache-Control": "no-cache",
//     Connection: "keep-alive",
//     "Access-Control-Allow-Origin": "*",
//     "Access-Control-Allow-Headers": "Cache-Control",
//   });

//   console.log(`[SSE] Client connected to event stream`);

//   let lastEventTime = new Date();

//   // Send initial connection message
//   res.write(
//     `data: ${JSON.stringify({
//       type: "connected",
//       timestamp: new Date().toISOString(),
//     })}\n\n`
//   );

//   const pollDatabase = async () => {
//     try {
//       const events = await Event.find({
//         receivedAt: { $gt: lastEventTime }
//       }).sort({ receivedAt: -1 });

//       if (events.length > 0) {
//         lastEventTime = new Date(events[0].receivedAt);

//         events.forEach(event => {
//           res.write(`data: ${JSON.stringify(event)}\n\n`);
//         });

//         console.log(`[SSE] Sent ${events.length} new events to client`);
//       }
//     } catch (err) {
//       console.error("[SSE] Error polling database:", err);
//       res.write(`data: ${JSON.stringify({ type: "error", message: "Database polling error" })}\n\n`);
//     }
//   };

//   // Poll every 2 seconds
//   const pollInterval = setInterval(pollDatabase, 2000);

//   // Handle client disconnect
//   req.on("close", () => {
//     console.log(`[SSE] Client disconnected from event stream`);
//     clearInterval(pollInterval);

//   });

//   req.on("aborted", () => {
//     console.log(`[SSE] Client connection aborted`);
//     clearInterval(pollInterval);

//   });
// });

app.listen(3000, () => {
  logger.info('API server started', { port: 3000, environment: process.env.NODE_ENV || 'development' });
});
