/**
 * Shared tracing utility for creating manual child spans
 * using the OpenTelemetry API. Each span simulates realistic
 * async work (DB queries, cache lookups, validation, etc.)
 */
const { trace, SpanStatusCode, context } = require('@opentelemetry/api');

const tracer = trace.getTracer('mock-app-manual');

/**
 * Create a child span with simulated async work.
 * @param {string} name - Span operation name (e.g., "db.query SELECT users")
 * @param {object} opts - Options
 * @param {number} opts.minMs - Minimum simulated duration (ms)
 * @param {number} opts.maxMs - Maximum simulated duration (ms)
 * @param {number} opts.errorRate - Probability of error (0-1)
 * @param {object} opts.attributes - Additional span attributes
 * @param {function} opts.fn - Optional async function to run inside span
 * @returns {Promise<any>} Result of fn, or undefined
 */
async function withSpan(name, opts = {}) {
  const {
    minMs = 5,
    maxMs = 50,
    errorRate = 0,
    attributes = {},
    fn = null,
  } = opts;

  const currentCtx = context.active();
  
  return tracer.startActiveSpan(name, { attributes }, currentCtx, async (span) => {
    try {
      // Simulate async work
      const duration = Math.random() * (maxMs - minMs) + minMs;
      await new Promise(resolve => setTimeout(resolve, duration));

      // Simulate random errors
      if (errorRate > 0 && Math.random() < errorRate) {
        const err = new Error(`${name} failed`);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        span.recordException(err);
        throw err;
      }

      // Run custom function if provided
      let result;
      if (fn) {
        result = await fn(span);
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Simulate a database query span
 */
async function dbQuery(operation, table, opts = {}) {
  return withSpan(`db.query ${operation} ${table}`, {
    minMs: opts.minMs || 10,
    maxMs: opts.maxMs || 80,
    errorRate: opts.errorRate || 0.02,
    attributes: {
      'db.system': 'postgresql',
      'db.operation': operation,
      'db.sql.table': table,
      'db.statement': opts.statement || `${operation} FROM ${table}`,
    },
    fn: opts.fn,
  });
}

/**
 * Simulate a cache lookup span
 */
async function cacheOp(operation, key, opts = {}) {
  const hit = Math.random() > 0.3; // 70% hit rate
  return withSpan(`cache.${operation} ${key}`, {
    minMs: hit ? 1 : 2,
    maxMs: hit ? 5 : 10,
    errorRate: 0,
    attributes: {
      'cache.system': 'redis',
      'cache.operation': operation,
      'cache.key': key,
      'cache.hit': hit,
    },
    fn: async () => ({ hit, value: hit ? { cached: true } : null }),
  });
}

module.exports = { withSpan, dbQuery, cacheOp, tracer };
