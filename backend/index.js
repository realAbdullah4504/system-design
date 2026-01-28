const express = require("express");
const mongoose = require("mongoose");
const Job = require("./models/Job");
const { startProducer, publishJob } = require("./producer");

const app = express();
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/jobs");

startProducer();

app.post("/jobs", async (req, res) => {
  const job = await Job.create({
    name: req.body.name,
  });

  await publishJob(job);

  res.json({ jobId: job._id });
});

app.get("/jobs/:id", async (req, res) => {
  const job = await Job.findById(req.params.id);
  res.json(job);
});

app.listen(3000, () => {
  console.log("API running on port 3000");
});
