import express from "express";
import { publishJobEvent } from "./services/sns.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import cors from "cors";

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

  if (!type || !payload) {
    return res.status(400).json({ error: "type and payload are required" });
  }

  try {
    await publishJobEvent({ type, payload });


    res.json({
      message: "Event sent successfully",
    });
  } catch (err) {
    console.error(err);
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

app.listen(3000, () => {
  console.log("API running on port 3000");
});
