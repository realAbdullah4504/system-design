import express from "express";
import healthController from "../controllers/health-controller.js";

const router = express.Router();

// Health check
router.get("/health", healthController.getHealth.bind(healthController));

// Metrics endpoint
router.get("/metrics", healthController.getMetrics.bind(healthController));

// Async wait simulation
router.get("/async-wait", healthController.getAsyncWait.bind(healthController));

export default router;
