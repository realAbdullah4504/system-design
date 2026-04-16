require("dotenv").config({ path: __dirname + "/.env" });
const express = require("express");
const mongoose = require("mongoose");
const jobQueue = require("./queue/jobQueue");
const Job = require("./models/Job");
const TokenService = require("./services/tokenService");

const app = express();
app.use(express.json());

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("MONGO_URI is not defined in environment variables");
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Generate token for job creation
app.post("/tokens", async (req, res) => {
  try {
    const { expiresIn } = req.body;
    const tokenData = await TokenService.generateToken(expiresIn);

    res.status(200).json({
      token: tokenData.token,
      expiresIn: tokenData.expiresIn,
    });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

app.post("/jobs", async (req, res) => {
  const { name, token } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Job name is required" });
  }

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  // Validate and consume token
  const tokenValidation = await TokenService.consumeToken(token);
  if (!tokenValidation.valid) {
    return res.status(400).json({
      error: "Invalid token",
      reason: tokenValidation.reason,
    });
  }

  try {
    await jobQueue.add("process-job", {
      jobId: name,
    });

    res.status(202).json({ jobId: name });
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

app.listen(3000, () => {
  console.log("API running on port 3000");
});
