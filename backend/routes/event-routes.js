import express from "express";
import eventController from "../controllers/event-controller.js";

const router = express.Router();

// Get all events
router.get("/events", eventController.getAllEvents.bind(eventController));

// Send event
router.post("/events/send", eventController.sendEvent.bind(eventController));

// Event stream (SSE)
router.get("/events/stream", eventController.getEventStream.bind(eventController));

export default router;
