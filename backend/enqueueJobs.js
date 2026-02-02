import axios from "axios";

const API_BASE = "http://localhost:3000";
const TOTAL_JOBS = 10;

async function enqueueJobs() {
  for (let i = 1; i <= TOTAL_JOBS; i++) {
    try {
      // Create and enqueue job in one step
      const createRes = await axios.post(`${API_BASE}/jobs`, {
        name: `job-${i}`
      });

      const jobId = createRes.data.jobId;
      console.log(`🆕 Created and enqueued job ${jobId}`);
    } catch (err) {
      console.error("❌ Error creating job:", err.message);
    }
  }
}

await enqueueJobs();
