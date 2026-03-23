import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';

const endpoint = 'http://127.0.0.1:4317';
const resource = new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'unknown_node_service',
});

// 1. Explicitly hook into the global LoggerProvider because NodeSDK can silently fail to register it
const loggerProvider = new LoggerProvider({ resource });
loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(new OTLPLogExporter({ url: endpoint })));
logs.setGlobalLoggerProvider(loggerProvider);

// 2. Initialize the DataDog-like generic auto-instrumentation SDK for Traces and Metrics
const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    metricReader: new (require('@opentelemetry/sdk-metrics').PeriodicExportingMetricReader)({
        exporter: new OTLPMetricExporter({ url: endpoint }),
    }),
    instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  [EasyMonitor] Node/Bun Agent successfully attached!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Graceful shutdown
process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
});
