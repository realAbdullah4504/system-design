import mongoose from "mongoose";

import logger from "./logger.js";
import { setMongoConnectionState } from "../services/prom.js";

const WORKER_TYPE = "main-worker";

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  logger.info("MongoDB connected");
  setMongoConnectionState(WORKER_TYPE, true);
})
.catch((err) => {
  logger.error("MongoDB connection error", { error: err?.message, name: err?.name, stack: err?.stack });
  setMongoConnectionState(WORKER_TYPE, false);
});

mongoose.connection.on("disconnected", () => {
  setMongoConnectionState(WORKER_TYPE, false);
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  setMongoConnectionState(WORKER_TYPE, true);
  logger.info("MongoDB reconnected");
});
