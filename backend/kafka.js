const { Kafka } = require("kafkajs");

const brokers = process.env.KAFKA_BROKERS
  ? process.env.KAFKA_BROKERS.split(",").map((b) => b.trim()).filter(Boolean)
  : ["localhost:9092"];

const clientId = process.env.KAFKA_CLIENT_ID || "jobs-service";

const kafka = new Kafka({
  clientId,
  brokers,
});

module.exports = { kafka };
