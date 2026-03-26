import { AsyncLocalStorage } from 'async_hooks';
import * as http from 'http';
import * as os from 'os';
import * as crypto from 'crypto';
import { Hook } from 'require-in-the-middle';
import { pack as encode } from 'msgpackr';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'node-agent';

const resourceMeta: Record<string, string> = { host: os.hostname() };
const otelAttrs = process.env.OTEL_RESOURCE_ATTRIBUTES || '';
otelAttrs.split(',').forEach(pair => {
    const [key, val] = pair.split('=');
    if (key === 'deployment.environment') resourceMeta.env = val;
    if (key === 'service.version') resourceMeta.version = val;
});

const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

function injectTrace(args: any[]) {
    const span = traceStorage?.getStore();
    if (span && args.length > 0 && typeof args[0] === 'string') {
        args[0] = `[trace_id: ${span.traceId} span_id: ${span.spanId}] ${args[0]}`;
    } else if (span) {
        args.unshift(`[trace_id: ${span.traceId} span_id: ${span.spanId}]`);
    }
    return args;
}

console.log = function(...args: any[]) { originalLog.apply(console, injectTrace(args)); };
console.info = function(...args: any[]) { originalInfo.apply(console, injectTrace(args)); };
console.warn = function(...args: any[]) { originalWarn.apply(console, injectTrace(args)); };
console.error = function(...args: any[]) { originalError.apply(console, injectTrace(args)); };

function generateId(): bigint {
    return crypto.randomBytes(8).readBigUInt64BE(0);
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
    public meta: Record<string, string> = { ...resourceMeta };
    public metrics: Record<string, number> = {};
    public startCpu: NodeJS.CpuUsage;
    public startMem: number;

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
        this.startCpu = process.cpuUsage();
        this.startMem = process.memoryUsage().heapUsed;
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
        this.setAttribute('error.type', err.name || 'Error');
        this.setAttribute('error.message', err.message);
        if (err.stack) {
            const stackStr = err.stack.toString();
            this.setAttribute('error.stack', stackStr.length > 2000 ? stackStr.substring(0, 2000) + '... (truncated)' : stackStr);
        }
    }

    end() {
        this.duration = process.hrtime.bigint() - this.hrStart;
        
        const endCpu = process.cpuUsage(this.startCpu);
        const endMem = process.memoryUsage().heapUsed;
        
        this.metrics['cpu.user'] = endCpu.user;
        this.metrics['cpu.system'] = endCpu.system;
        this.metrics['mem.delta'] = endMem - this.startMem;

        if (this.error === 0 && Math.random() > sampleRate) {
            return; // drop
        }
        exportSpan(this);
    }
}

export const traceStorage = new AsyncLocalStorage<Span>();

const MAX_BUFFER_SIZE = 1000;
const FLUSH_INTERVAL_MS = 1000;
let sampleRate = 1.0;

export const tracer = {
    startActiveSpan(name: string, fn: (span: Span) => any, externalTraceId?: bigint, externalParentId?: bigint) {
        const parent = traceStorage.getStore();
        const traceId = externalTraceId || (parent ? parent.traceId : generateId());
        const parentId = externalParentId || (parent ? parent.spanId : 0n);
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
    if (buffer.length >= MAX_BUFFER_SIZE) {
        return; // drop silently (fail-safe)
    }

    const obj: any = {
        trace_id: span.traceId,
        span_id: span.spanId,
        name: span.name,
        resource: span.resource,
        service: span.service,
        type: 'web',
        start: span.start,
        duration: span.duration,
        error: span.error
    };
    
    if (span.parentId !== 0n) obj.parent_id = span.parentId;
    if (Object.keys(span.meta).length > 0) obj.meta = span.meta;
    if (Object.keys(span.metrics).length > 0) obj.metrics = span.metrics;
    
    buffer.push(obj);

    if (buffer.length >= 100) {
        flush();
    } else if (!flushTimer) {
        flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
    }
}

function flush() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    if (buffer.length === 0) return;

    const payload = [buffer];
    buffer = [];

    try {
        const encoded = encode(payload);
        
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

        req.on('error', (err) => { console.error("[EasyMonitor] Failed to export traces:", err.message); });
        req.write(encoded);
        req.end();
    } catch(e: any) { console.error("[EasyMonitor] Exception in flush:", e.message); }
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

new Hook(['http', 'https'], (exported: any, name: string, basedir?: string) => {
    // 1. Hook Outbound Requests
    const originalRequest = exported.request;
    if (typeof originalRequest === 'function') {
        exported.request = function (...args: any[]) {
            const req = originalRequest.apply(this, args as any);
            return tracer.startActiveSpan(`http.client.request`, span => {
                span.setAttribute('http.method', req.method || 'GET');
                const protocol = name === 'https' ? 'https:' : 'http:';
                span.setAttribute('http.url', `${protocol}//${req.host}${req.path}`);

                // Inject Trace Headers
                req.setHeader('x-easymonitor-trace-id', span.traceId.toString());
                req.setHeader('x-easymonitor-parent-id', span.spanId.toString());

                req.on('response', (res: any) => {
                    span.setAttribute('http.status_code', res.statusCode);
                });
                req.on('error', (err: any) => {
                    span.recordException(err);
                });
                req.on('close', () => {
                    span.end();
                });

                return req;
            });
        };
    }

    const originalGet = exported.get;
    if (typeof originalGet === 'function') {
        exported.get = function (...args: any[]) {
            const req = originalGet.apply(this, args as any);
            return tracer.startActiveSpan(`http.client.request`, span => {
                span.setAttribute('http.method', req.method || 'GET');
                const protocol = name === 'https' ? 'https:' : 'http:';
                span.setAttribute('http.url', `${protocol}//${req.host}${req.path}`);

                req.setHeader('x-easymonitor-trace-id', span.traceId.toString());
                req.setHeader('x-easymonitor-parent-id', span.spanId.toString());

                req.on('response', (res: any) => {
                    span.setAttribute('http.status_code', res.statusCode);
                });
                req.on('error', (err: any) => {
                    span.recordException(err);
                });
                req.on('close', () => {
                    span.end();
                });

                return req;
            });
        };
    }

    // 2. Hook Inbound Server Requests
    if (exported.Server && exported.Server.prototype) {
        const originalEmit = exported.Server.prototype.emit;
        exported.Server.prototype.emit = function (type: string, ...args: any[]) {
            if (type === 'request') {
                const [req, res] = args;
                const traceIdStr = req.headers['x-easymonitor-trace-id'];
                const parentIdStr = req.headers['x-easymonitor-parent-id'];

                let extTraceId, extParentId;
                try {
                    if (traceIdStr) extTraceId = BigInt(traceIdStr as string);
                    if (parentIdStr) extParentId = BigInt(parentIdStr as string);
                } catch(e) {}

                return tracer.startActiveSpan(`http.server.request`, span => {
                    span.setAttribute('http.method', req.method || 'GET');
                    span.setAttribute('http.url', req.url || '/');
                    span.resource = `${req.method || 'GET'} ${req.url || '/'}`;

                    res.on('finish', () => {
                        span.setAttribute('http.status_code', res.statusCode);
                        span.end();
                    });
                    
                    res.on('error', (err: any) => {
                        span.recordException(err);
                    });

                    return originalEmit.apply(this, [type, ...args]);
                }, extTraceId, extParentId);
            }
            return originalEmit.apply(this, [type, ...args]);
        };
    }

    return exported;
});

const obfuscateQuery = (sql: string) => {
    return sql.replace(/(['"]).*?\1|(\b\d+\b)/g, '?');
};

Hook(['pg'], (exported) => {
    const Client = exported.Client || exported.native?.Client;
    if (Client && Client.prototype) {
        const originalQuery = Client.prototype.query;
        Client.prototype.query = function (...args: any[]) {
            const config = args[0];
            let sql = typeof config === 'string' ? config : config?.text || '';
            
            return tracer.startActiveSpan('pg.query', span => {
                span.setAttribute('db.system', 'postgresql');
                span.setAttribute('db.query', obfuscateQuery(sql));
                span.type = 'sql';
                
                const lastArg = args[args.length - 1];
                if (typeof lastArg === 'function') {
                    args[args.length - 1] = function (...cbArgs: any[]) {
                        const err = cbArgs[0];
                        if (err) span.recordException(err);
                        span.end();
                        return lastArg.apply(this, cbArgs);
                    };
                    return originalQuery.apply(this, args);
                } else {
                    const res = originalQuery.apply(this, args);
                    if (res && typeof res.then === 'function') {
                        res.then((r: any) => { span.end(); return r; })
                           .catch((err: any) => { span.recordException(err); span.end(); throw err; });
                    } else {
                        span.end();
                    }
                    return res;
                }
            });
        };
    }
    return exported;
});

Hook(['mysql2'], (exported) => {
    if (exported && exported.Connection && exported.Connection.prototype) {
        ['query', 'execute'].forEach(method => {
            const original = exported.Connection.prototype[method];
            if (original) {
                exported.Connection.prototype[method] = function (...args: any[]) {
                    let sql = typeof args[0] === 'string' ? args[0] : args[0]?.sql || '';
                    return tracer.startActiveSpan('mysql.query', span => {
                        span.setAttribute('db.system', 'mysql');
                        span.setAttribute('db.query', obfuscateQuery(sql));
                        span.type = 'sql';
                        
                        const lastArg = args[args.length - 1];
                        if (typeof lastArg === 'function') {
                            args[args.length - 1] = function (...cbArgs: any[]) {
                                const err = cbArgs[0];
                                if (err) span.recordException(err);
                                span.end();
                                return lastArg.apply(this, cbArgs);
                            };
                            return original.apply(this, args);
                        } else {
                            const res = original.apply(this, args);
                            if (res && typeof res.then === 'function') {
                                res.then((r: any) => { span.end(); return r; })
                                   .catch((err: any) => { span.recordException(err); span.end(); throw err; });
                            } else {
                                span.end();
                            }
                            return res;
                        }
                    });
                };
            }
        });
    }
    return exported;
});

if (typeof global !== 'undefined' && typeof global.fetch === 'function') {
    const originalFetch = global.fetch;
    global.fetch = function(...args: any[]) {
        const urlStr = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        const method = (args[1]?.method || (args[0] as any).method || 'GET').toUpperCase();
        
        return tracer.startActiveSpan('http.client.request', span => {
            span.setAttribute('http.method', method);
            span.setAttribute('http.url', urlStr);
            
            args[1] = args[1] || {};
            args[1].headers = args[1].headers || {};
            if (typeof Headers !== 'undefined' && args[1].headers instanceof Headers) {
                args[1].headers.set('x-easymonitor-trace-id', span.traceId.toString());
                args[1].headers.set('x-easymonitor-parent-id', span.spanId.toString());
            } else {
                args[1].headers['x-easymonitor-trace-id'] = span.traceId.toString();
                args[1].headers['x-easymonitor-parent-id'] = span.spanId.toString();
            }

            return originalFetch.apply(this, args as any)
                .then(res => {
                    span.setAttribute('http.status_code', res.status);
                    if (res.status >= 400) span.error = 1;
                    span.end();
                    return res;
                })
                .catch(err => {
                    span.recordException(err);
                    span.end();
                    throw err;
                });
        });
    };
}

console.log(`  [EasyMonitor] Native Node/Bun Agent successfully attached to ${SERVICE_NAME}!`);
