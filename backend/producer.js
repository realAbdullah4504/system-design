const kafka = require("./kafka");

const producer = kafka.producer();

async function startProducer() {
  await producer.connect();
}

async function publishJob(job) {
  await producer.send({
    topic: "jobs",
    messages: [
      {
        key: job._id.toString(),
        value: JSON.stringify({
          jobId: job._id,
          payload: job.payload,
        }),
      },
    ],
  });
}

module.exports = { startProducer, publishJob };
