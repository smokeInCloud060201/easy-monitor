# Phase 47 Research: Agent Buffering, Batching & Sampling Modules

## Current Architecture Assessment
The 4 native agents currently exhibit disparate payload transmission architectures that lack protective backpressure, memory limits, and unified batching logic.

1. **Go Agent (`telemetry.go`)**:
   - Every `span.Finish()` calls `SendSpan()` which unconditionally fires an asynchronous `go func()` to process and send an HTTP request.
   - **Gaps**: No batching, unbounded goroutine spawning, no sampling.

2. **Rust Agent (`lib.rs`)**:
   - `tracing::on_close` spawns a fresh `tokio::spawn` task to send an HTTP POST request per trace.
   - **Gaps**: Extremely high network IO over TCP. Unbounded concurrency that could exhaust file descriptors. No time/size-based batching.

3. **Node.js Agent (`instrumentation.ts`)**:
   - Modest batching using `buffer: any[]` and `setTimeout(flush, 1000)`.
   - **Gaps**: The array `buffer` is fully unbounded, leading to severe OOM risks during load spikes. Lacks size/count-based flush triggers (only time).

4. **Java Agent (`DatadogSpanExporter.java`)**:
   - Uses `LinkedBlockingQueue<DatadogSpan>(10000)` and a background daemon thread doing `take()` and `drainTo(batch, 99)`.
   - **Gaps**: Queue is strictly bounded (good), but the `take()` method blocks indefinitely, meaning low-traffic traces will sit in memory forever if a 100th trace never arrives. Lacks time-based timeout flushing (e.g. `poll(timeout)`).

## Target Architecture Strategies

### 1. Unified Buffering (Fail-Safe)
Each agent must maintain a thread-safe, non-blocking *Bounded Queue* or *Ring Buffer*.
- **Capacity**: Limit array/channel sizes (e.g., max 5000 spans).
- **Overflow Drop**: If limits are reached, silently drop the span to spare host memory.

### 2. Batching & Flushing (Hybrid)
We must implement a hybrid size+time flushing interval natively.
- **Go**: Use `select` block over a `time.Ticker(1s)` and a `chan Span(1000)` where buffer size >= 100 triggers early flush.
- **Rust**: Use `tokio::sync::mpsc::channel(1000)`. A dedicated background loop should `select!` on a `tokio::time::interval(1s)` and the channel receiver. Push to a `Vec` and flush when len > 100 or timeout.
- **Node**: Retain `setTimeout` but restrict `buffer.length <= 1000`. If length exceeds batch size, trigger immediate HTTP flush.
- **Java**: Replace `take()` with `poll(1, TimeUnit.SECONDS)`. If a timeout hits, flush the existing batch array.

### 3. Priority & Probabilistic Sampling
- **Head-Based**: Add a static configuration probability (default 100%). Generate a random float `0.0-1.0` on trace root creation; if above probability, tag span with `sampling.priority=-1` (drop) or `0` (keep).
- **Error Retention**: Force priority to `1` (keep) if an Exception/Error occurs, overriding probabilistic drops.

## Validation Architecture

1. **Unit Verification**:
   - Verify Node.js buffer does not exceed max limits under simulated load loops.
   - Verify Java Agent unblocks every 1 second via `poll()` even with sparse traffic.
2. **End-to-End Stress Test (`mock-app`)**:
   - Generate high traffic on the mock-app using `wrk` or `hey`.
   - Validate that host containers (product-service, node-agent) do not exceed memory thresholds (OOM).
   - Validate spans are correctly arriving in MessagePack format at the Node.js APM sink, batched in arrays `> 1` length.
