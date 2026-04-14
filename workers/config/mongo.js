import mongoose from "mongoose";

import logger from "./logger.js";
import { setMongoConnectionState } from "../services/prom.js";
import RetryService from "../services/retry-service.js";

const WORKER_TYPE = "main-worker";

// Retry service for MongoDB connection
const mongoRetryService = new RetryService({
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'MongoNetworkError']
});

// Connect with retry logic
const connectWithRetry = async () => {
  try {
    await mongoRetryService.execute(async () => {
      await mongoose.connect(process.env.MONGO_URI);
    }, {
      operationName: 'mongodb-connection'
    });
    
    logger.info("MongoDB connected");
    setMongoConnectionState(WORKER_TYPE, true);
  } catch (error) {
    logger.error("MongoDB connection failed after retries", { error: error?.message, name: error?.name, stack: error?.stack });
    setMongoConnectionState(WORKER_TYPE, false);
    process.exit(1); // Exit if MongoDB is permanently unavailable
  }
};

connectWithRetry();

mongoose.connection.on("disconnected", () => {
  setMongoConnectionState(WORKER_TYPE, false);
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  setMongoConnectionState(WORKER_TYPE, true);
  logger.info("MongoDB reconnected");
});
