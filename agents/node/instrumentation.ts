import { AsyncLocalStorage } from 'async_hooks';
import * as http from 'http';
import * as os from 'os';
import { Hook } from 'require-in-the-middle';
import { encode } from '@msgpack/msgpack';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'node-agent';

function generateId(): bigint {
    return BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
}

export class Span {
    public traceId: bigint;
    public spanId: bigint;
    public parentId: bigint;
    public name: string;
    public resource: string;
    public service: string;
    public start: bigint;
    public hrStart: bigint;
    public duration: bigint = 0n;
    public error: number = 0;
    public meta: Record<string, string> = { host: os.hostname() };
    public metrics: Record<string, number> = {};

    constructor(name: string, traceId: bigint, spanId: bigint, parentId: bigint) {
        this.name = name;
        this.resource = name;
        this.service = SERVICE_NAME;
        this.traceId = traceId;
        this.spanId = spanId;
        this.parentId = parentId;
        
        const nowMs = Date.now();
        this.hrStart = process.hrtime.bigint();
        this.start = BigInt(nowMs) * 1000000n;
    }

    setAttribute(key: string, value: string | number | boolean) {
        if (typeof value === 'number') {
            this.metrics[key] = value;
            this.meta[key] = String(value);
        } else {
            this.meta[key] = String(value);
        }
    }

    recordException(err: Error) {
        this.error = 1;
        this.setAttribute('error.message', err.message);
        if (err.stack) this.setAttribute('error.stack', err.stack);
    }

    end() {
        this.duration = process.hrtime.bigint() - this.hrStart;
        exportSpan(this);
    }
}

export const traceStorage = new AsyncLocalStorage<Span>();

export const tracer = {
    startActiveSpan(name: string, fn: (span: Span) => any) {
        const parent = traceStorage.getStore();
        const traceId = parent ? parent.traceId : generateId();
        const parentId = parent ? parent.spanId : 0n;
        const spanId = generateId();
        
        const span = new Span(name, traceId, spanId, parentId);
        
        return traceStorage.run(span, () => {
            return fn(span);
        });
    }
};

let buffer: any[] = [];
let flushTimer: NodeJS.Timeout | null = null;

function exportSpan(span: Span) {
    buffer.push({
        trace_id: span.traceId,
        span_id: span.spanId,
        parent_id: span.parentId,
        name: span.name,
        resource: span.resource,
        service: span.service,
        type: 'web',
        start: span.start,
        duration: span.duration,
        error: span.error,
        meta: span.meta,
        metrics: span.metrics
    });

    if (!flushTimer) {
        flushTimer = setTimeout(flush, 1000);
    }
}

function flush() {
    flushTimer = null;
    if (buffer.length === 0) return;

    const payload = [buffer];
    buffer = [];

    try {
        const encoded = encode(payload, { ignoreUndefined: true });
        
        const req = http.request({
            hostname: '127.0.0.1',
            port: 8126,
            path: '/v0.4/traces',
            method: 'POST',
            headers: {
                'Content-Type': 'application/msgpack',
                'Content-Length': encoded.length
            }
        });

        req.on('error', (err) => {});
        req.write(encoded);
        req.end();
    } catch(e) {}
}

const originalFetch = global.fetch;
if (typeof originalFetch === 'function') {
    global.fetch = async function (url: string | URL | Request, options?: RequestInit) {
        options = options || {};
        const targetUrl = typeof url === 'string' ? url : (url as any).url || url.toString();
        
        return tracer.startActiveSpan(`fetch ${options.method || 'GET'}`, async (span) => {
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

// Ensure the process flushes on exit
process.on('SIGTERM', flush);
process.on('SIGINT', flush);

console.log(`  [EasyMonitor] Native Node/Bun Agent successfully attached to ${SERVICE_NAME}!`);
