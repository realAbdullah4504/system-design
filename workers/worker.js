const SQS = require("@aws-sdk/client-sqs");

const sqs = new SQS({ region: "us-east-1" });

const QUEUE_URL = process.env.SQS_QUEUE_URL || "https://sqs.us-east-1.amazonaws.com/123456789012/cpu-tasks"; 

app.get("/stress-cpu", async (req, res) => {
  // Push job to SQS instead of processing here
  const job = {
    type: "cpu-intensive",
    payload: { iterations: 1e7 }, // example workload
    timestamp: Date.now(),
  };

  try {
    await sqs.sendMessage({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(job),
    }).promise();

    res.json({
      ok: true,
      status: "Job submitted to queue",
      server: os.hostname(),
    });
  } catch (err) {
    console.error("SQS sendMessage error:", err);
    res.status(500).json({ ok: false, error: "Failed to enqueue job" });
  }
});
