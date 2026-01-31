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
