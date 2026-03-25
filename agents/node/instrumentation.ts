import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { BatchLogRecordProcessor, LoggerProvider, LogRecordExporter, ReadableLogRecord } from '@opentelemetry/sdk-logs';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { Hook } from 'require-in-the-middle';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import { context, propagation, trace, SpanKind } from '@opentelemetry/api';
import * as dgram from 'dgram';

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
        } catch (e) { } // Not a JSON message, let baseline OTel auto-instrumentation handle simple spans
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
            } catch (e) { }
        }
        return originalEmit.call(this, eventName, ...args);
    };
    return Redis;
});

const originalFetch = global.fetch;
if (typeof originalFetch === 'function') {
    global.fetch = async function (url: string | URL | Request, options?: RequestInit) {
        options = options || {};
        const headersObj: Record<string, string> = {};

        if (options.headers instanceof Headers) {
            options.headers.forEach((value, key) => { headersObj[key] = value; });
        } else if (Array.isArray(options.headers)) {
            for (const [key, value] of options.headers) headersObj[key] = value;
        } else if (options.headers) {
            Object.assign(headersObj, options.headers);
        }

        propagation.inject(context.active(), headersObj);
        options.headers = headersObj;

        const targetUrl = typeof url === 'string' ? url : (url as any).url || url.toString();
        const tracer = trace.getTracer('easy-monitor-fetch');

        return tracer.startActiveSpan(`fetch ${options.method || 'GET'}`, { kind: SpanKind.CLIENT }, async (span) => {
            span.setAttribute('http.url', targetUrl);
            span.setAttribute('http.method', options!.method || 'GET');
            try {
                const res = await originalFetch(url as any, options);
                span.setAttribute('http.status_code', res.status);
                return res;
            } catch (err: any) {
                span.recordException(err);
                span.setAttribute('error', true);
                throw err;
            } finally {
                span.end();
            }
        });
    };
}

const endpoint = 'http://127.0.0.1:4317';
const resource = new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'unknown_node_service',
});

class GelfLogRecordExporter implements LogRecordExporter {
    private client = dgram.createSocket('udp4');
    private targetHost = '127.0.0.1';
    private targetPort = 12201;

    export(logRecords: ReadableLogRecord[], resultCallback: (result: ExportResult) => void): void {
        for (const log of logRecords) {
            const levelNum = log.severityNumber || SeverityNumber.INFO;
            let gelfLevel = 6; // Info
            if (levelNum >= 21) gelfLevel = 2; // Critical/Fatal
            else if (levelNum >= 17) gelfLevel = 3; // Error
            else if (levelNum >= 13) gelfLevel = 4; // Warn
            else if (levelNum <= 8) gelfLevel = 7; // Debug

            let msg = '';
            if (typeof log.body === 'string') {
                msg = log.body;
            } else if (log.body && typeof log.body === 'object') {
                const b = log.body as any;
                msg = b.message || b.msg || JSON.stringify(b);
            } else {
                msg = String(log.body || '');
            }

            const payload = {
                version: "1.1",
                host: "local",
                short_message: msg,
                timestamp: Date.now() / 1000.0,
                level: gelfLevel,
                _service: log.resource.attributes[ATTR_SERVICE_NAME] || "unknown",
                _trace_id: log.spanContext?.traceId || "",
                _span_id: log.spanContext?.spanId || ""
            };

            const buffer = Buffer.from(JSON.stringify(payload));
            this.client.send(buffer, this.targetPort, this.targetHost);
        }
        resultCallback({ code: ExportResultCode.SUCCESS });
    }

    shutdown(): Promise<void> {
        return new Promise((resolve) => {
            try { this.client.close(); } catch (e) { }
            resolve();
        });
    }
}

// 1. Explicitly hook into the global LoggerProvider because NodeSDK can silently fail to register it
const loggerProvider = new LoggerProvider({ resource });
loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(new GelfLogRecordExporter()));
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

const appLogger = logs.getLogger('easymonitor-node-agent');
appLogger.emit({ severityNumber: SeverityNumber.INFO, severityText: 'INFO', body: '  [EasyMonitor] Node/Bun Agent successfully attached!' });

// Graceful shutdown
process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
});
