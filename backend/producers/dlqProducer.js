const kafka = require("../kafka");

const producer = kafka.producer();

async function startDLQProducer() {
  await producer.connect();
}

async function publishToDLQ(job, error) {
  await producer.send({
    topic: "jobs.DLQ",
    messages: [
      {
        key: job._id.toString(),
        value: JSON.stringify({
          jobId: job._id,
          payload: job.payload,
          error: error.message,
          failedAt: new Date().toISOString(),
          retryCount: job.retryCount || 0,
        }),
      },
    ],
  });
}

module.exports = { startDLQProducer, publishToDLQ };
