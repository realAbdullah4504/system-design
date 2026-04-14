import express from "express";
import eventController from "../controllers/event-controller.js";
import sessionMiddleware from "../middleware/session-middleware.js";

const router = express.Router();

// Get all events
router.get("/events",sessionMiddleware, eventController.getAllEvents.bind(eventController));

// Send event
router.post("/events/send", sessionMiddleware, eventController.sendEvent.bind(eventController));

// Event stream (SSE)
router.get("/events/stream", sessionMiddleware, eventController.getEventStream.bind(eventController));

export default router;
