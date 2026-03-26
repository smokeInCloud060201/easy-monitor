# Phase 47: Agent Buffering, Batching & Sampling Modules - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimizing trace transmission across the 4 native agents (Java, Node, Go, Rust) by introducing intelligent memory buffering, batching logic, and sampling policies. This enforces "fail-safe" rules to ensure the agents remain featherweight and never trigger memory crashes in the host applications.
</domain>

<decisions>
## Implementation Decisions

### Buffering Strategy (Bounded & Fail-Safe)
- Strict bounded buffers limited by total count and memory size.
- **Rules of Overflow**: Drop new traces (fail-safe mode limit). Do NOT block application threads or expand buffer arrays endlessly.
- **Priority-aware dropping**: When the buffer nears capacity, actively drop low-priority traces to ensure high-priority traces (e.g. errors or flagged items) can still be absorbed.

### Flushing & Batching Triggers (Hybrid Model)
- **Time-based**: Periodic fallback flush every ~1 second.
- **Threshold-based**: Flush immediately when max span count or max payload size constraints are met (typically batching ~100s-1000 spans reaching ~100 KB - 1 MB).
- **Early-Pressure Trigger**: Trigger an early flush aggressively if buffer pressure builds up unexpectedly before hard drops start.

### Sampling Policies
- **Tracer (Head-Based)**: Probabilistic sampling + priority assignment at trace generation time to discard noise immediately.
- **Agent Intake (Rate Limiting)**: Intake worker pools govern and dynamically rate limit throughput to survive massive spikes.
- **Storage / Backend (Tail-Based)**: Tail-based intelligent retention keeping rare 5xx errors or massive latency outliers longer vs heavily downsampled nominal traffic.

### Resource Footprint
- **Tracer Footprint**: Extremely lightweight — only 1 background flush worker/sync-loop to prevent IO locks, compressing small payloads.
- **Node-Agent Footprint**: Scaled worker pool dividing Intake, Processing (normalization, sampling), and Sender nodes exporting bigger batches up to ~5MB.

### Claude's Discretion
- Claude can decide the exact data formatting of the MessagePack batches alongside what HTTP chunking strategy maps cleanly to Axum/Reqwest limits.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Functional Specs
- `agents/README.md` — Agent Specification details rules around telemetry isolation and data mapping.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agents/node/instrumentation.ts` already houses an extremely basic time flush (`setTimeout(flush, 1000)`) loop and `buffer.push` which can be upgraded easily to enforce limits.
- `master-service` and `node-agent` ingest points natively unpack MessagePack slices so adjusting payload shapes shouldn't break schemas outright.

### Established Patterns
- "Opinionated simplicity" vs enterprise config. Bounded buffer limits should ideally be sensible hard-coded limits or loaded from standard ENV rather than infinitely tunable files.
</code_context>

<specifics>
## Specific Ideas
- The most critical rule emphasized by the user: "No unbounded queues". Ever. Keep the agent overhead non-existent.
</specifics>

<deferred>
## Deferred Ideas
- None — discussion stayed entirely within the scope of batching, buffers, and scaling footprints.
</deferred>

---

*Phase: 47-agent-buffering-batching-sampling-modules*
*Context gathered: 2026-03-26*
