# Phase 44 Research: Datadog APM Agent Collector Formats

## Objective
Understand the exact payload format and transport mechanism used by Datadog APM agents to submit traces, so we can implement a compatible HTTP POST receiver in `node-agent` and build the payload generators in our polyglot agents (Java, Node, Go, Rust).

## 1. Transport Mechanism
Datadog APM agents do not use gRPC or OTLP by default. They use **HTTP POST** to a local collector (usually the Datadog Agent listening on `localhost:8126`).
- **Endpoint:** `/v0.4/traces` (or `/v0.3/traces` for older clients)
- **Method:** `POST`
- **Content-Type:** `application/msgpack` (MessagePack is used for high performance and low overhead). JSON is sometimes supported for debugging, but MessagePack is the standard.

## 2. Payload Structure (v0.4)
The payload is a serialized array of traces. A trace is an array of spans.
Therefore, the root payload is `[][]Span`.

### Span Object Dictionary
Each span is a dictionary (MessagePack map) containing:
- `trace_id`: (uint64) Unique identifier for the trace. (Datadog also recently supports 128-bit via tags, but 64-bit is classic).
- `span_id`: (uint64) Unique identifier for the span.
- `parent_id`: (uint64) ID of the parent span (0 if root span).
- `name`: (string) The operation name (e.g., `http.request`, `db.query`).
- `resource`: (string) The specific resource being accessed (e.g., `/api/v1/users`, `SELECT * FROM users`).
- `service`: (string) The name of the microservice (e.g., `checkout-service`).
- `type`: (string) The span type for UI categorization (e.g., `web`, `db`, `cache`, `custom`).
- `start`: (int64) The start time of the span in **nanoseconds** since the UNIX epoch.
- `duration`: (int64) The duration of the span in **nanoseconds**.
- `error`: (int32) `1` if the span represents an error, `0` otherwise.
- `meta`: (map[string]string) String-based tags and metadata (e.g., `http.status_code`, `error.message`, `error.stack`).
- `metrics`: (map[string]float64) Numeric metrics associated with the span.

## 3. Node-Agent Current State
Currently, `node-agent/src/apm/mod.rs` implements `TraceServiceServer` which accepts OpenTelemetry (OTLP) gRPC requests (`ExportTraceServiceRequest`).

**Required Changes for Phase 44/Future Implementation:**
1. The `node-agent` needs an HTTP module (e.g., `axum` or `actix-web`) that listens on a port (e.g., `8126`) and exposes `POST /v0.4/traces`.
2. The HTTP handler must successfully parse the MessagePack payload into the `[][]DatadogSpan` struct.
3. It must translate these spans into the internal `shared_proto::traces::Span` format and flush them to the WAL (Write-Ahead Log) just like the OTLP receiver currently does.

## 4. Polyglot Agents Architecture
The 4 agents (`node`, `java`, `go`, `rust`) must be implemented to standardly buffer spans in memory and periodically flush them (e.g., every 1 second or 1000 spans) using an HTTP POST to the node-agent with the MessagePack encoded `[][]Span` payload.

## Validation Architecture
- **Input Verification**: Can the `node-agent` successfully decode a mocked MessagePack v0.4 payload?
- **Data Integrity**: Are 64-bit integers precision-safe during parsing?
- **Transport Verification**: Can an agent perform a POST request and receive a `200 OK`?

## RESEARCH COMPLETE
