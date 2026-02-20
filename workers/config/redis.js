// config/redis.js
import Redis from "ioredis";

// Base config shared across all clients
const baseConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
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