const axios = require("axios");

const API_BASE = "http://localhost:3000";
const TOTAL_JOBS = 1000;
const CONCURRENCY = 50;

async function runWithConcurrency() {
  let index = 0;

  async function worker() {
    while (index < TOTAL_JOBS) {
      const job = index++;
      try {
        await axios.get(`${API_BASE}/stress-cpu`);
        if (job % 50 === 0) {
          console.log(`Processed job ${job}`);
        }
      } catch (e) {
        console.error("Request failed:", e.message);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  console.log("✅ Load test finished");
}

runWithConcurrency();
