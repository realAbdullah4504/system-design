import express from "express";
import { publishJobEvent } from "./services/sns.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import cors from "cors";
import { subscribeToEvents, listenToEvents } from "./services/redis.js";

const app = express();
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  console.log(`[${process.env.HOSTNAME}] ${req.method} ${req.url}`);
  next();
});

// Endpoint to fetch all events
app.get("/events", async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Error fetching events" });
  }
});

app.post("/events/send", async (req, res) => {
  const { type, payload } = req.body;

  console.log(
    `[BACKEND] Received event request - Type: ${type}, Payload:`,
    payload
  );

  if (!type || !payload) {
    console.log(
      `[BACKEND] ERROR - Missing required fields. Type: ${type}, Payload: ${payload}`
    );
    return res.status(400).json({ error: "type and payload are required" });
  }

  try {
    console.log(`[BACKEND] Publishing to SNS topic: ${process.env.TOPIC_ARN}`);
    await publishJobEvent({ type, payload });
    console.log(`[BACKEND] Successfully published to SNS - Type: ${type}`);

    res.json({
      message: "Event sent successfully",
      type: type,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[BACKEND] ERROR - Failed to publish to SNS:`, err);
    res.status(500).json({ error: "Failed to send event" });
  }
});

// Async "I/O-bound" simulation (does NOT block event loop)
app.get("/async-wait", async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  res.json({
    ok: true,
    type: "Async I/O-bound",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "notification-service",
    instanceId: process.env.HOSTNAME || "unknown",
    timestamp: new Date().toISOString(),
  });
});

const clients = [];

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

  console.log("[SSE] Client connected");

  const clientId = Date.now();
  const client = { id: clientId, res };
  clients.push(client);

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
    console.log("[SSE] Client disconnected");
    clearInterval(heartbeat);
    const index = clients.findIndex(c => c.id === clientId);
    if (index !== -1) clients.splice(index, 1);
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
  console.log("API running on port 3000");
});
