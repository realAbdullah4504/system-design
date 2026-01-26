const axios = require("axios");

const API_BASE = "http://localhost:3000";
const TOTAL_JOBS = 100;

async function enqueueJobs() {
  for (let i = 1; i <= TOTAL_JOBS; i++) {
    try {
      // 1️⃣ Create job
      const createRes = await axios.post(`${API_BASE}/jobs`, {
        name: `job-${i}`
      });

      const jobId = createRes.data.id;
      console.log(`🆕 Created job ${jobId}`);

      // 2️⃣ Enqueue job
      await axios.post(`${API_BASE}/jobs/${jobId}/enqueue`);
      console.log(`📥 Enqueued job ${jobId}`);
    } catch (err) {
      console.error("❌ Error enqueueing job:", err.message);
    }
  }
}

enqueueJobs();
