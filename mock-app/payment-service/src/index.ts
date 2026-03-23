import './instrumentation';
import { trace, SpanStatusCode, context as otelContext, propagation } from '@opentelemetry/api';

const tracer = trace.getTracer('payment-service');
const PORT = 8082;

// ─── Helpers ───
function randomMs(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateSpan(parentCtx: any, name: string, minMs: number, maxMs: number, attrs: Record<string, string> = {}): Promise<void> {
  return tracer.startActiveSpan(name, {}, parentCtx, async (span) => {
    try {
      Object.entries(attrs).forEach(([k, v]) => span.setAttribute(k, v));
      await sleep(randomMs(minMs, maxMs));
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
    }
  });
}

async function simulateDbSpan(parentCtx: any, op: string, table: string, statement: string, minMs: number, maxMs: number): Promise<void> {
  return tracer.startActiveSpan(`db.query ${op} ${table}`, {}, parentCtx, async (span) => {
    try {
      span.setAttribute('db.system', 'postgresql');
      span.setAttribute('db.operation', op);
      span.setAttribute('db.sql.table', table);
      span.setAttribute('db.statement', statement);
      await sleep(randomMs(minMs, maxMs));
      if (Math.random() < 0.02) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'connection timeout' });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
    } finally {
      span.end();
    }
  });
}

async function simulateCacheSpan(parentCtx: any, op: string, key: string): Promise<boolean> {
  const hit = Math.random() < 0.7;
  return tracer.startActiveSpan(`cache.${op} ${key}`, {}, parentCtx, async (span) => {
    try {
      span.setAttribute('cache.system', 'redis');
      span.setAttribute('cache.operation', op);
      span.setAttribute('cache.key', key);
      span.setAttribute('cache.hit', hit);
      await sleep(hit ? randomMs(1, 5) : randomMs(2, 8));
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
    }
    return hit;
  });
}

// ─── Extract trace context from incoming request headers ───
function extractContext(headers: Headers): any {
  const carrier: Record<string, string> = {};
  headers.forEach((value, key) => { carrier[key] = value; });
  return propagation.extract(otelContext.active(), carrier);
}

// ─── Server ───
const server = Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);
    const incomingCtx = extractContext(req.headers);

    // POST /api/charge
    if (req.method === 'POST' && url.pathname === '/api/charge') {
      return tracer.startActiveSpan('POST /api/charge', {}, incomingCtx, async (rootSpan) => {
        try {
          const body = await req.json() as { amount?: number; currency?: string; order_id?: string };
          const txnId = 'txn_' + Date.now();
          const ctx = trace.setSpan(otelContext.active(), rootSpan);

          // Step 1: Validate card
          await simulateSpan(ctx, 'validate_card', 10, 30, {
            'payment.card_type': 'visa',
            'payment.last4': '4242',
          });
          if (Math.random() < 0.05) {
            rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'Card validation failed' });
            rootSpan.end();
            return Response.json({ success: false, error: 'Card validation failed' }, { status: 400 });
          }

          // Step 2: Fraud detection
          const fraudScore = Math.random() * 100;
          await simulateSpan(ctx, 'fraud_check', 30, 120, {
            'fraud.score': fraudScore.toFixed(1),
            'fraud.provider': 'stripe_radar',
          });
          if (Math.random() < 0.03) {
            rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'Flagged by fraud detection' });
            rootSpan.end();
            return Response.json({ success: false, error: 'Flagged by fraud detection' }, { status: 400 });
          }

          // Step 3: Check duplicate transactions
          await simulateDbSpan(ctx, 'SELECT', 'transactions',
            "SELECT id FROM transactions WHERE idempotency_key = $1 AND created_at > now() - interval '5 minutes'",
            8, 25);

          // Step 4: Process charge
          const isSuccess = Math.random() > 0.15;

          if (isSuccess) {
            await simulateDbSpan(ctx, 'INSERT', 'transactions',
              `INSERT INTO transactions (id, amount, status, card_last4) VALUES ('${txnId}', ${body.amount || 149.99}, 'completed', '4242')`,
              10, 35);
            await simulateCacheSpan(ctx, 'SET', 'balance:merchant_001');
            rootSpan.setStatus({ code: SpanStatusCode.OK });
            rootSpan.end();
            return Response.json({ success: true, transaction_id: txnId, amount: body.amount || 149.99, status: 'completed' });
          } else {
            await simulateDbSpan(ctx, 'INSERT', 'transactions',
              `INSERT INTO transactions (id, amount, status) VALUES ('${txnId}', ${body.amount || 149.99}, 'declined')`,
              8, 20);
            rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'Payment declined' });
            rootSpan.end();
            return Response.json({ success: false, error: 'Payment declined', transaction_id: txnId }, { status: 400 });
          }
        } catch (err: any) {
          rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          rootSpan.end();
          return Response.json({ error: 'Payment processing error', detail: err.message }, { status: 500 });
        }
      });
    }

    // GET /api/payment/status/:id
    if (req.method === 'GET' && url.pathname.startsWith('/api/payment/status/')) {
      return tracer.startActiveSpan(`GET ${url.pathname}`, {}, incomingCtx, async (rootSpan) => {
        try {
          const id = url.pathname.split('/').pop() || 'unknown';
          const ctx = trace.setSpan(otelContext.active(), rootSpan);
          const cacheHit = await simulateCacheSpan(ctx, 'GET', `txn:${id}`);
          if (!cacheHit) {
            await simulateDbSpan(ctx, 'SELECT', 'transactions',
              `SELECT * FROM transactions WHERE id = '${id}'`, 10, 40);
          }
          rootSpan.setStatus({ code: SpanStatusCode.OK });
          rootSpan.end();
          return Response.json({ transaction_id: id, status: 'completed', amount: 149.99, created_at: new Date().toISOString() });
        } catch (err: any) {
          rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          rootSpan.end();
          return Response.json({ error: err.message }, { status: 500 });
        }
      });
    }

    // GET /api/health
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'healthy', service: 'payment-service' });
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Payment Service (Bun) running on :${PORT}`);
