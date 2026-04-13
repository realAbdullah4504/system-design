import { startTracing } from "./config/otel.js";

await startTracing();

import express from "express";
import cookieParser from "cookie-parser";
import "./config/mongo.js";
import cors from "cors";
import { subscribeToEvents, listenToEvents } from "./services/redis.js";
import { httpRequestDuration, httpRequestTotal, activeConnections } from "./services/prom.js";
import logger from "./config/logger.js";
import sessionRoutes from "./routes/session-routes.js";
import eventRoutes from "./routes/event-routes.js";
import healthRoutes from "./routes/health-routes.js";

const app = express();
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// Initialize app locals for shared data
app.locals.eventClients = new Map();

app.use((req, res, next) => {
  if (req.path === '/metrics') return next();

  logger.info('HTTP request', {
    method: req.method,
    url: req.url,
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

app.use((req, res, next) => {
  if (req.path === '/events/send') {
    const randomDelay = Math.random() * 1000; // 0-1000ms
    setTimeout(() => next(), randomDelay);
  } else {
    next();
  }
});

// Track active connections
app.use((req, res, next) => {
  activeConnections.inc();
  res.on('finish', () => {
    activeConnections.dec();
  });
  next();
});

// API routes
app.use('/api', sessionRoutes);
app.use('/api', eventRoutes);
app.use('/api', healthRoutes);

// Initialize Redis event streaming
subscribeToEvents();
listenToEvents(app);


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
