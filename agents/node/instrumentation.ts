import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { Hook } from 'require-in-the-middle';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import { context, propagation, trace, SpanKind } from '@opentelemetry/api';

new Hook(['winston'], (winston: any) => {
    const originalCreateLogger = winston.createLogger;
    winston.createLogger = function (options: any) {
        options = options || {};
        options.transports = options.transports || [];
        if (!Array.isArray(options.transports)) {
            options.transports = [options.transports];
        }
        options.transports.push(new OpenTelemetryTransportV3());
        return originalCreateLogger.call(this, options);
    };
    return winston;
});

new Hook(['ioredis'], (Redis: any) => {
    // 1. Auto-inject W3C transparent payload headers during publish
    const originalPublish = Redis.prototype.publish;
    Redis.prototype.publish = function (channel: string, message: string) {
        try {
            const data = JSON.parse(message);
            if (typeof data === 'object' && !data._trace) {
                const carrier = {};
                propagation.inject(context.active(), carrier);
                data._trace = carrier;
                message = JSON.stringify(data);
            }
        } catch (e) {} // Not a JSON message, let baseline OTel auto-instrumentation handle simple spans
        return originalPublish.call(this, channel, message);
    };

    // 2. Auto-extract transparent headers during message consumption and spin up a discrete APM subgraph child
    const originalEmit = Redis.prototype.emit;
    Redis.prototype.emit = function (eventName: string, ...args: any[]) {
        if (eventName === 'message') {
            const channel = args[0];
            const message = args[1];
            try {
                const data = JSON.parse(message);
                if (data && typeof data === 'object' && data._trace) {
                    const parentContext = propagation.extract(context.active(), data._trace);
                    const tracer = trace.getTracer('easy-monitor-ioredis');
                    
                    return context.with(parentContext, () => {
                        return tracer.startActiveSpan(`Redis SUBSCRIBE ${channel}`, { kind: SpanKind.CONSUMER }, (span) => {
                            try {
                                return originalEmit.call(this, eventName, ...args);
                            } finally {
                                span.end();
                            }
                        });
                    });
                }
            } catch (e) {}
        }
        return originalEmit.call(this, eventName, ...args);
    };
    return Redis;
});

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
