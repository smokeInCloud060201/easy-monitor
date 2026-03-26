# Phase 48: Agent Metrics Aggregation & Error Collection - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Standardizing how RED metrics (Rate, Errors, Duration) are extracted from telemetry pipelines and how exceptions are mapped consistently within trace spans across all polyglot agents (Java, Go, Node, Rust).
</domain>

<decisions>
## Implementation Decisions

### 1. RED Metrics Aggregation Strategy
- **Option A (Chosen): Backend Compute Model.** Local agents will NOT maintain state or counters for metrics. Their sole responsibility is executing Phase 47's batched spans properly. 
- The `node-agent` and `master-service` will intercept incoming span payloads, aggregate RED metrics instantly in memory or via stream aggregation, and commit those to the metrics storage layers dynamically.

### 2. Exception Capture Limits
- **Option A (Chosen): Truncated stacks.**
- Strict payload caps must apply to trace `meta`. Exception stack traces must be truncated (e.g. bounded to ~1000 characters or 10-15 depth frames strings) to protect payload batch sizes and `sled`/`clickhouse` performance downstream.

### 3. Log Correlation
- **Option A (Chosen): Span-Attached Only.**
- When local tracer middleware hooks catch an exception, it is tagged exclusively on the trace span itself (`error=1`, `error.message="X"`, `error.stack="..."`). 
- Agents will NOT emit a redundant GELF log for span exceptions. Deduplication helps streamline agent IO. 

### Claude's Discretion
- Code-level truncation algorithms per-language (e.g. string slicing in Rust vs array slice in Node.js stack objects).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Functional Specs
- `agents/README.md` — The Core Functional Specification covering span format definitions.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Node.js tracer already intercepts `recordException(err: Error)` setting `error.message` and `error.stack`. Rust tracer converts generic `Visit` `record_error` hooks.
- Master Service already parses the inbound MessagePack buffer into `DatadogSpan` rows, ideal for hooking a basic metrics counting pass over duration and errors.

### Established Patterns
- We keep agents maximally dumb. Shifting complexity to the master sink is a core architectural pattern since Phase 45.
</code_context>

<specifics>
## Specific Ideas
- None provided outside core selections.
</specifics>

<deferred>
## Deferred Ideas
- Standalone host-level Prometheus metrics (CPU/Memory overhead logic) are entirely deferred or previously solved by the `sysinfo` integration. 
</deferred>

---

*Phase: 48-agent-metrics-aggregation-error-collection*
*Context gathered: 2026-03-26*
