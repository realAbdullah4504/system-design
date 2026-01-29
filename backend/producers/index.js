const { startMainJobProducer, publishMainJob } = require("./mainJobProducer");
const { startRetryProducer, publishRetryJob } = require("./retryProducer");
const { startDLQProducer, publishToDLQ } = require("./dlqProducer");

async function startAllProducers() {
  await Promise.all([
    startMainJobProducer(),
    startRetryProducer(),
    startDLQProducer(),
  ]);
}

module.exports = {
  startMainJobProducer,
  publishMainJob,
  startRetryProducer,
  publishRetryJob,
  startDLQProducer,
  publishToDLQ,
  startAllProducers,
};
