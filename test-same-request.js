const axios = require("axios");

const API_URL = "http://localhost:3000/jobs";

// Simulate multiple users hitting the same job
const changeJobStatus = async (jobId, userId) => {
  try {
    console.log(`User ${userId} sending request to run job ${jobId}`);
    const { data: runResponse } = await axios.post(`${API_URL}/${jobId}/run`);
    console.log(
      `User ${userId} received response | Job: ${jobId} | status: ${runResponse.job.status}`
    );
  } catch (err) {
    console.error(
      `User ${userId} error | Job: ${jobId} |`,
      err.response ? err.response.data : err.message
    );
  }
};

const testRaceCondition = async () => {
  const jobId = "78ba0a82-8ae2-4107-9b7d-9c417931ae7b";

  for (let i = 1; i <= 10; i++) {
    // Add a small random delay to simulate real-world race conditions
    setTimeout(() => {
      changeJobStatus(jobId, i);
    }, Math.floor(Math.random() * 100));
  }
};

testRaceCondition();
