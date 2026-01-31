import { Router } from "express";
import { createJobController, getJobController } from "../controllers/jobController.js";

const router = Router();

router.post("/jobs", createJobController);
router.get("/jobs/:id", getJobController);

export default router;
