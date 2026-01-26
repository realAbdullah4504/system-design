const axios = require('axios');

const API_URL = 'http://localhost:3000/jobs';

async function createAndRunJob(name) {
  try {
    // Create Job
    const { data: job } = await axios.post(API_URL, { name });
    console.log(`Created job: ${job.id} | status: ${job.status}`);

    // Run Job
    const { data: runResponse } = await axios.post(`${API_URL}/${job.id}/run`);
    console.log(`Started job: ${job.id} | status: ${runResponse.job.status}`);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}

async function runMultipleJobs() {
  const jobs = [];
  for (let i = 1; i <= 5; i++) {
    jobs.push(createAndRunJob(`Job-${i}`));
  }

  // Wait for all jobs to start in parallel
  await Promise.all(jobs);
  console.log("All jobs have been created and started in parallel.");
}

runMultipleJobs();
