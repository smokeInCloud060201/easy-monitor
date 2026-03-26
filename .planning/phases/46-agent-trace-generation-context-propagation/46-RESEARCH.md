# Phase 46: Agent Trace Generation & Context Propagation - Research

## Objective
Research how to implement Span lifecycle management and distributed tracing header propagation (e.g., `x-easymonitor-trace-id`) across the 4 native agents (Go, Java, Node.js, and Rust) without OpenTelemetry SDKs.

## Current State Analysis
In Phase 44/45, OpenTelemetry SDKs were thoroughly purged, and we pivoted to a native tracing model where agents serialize spans into MessagePack and send them directly to the `node-agent` endpoint (`http://127.0.0.1:8126/v0.4/traces`). The data format maps to Datadog's `[][Span]` array schema.

### Existing Span Structures
Based on Phase 44, the basic `Span` structs (or types) exist:
- **Go (`telemetry.go`)**: Defines `Span` with `Service`, `Name`, `Resource`, `TraceID` (`uint64`), `SpanID` (`uint64`), `ParentID` (`uint64`), `Start` (`int64`), `Duration` (`int64`), `Error` (`int32`), `Meta` (`map[string]string`), `Metrics` (`map[string]float64`), `Type` (`string`).
- **Rust (`easymonitor-agent/src/lib.rs`)**: Defines `SpanData` serving the exact same schema via `serde` configuration.
- **Node.js (`instrumentation.ts`)**: Generates spans directly matching the Datadog interface using `AsyncLocalStorage`.
- **Java**: Needs a dedicated `Span` class mirroring this schema, likely within `com.easymonitor.agent`.

## Distributed Tracing Header Propagation

### Header Standardization
To emulate Datadog's B3 or W3C equivalents natively, we will use our proprietary headers:
1. **`x-easymonitor-trace-id`**: The 64-bit unsigned integer identifying the entire trace. Represented as a string base-10 integer.
2. **`x-easymonitor-parent-id`**: The 64-bit unsigned integer identifying the caller span. Represented as a string base-10 integer.
3. **`x-easymonitor-sampling-priority`**: Integer (`1` for keep, `0` for drop), ensuring upstream sampling decisions are honored downstream.

### Injection & Extraction Mechanisms per Language

#### Go
- **Context API**: `context.Context` is idiomatic. We pass the current active `*Span` inside the context.
- **Extraction**: In inbound HTTP handlers, parse `req.Header.Get("x-easymonitor-trace-id")`, parse to `uint64`. Create new root span using this parent context.
- **Injection**: In `http.RoundTripper` (implemented in Phase 45), read active span from context and set `req.Header.Set("x-easymonitor-parent-id", strconv.FormatUint(span.SpanID, 10))`.

#### Node.js
- **Context API**: `AsyncLocalStorage`. Holds the active span stack.
- **Extraction**: Express/Koa middleware. Check `req.headers['x-easymonitor-trace-id']`.
- **Injection**: Deep patched HTTP outgoing requests (Phase 45 `require-in-the-middle` patching of `http`/`https` modules). Inject into `options.headers`.

#### Java
- **Context API**: `ThreadLocal<Span>` or an internal `Context` class.
- **Extraction**: Servlet Filter / Spring Interceptor (bytecode patched via ByteBuddy). Extract `HttpServletRequest.getHeader(...)`.
- **Injection**: HTTP Client (e.g., Apache HTTP, OkHttp) interceptors. Add headers to outbound `HttpRequest`.

#### Rust
- **Context API**: `tracing` crate's `Span` extensions, or explicitly passing trace IDs. The `easymonitor-agent` Layer intercepts span creation.
- **Extraction**: Actix-web middleware (exists in `actix_middleware.rs`). Needs update to extract `x-easymonitor-*` headers.
- **Injection**: `reqwest` middleware wrapper (`reqwest_middleware.rs`). Update to inject the custom headers.

## Trace ID Generation & Lifecycles
Since we use generic 64-bit unassigned integers:
- **Generation**: A robust PRNG should generate `uint64` values. Go's `rand.Uint64()`, Rust's `rand`, Node's `crypto.randomBytes(8).readBigUInt64BE(0)`, Java's `ThreadLocalRandom.current().nextLong() & Long.MAX_VALUE`.
- **Timestamping**: Must use nanoseconds precision.
  - Node: `process.hrtime.bigint()`
  - Go: `time.Now().UnixNano()`
  - Java: `System.nanoTime()` + wall clock offset calculation, or `Instant.now()` precision.
  - Rust: `std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos() as i64`

## Validation Architecture
1. **Header Inspection**: Fire request from Node.js (Mock App Payment) -> Go (Mock App Category). Inspect raw TCP or HTTP dumps to ensure `x-easymonitor-trace-id` propagates.
2. **Datadog Intake Validation**: Ensure the `node-agent` receiver correctly parses the parent-child relationships and constructs the execution tree.
3. **Clock Monotonicity Check**: Ensure durations are calculated monotonically (using `hrtime`/`nanoTime` for duration, not wall-clock).

## RESEARCH COMPLETE
