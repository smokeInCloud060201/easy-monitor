# Phase 49: Agent Database & External Service Monitoring - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Establishing standardized tracing instrumentation for out-of-band requests natively across Node.js, Go, Rust, and Java agents. 

Specifically targeting:
1. External HTTP client requests (outgoing REST/RPCs).
2. Database query drivers (SQL queries).
</domain>

<decisions>
## Implementation Decisions

### 1. Outbound HTTP Tracing Scope
- **Option B (Chosen): Expanded Clients.**
- **Node.js**: The agent will monkey-patch the native `http` and `https` modules, and additionally hook common high-level wrappers like `fetch` and `axios`. 
- **Go**: We will rely on our existing `WrapHTTPClient` wrapper for standard HTTP, or explore if additional driver middlewares are needed.
- **Rust**: We will create a `reqwest-middleware` compatible layer to trace HTTP emissions.
- **Java**: ByteBuddy will intercept `java.net.HttpURLConnection` (or `HttpClient`) request boundaries.

### 2. Database Driver Telemetry Scope
- **Option A (Chosen): Standard SQL Drivers.**
- **Node.js**: We will monkey-patch the `pg` (PostgreSQL) and `mysql2` execution cycles.
- **Go**: We will provide a `database/sql` driver wrapper containing our tracing spans.
- **Rust**: We will define an `sqlx` compatible hook layer.
- **Java**: Using ByteBuddy, we will intercept JDBC's `java.sql.PreparedStatement.execute()` execution points.

### 3. PII Database Threat Model
- **Option B (Chosen): Basic Query Obfuscation.**
- APM payloads must NOT transmit raw user strings to the backend natively to preserve GPDR/CCPA compliance automatically out of the box. 
- Spans with `type: sql` will have their `meta['db.query']` scrubbed utilizing a simple Regex ruleset (e.g. replacing `['"](.*?)['"]` and numerical literal boundaries with `?`).
</decisions>

<canonical_refs>
## Canonical References
- `agents/README.md` — Core span taxonomy specification.
</canonical_refs>

<code_context>
## Existing Code Insights
- Phase 47/48 successfully deployed a robust bounded aggregation pipeline where native interceptors cleanly drop traces at memory boundaries, meaning expanding our hooks to cover databases introduces no new architectural instability as long as `DatadogSpan` formatting is matched.
</code_context>

<specifics>
## Specific Ideas
- Utilize zero-allocation regex compiled structures (`regex` crate in Rust, built-in global patterns JS) to ensure query sanitization overhead remains near-zero milliseconds.
</specifics>

<deferred>
## Deferred Ideas
- No-SQL databases (e.g. MongoDB, Redis, Cassandra) hooks are deferred outside this milestone.
- Async queuing tracing (e.g. RabbitMQ, Kafka) deferred.
</deferred>

---

*Phase: 49-agent-database-external-service-monitoring*
*Context gathered: 2026-03-26*
