import express from "express";
import { connectDB } from "./config/database.js";
import jobRoutes from "./routes/jobRoutes.js";
import { pollQueue } from "./workers/queueWorker.js";
import { pollDLQ } from "./workers/dlqWorker.js";
import { pollNotification } from "./workers/notificationWorker.js";

const app = express();
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use("/", jobRoutes);

app.listen(3000, () => {
  console.log("API running on port 3000");
  console.log("Starting workers...");
  pollQueue();
  pollDLQ();
  pollNotification();
});
