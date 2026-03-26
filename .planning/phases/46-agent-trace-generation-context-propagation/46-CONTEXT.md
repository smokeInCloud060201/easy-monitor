# Phase 46: Agent Trace Generation & Context Propagation - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement Span lifecycle management and distributed tracing header propagation across the 4 native agents (Java, Node, Go, Rust). Focus on creating, parenting, and propagating spans robustly without OTel.
</domain>

<decisions>
## Implementation Decisions

### ID Generation Format
- Trace and Span IDs will be generated as **64-bit unsigned integers** (`uint64`). This ensures direct compatibility with the Datadog v0.4 MessagePack schema and optimizes payload size.

### Propagation Headers
- Context propagation will use custom `x-easymonitor-*` HTTP headers (e.g., `x-easymonitor-trace-id`, `x-easymonitor-parent-id`, `x-easymonitor-sampling-priority`) to establish a unique EasyMonitor brand and tracing ecosystem.

### Clock Resolution
- Span timestamps and durations will use **nanosecond** precision (`UnixNano`), aligning with Datadog's API requirements and ensuring sufficient detail for fast local execution tracing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Foundational Spec
- `agents/README.md` — Core Functional Specification detailing trace generation, ID structures, and propagation header keys.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The Datadog `Span` struct where `trace_id` and `span_id` are mapped to uint64 and `start`/`duration` are mapped to int64 nanoseconds, established in Phase 44 across polyglot models.

</code_context>

<specifics>
## Specific Ideas
- All 4 agents (Go, Rust, Java, Node.js) must standardize on the exact same custom `x-easymonitor-*` propagation headers to ensure inter-service causality works.

</specifics>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---

*Phase: 46-agent-trace-generation-context-propagation*
*Context gathered: 2026-03-26*
