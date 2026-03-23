import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { Resource } from '@opentelemetry/resources';

// Set up resource
const resource = new Resource({ 'service.name': 'payment-service' });

// Set up log provider separately (avoids NodeSDK type conflicts)
const logExporter = new OTLPLogExporter({ url: 'http://localhost:4317' });
const logProvider = new LoggerProvider({ resource });
logProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
logs.setGlobalLoggerProvider(logProvider);

// Set up traces via NodeSDK
const sdk = new NodeSDK({
  serviceName: 'payment-service',
  traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4317' }),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();

// Export logger for use in index.ts
export const otelLogger = logs.getLogger('payment-service');
