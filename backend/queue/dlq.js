const { Queue } = require("bullmq");
const connection = require("./redis");

const dlqQueue = new Queue("jobs-dlq", { connection });

module.exports = dlqQueue;
