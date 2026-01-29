const kafka = require("../kafka");

const producer = kafka.producer();

async function startRetryProducer() {
  await producer.connect();
}

async function publishRetryJob(job, delaySeconds) {
  const topic = delaySeconds === 5 ? "jobs.retry.5s" : "jobs.retry.30s";
  
  await producer.send({
    topic: topic,
    messages: [
      {
        key: job._id.toString(),
        value: JSON.stringify({
          jobId: job._id,
          payload: job.payload,
          retryCount: job.retryCount || 1,
        }),
      },
    ],
  });
}

module.exports = { startRetryProducer, publishRetryJob };
