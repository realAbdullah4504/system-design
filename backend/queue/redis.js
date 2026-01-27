const IORedis = require("ioredis");

const connection = new IORedis({
  host: "redis-15959.c240.us-east-1-3.ec2.cloud.redislabs.com",
  port: 15959,
  password: "5l03nP68jJ2VjlaBJ8exPA1eHkR0b3Yp", // replace with your Redis password
  maxRetriesPerRequest: null,
});

module.exports = connection;
