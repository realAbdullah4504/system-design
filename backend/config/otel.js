import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { config } from "./env.js";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: config.otel.serviceName || "system-design-service",
    [SemanticResourceAttributes.SERVICE_VERSION]: config.otel.serviceVersion,
  }),
  traceExporter: new OTLPTraceExporter({
    url: config.otel.exporterEndpoint || "http://localhost:4318/v1/traces",
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

export const startTracing = async () => {
  await sdk.start();
  console.log("OpenTelemetry started");
};
