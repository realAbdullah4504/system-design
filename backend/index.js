require('dotenv').config({ path: __dirname + '/.env' });
const express = require("express");
const mongoose = require("mongoose");
const jobQueue = require("./queue/jobQueue");
const Job = require("./models/Job");

const app = express();
app.use(express.json());

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error('MONGO_URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

app.post("/jobs", async (req, res) => {
  const { name } = req.body;
  try {
    const job = await Job.create({
      name,
      status: "CREATED",
    });

    await jobQueue.add("process-job", {
      jobId: job._id.toString(),
    });

    res.status(202).json({ jobId: job._id });
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

app.listen(3000, () => {
  console.log("API running on port 3000");
});
