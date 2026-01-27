const { Queue } = require("bullmq");
const connection = require("./redis");

const jobQueue = new Queue("jobs", {
  connection,
});

module.exports = jobQueue;
