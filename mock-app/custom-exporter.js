const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.resolve(__dirname, '../shared-proto/proto/traces.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const traces_proto = grpc.loadPackageDefinition(packageDefinition).easy_monitor.traces;

const client = new traces_proto.TracesService('127.0.0.1:4317', grpc.credentials.createInsecure());

class CustomTraceExporter {
    export(spans, resultCallback) {
        const payload = spans.map(s => {
            const ctx = s.spanContext();
            let durationMs = Math.floor((s.endTime[0] - s.startTime[0]) * 1000 + (s.endTime[1] - s.startTime[1]) / 1000000);
            if (durationMs < 0) durationMs = 1;

            return {
                trace_id: ctx.traceId,
                span_id: ctx.spanId,
                parent_id: s.parentSpanId || "",
                name: s.name,
                service: s.resource.attributes['service.name'] || 'unknown-service',
                resource: s.attributes['http.target'] || s.attributes['http.route'] || s.name,
                start_time: Math.floor(s.startTime[0] * 1000 + s.startTime[1] / 1000000),
                duration: durationMs,
                error: (s.status.code === 2) ? 1 : 0
            };
        });

        client.SyncTraces({ spans: payload }, (err, response) => {
            if (err) {
                console.error("Custom gRPC Export Error:", err.message);
            }
            resultCallback({ code: err ? 1 : 0 });
        });
    }

    shutdown() {
        return Promise.resolve();
    }
}

module.exports = { CustomTraceExporter };
