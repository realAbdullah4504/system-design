import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import pkg from '@opentelemetry/resources';
const { Resource } = pkg;
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

// Get all instrumentations except MongoDB
const instrumentations = getNodeAutoInstrumentations({
  // Disable MongoDB instrumentation to avoid Mongoose conflicts
  '@opentelemetry/instrumentation-mongodb': {
    enabled: false
  }
});

// Create SDK factory function to allow different service names
export const createTracingSDK = (serviceName) => {
  return new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: "http://localhost:4318/v1/traces", // Collector endpoint
    }),
    instrumentations,
  });
};

// Default for main worker
const sdk = createTracingSDK("worker-service");

export const startTracing = async () => {
  await sdk.start();
  console.log("OpenTelemetry started");
};
