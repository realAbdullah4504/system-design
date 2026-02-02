import Job from "../models/Job.js";
import JobDelivery from "../models/JobDeliverySchema.js"

export const createJob = async (jobData) => {
  return await Job.create(jobData);
};

export const getJobById = async (jobId) => {
  return await Job.findById(jobId);
};

export const updateJobStatus = async (jobId, updateData) => {
  return await Job.findByIdAndUpdate(jobId, updateData);
};

export const findJobByMessageId = async (messageId) => {
  return await Job.findOne({ messageId });
};

export const createJobWithMessage = async (jobData, messageId) => {
  try {
    return await Job.create({ ...jobData, messageId });
  } catch (error) {
    // Handle duplicate messageId (idempotency)
    if (error.code === 11000) {
      const existingJob = await Job.findOne({ messageId });
      return existingJob;
    }
    throw error;
  }
};

export async function aggregateJobStatus(jobId) {
  const deliveries = await JobDelivery.find({ jobId });

  if (deliveries.length === 0) return;

  const allFinished = deliveries.every(d => d.status === "FINISHED");
  const allFailed = deliveries.every(d => d.status === "FAILED");
  const anyRunning = deliveries.some(d => d.status === "RUNNING");
  const anyFailed = deliveries.some(d => d.status === "FAILED");

  let status = "PENDING";

  if (allFinished) status = "FINISHED";
  else if (allFailed) status = "FAILED";
  else if (anyRunning) status = "RUNNING";
  else if (anyFailed) status = "PARTIAL";

  const startedAt = deliveries.find(d => d.startedAt)?.startedAt;
  const finishedAt = allFinished || allFailed ? new Date() : null;

  await Job.findByIdAndUpdate(jobId, { status, startedAt, finishedAt });
}
