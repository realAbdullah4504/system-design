import { createJob, getJobById } from "../services/jobService.js";
import { publishJobEvent } from "../services/snsService.js";
import { createJobDelivery } from "../services/jobDeliveryService.js";

export const createJobController = async (req, res) => {
  try {
    const job = await createJob({ name: req.body.name });
    const message = {
      jobId: job._id.toString(),
      name: job.name,
      task: job.name,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    const channels = ["notification", "email"];

    for (const channel of channels) {
      await createJobDelivery({
        jobId: job._id,
        channel,
        status: "PENDING",
        attemptCount: 0
      });
    }

    await publishJobEvent(message);

    console.log(`[Producer] Sent job ${job._id} to SNS`);

    // const resultMessage = await sendMessage(message);  
    // const resultNotification = await sendNotification(message);
    // console.log(`[Producer] Sent job ${job._id} to SQS, MessageId: ${resultMessage.MessageId}`);
    // console.log(`[Producer] Sent job ${job._id} to SQS, MessageId: ${resultNotification.MessageId}`);

    res.json({ jobId: job._id });
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ error: "Failed to create job" });
  }
};

export const getJobController = async (req, res) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).json({ error: "Failed to fetch job" });
  }
};
