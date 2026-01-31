import Job from "../models/Job.js";

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
