const { Queue } = require("bullmq");
const connection = require("./redis");

const jobQueue = new Queue("jobs", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

module.exports = jobQueue;
