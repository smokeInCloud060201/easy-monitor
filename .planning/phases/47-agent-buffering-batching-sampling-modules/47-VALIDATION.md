# Phase 47: Agent Buffering, Batching & Sampling Modules - Nyquist Validation Strategy

**Strategic Goal:**
Ensure all 4 polyglot agents correctly implement fail-safe bounded buffers, hybrid size/time flushing, and prioritized probabilistic sampling without exceeding memory limits or blocking application threads.

## Validation Dimensions

### 1. Functional Correctness
- **Tracing Buffers**: Verify `SendSpan`/`exportSpan` places spans into an internal bounded memory structure rather than directly performing IO.
- **Batching Triggers**: Verify HTTP POST calls to the backend contain arrays of spans (MessagePack) and occur via background flush loops or threshold breaches (e.g. `array.length >= 1000`).
- **Sampling Rules**: Verify spans generated during a 0% probability window are immediately dropped (or not added to the buffer), unless marked as errors (`error = 1`).

### 2. Failure Modes & Resilience (Fail-Safe)
- **Buffer Overflow**: When the backend is unreachable or traffic is immense, the bounded buffer *must* refuse new spans and drop them, rather than exhausting host memory.
- **Thread Blocking**: Enqueueing a span must never block the main application execution path.

### 3. Cross-Cutting Concerns
- **Performance**: Agent footprint should remain negligible (no massive heap structures).
- **Log Correlation**: Sampling decisions made at the head should ideally eventually propagate to Logs (out of scope for Phase 47 directly, but architecture should allow `trace_id` tagging regardless of export).

## Required Automated Checks

1. **Go Agent**: Write a benchmark or test submitting 5000 spans instantly and verify the array slice capacity does not exceed the bounded max (e.g. 1000).
2. **Rust Agent**: Unit test the MPSC channel capacity limits.
3. **Node.js Agent**: Assert the flush timer clears and resets correctly upon size-based threshold breaches.
4. **Java Agent**: Assert `poll(1, SECONDS)` is used instead of `take()` in the daemon thread, and verify batch lists cap at the defined limit.
