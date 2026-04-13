import mongoose from "mongoose";
import { config } from "./env.js";

mongoose.connect(config.mongo.uri)
.then(() => console.log("MongoDB connected"))
.catch((err) => console.error("MongoDB connection error:", err));
