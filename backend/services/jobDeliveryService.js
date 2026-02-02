import JobDelivery from "../models/JobDeliverySchema.js";
export const createJobDelivery = async (jobDeliveryData) => {
  return await JobDelivery.create(jobDeliveryData);
};

export const updateJobDelivery = async (jobDeliveryId, updateData) => {
  return await JobDelivery.findByIdAndUpdate(jobDeliveryId, updateData);
};

export const findJobDeliveryById = async (jobDeliveryId) => {
  return await JobDelivery.findById(jobDeliveryId);
};

export const findJobDeliveryByJobId = async (jobId) => {
  return await JobDelivery.find({ jobId });
};

export const findJobDeliveryByJobIdAndChannel = async (jobId, channel) => {
  return await JobDelivery.findOne({ jobId, channel });
};
