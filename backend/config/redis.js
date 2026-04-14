// config/redis.js
import Redis from "ioredis";
import { config } from "./env.js";

// Base config shared across all clients
const baseConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

// Main Redis client for general commands (GET/SET, etc.)
const redis = new Redis(baseConfig);

redis.on("connect", () => console.log("[REDIS] Main client connected"));
redis.on("error", (err) => console.error("[REDIS] Main client error:", err));

// Subscriber client for pub/sub
const subscriber = new Redis(baseConfig);

subscriber.on("connect", () => console.log("[REDIS] Subscriber client connected"));
subscriber.on("error", (err) => console.error("[REDIS] Subscriber client error:", err));

// Publisher client for pub/sub
const publisher = new Redis(baseConfig);

publisher.on("connect", () => console.log("[REDIS] Publisher client connected"));
publisher.on("error", (err) => console.error("[REDIS] Publisher client error:", err));

export { redis, subscriber, publisher };