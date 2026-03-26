# Phase 48 Research: Agent Metrics & Errors

## Overview
Phase 48 requires us to aggregate RED metrics locally (or on the backend) and safely capture exception stacks across 4 distinct native agents (`node`, `go`, `rust`, `java`). 

## Findings

### RED Metrics
- **Current State**: Phase 45 introduced the `master-service/src/processors/trace_metrics.rs` engine which subscribes to the `EventBus::Traces`. It already successfully loops over ingested traces, computes RED (Rate, Error, Duration p50/95/99), and persists records to the `easy_monitor_red_metrics` ClickHouse table. 
- **Action**: Per user Option A, we will completely rely on this existing backend ingestion pipeline. No agent-level RED counter mechanisms are necessary. 

### Exception Stack Captures
All four native agents must safely parse and attach strings to the `error.stack` and `error.type` metadata maps. To protect the payload sizes across the wire, all strings inserted into these maps must be truncated to a hard limit of `2000 characters`.

1. **Node.js** (`agents/node/instrumentation.ts`):
   - Already captures `error.message` and `error.stack`.
   - Action: Add `error.type` mapping (`err.name`), and apply `substring(0, 2000)` truncation to the stack property.
2. **Go** (`agents/go/telemetry.go`):
   - Currently recovers panics but only logs `error.message` without stack context.
   - Action: Import `runtime/debug` and extract `debug.Stack()`. Truncate the resulting string to 2000 chars and map to `error.stack`.
3. **Rust** (`agents/rust/easymonitor-agent/src/lib.rs`):
   - Leverages `tracing::field::Visit` for metadata extraction (`record_error`, `record_str`).
   - Action: Apply truncation limits on the extracted generic string allocations before inserting them into the DashMap memory buffer.
4. **Java** (`agents/java/src/main/java/com/easymonitor/agent/ServletAdvice.java`):
   - Captures `error.message` but ignores stack outputs.
   - Action: Generate local `PrintWriter(StringWriter())` dumps for exceptions hitting the method exit hooks, slicing outputs over length bounds.

## Architectural Verification
The truncation protects against Out-Of-Memory (OOM) anomalies during serialization to `MessagePack` arrays in high-throughput enterprise environments.
