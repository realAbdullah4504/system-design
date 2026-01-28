const { Kafka } = require("kafkajs");

// Force localhost connection for local development
const kafka = new Kafka({
  clientId: "jobs-service",
  brokers: ["localhost:29092"],
});

module.exports = kafka;
