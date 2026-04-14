import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Centralized configuration object
export const config = {
  // AWS Configuration
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sqs: {
      queueUrl: process.env.SQS_QUEUE_URL,
    },
    sns: {
      topicArn: process.env.TOPIC_ARN,
    },
  },

  // MongoDB Configuration
  mongo: {
    uri: process.env.MONGO_URI,
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  // Loki Configuration
  loki: {
    enabled: process.env.LOKI_ENABLED === "true",
    host: process.env.LOKI_HOST || "localhost",
    port: parseInt(process.env.LOKI_PORT) || 3100,
  },

  // OpenTelemetry Configuration
  otel: {
    serviceName: process.env.OTEL_SERVICE_NAME,
    serviceVersion: process.env.OTEL_SERVICE_VERSION,
    exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    resourceAttributes: process.env.OTEL_RESOURCE_ATTRIBUTES,
  },
};

// Validation helper
export const validateConfig = () => {
  const required = [
    'mongo.uri',
    'redis.host',
    'redis.port'
  ];

  const missing = required.filter(path => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], config);
    return !value;
  });

  if (missing.length > 0) {
    console.error('Missing required configuration:', missing);
    process.exit(1);
  }
};
