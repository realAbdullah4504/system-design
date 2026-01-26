const Job = require("./models/Job");

const WORKER_INTERVAL_MS = 1000;


async function recoverStuckJobs() {
  console.log("🧹 Running startup recovery...");

  const result = await Job.updateMany(
    { status: "RUNNING" },
    {
      status: "QUEUED",
      startedAt: null
    }
  );

  console.log(
    `🔁 Recovered ${result.modifiedCount} stuck RUNNING jobs`
  );
}

async function processJob(job) {
  console.log(`🛠️ Processing job ${job.id}`);

  // simulate slow work
  await new Promise((res) => setTimeout(res, 3000));

  // simulate occasional failure
  if (Math.random() < 0.2) {
    throw new Error("Random job failure");
  }

  return `Job ${job.id} completed successfully`;
}

async function workerLoop() {
  try {
    const job = await Job.findOneAndUpdate(
      { status: "QUEUED" },
      {
        status: "RUNNING",
        startedAt: new Date()
      },
      { new: true }
    );

    if (!job) {
      return;
    }

    try {
      const result = await processJob(job);

      job.status = "FINISHED";
      job.result = result;
      job.finishedAt = new Date();
      await job.save();

      console.log(`✅ Job finished ${job.id}`);
    } catch (err) {
      job.status = "FAILED";
      job.error = err.message;
      job.finishedAt = new Date();
      await job.save();

      console.error(`❌ Job failed ${job.id}`, err.message);
    }
  } catch (err) {
    console.error("Worker loop error:", err);
  }
}

function startWorker() {
  console.log("👷 Worker started");
  setInterval(workerLoop, WORKER_INTERVAL_MS);
}

module.exports = { startWorker,recoverStuckJobs };
