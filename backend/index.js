const express = require("express");
const mongoose = require("mongoose");
const jobQueue = require("./queue/jobQueue");
const Job = require("./models/Job");

const app = express();
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/jobs");

app.post("/jobs", async (req, res) => {
  const { name } = req.body;
  const job = await Job.create({
    name,
    status: "CREATED",
  });

  await jobQueue.add("process-job", {
    jobId: job._id.toString(),
  });

  res.status(202).json({ jobId: job._id });
});

app.listen(3000, () => {
  console.log("API running on port 3000");
});
