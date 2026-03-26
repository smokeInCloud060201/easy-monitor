# Phase 45: Agent Native Instrumentation Modules - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Implementing the first set of native library and framework hooks (Java Agent/ByteBuddy, Node async_hooks, Go/Rust manual integrations) to capture spans natively without OpenTelemetry. New capabilities like database/queue deep-tracing are primarily deferred to Phase 49, though basic wrappers for DB may be included if they match standard middleware layers.
</domain>

<decisions>
## Implementation Decisions

### Framework vs. Stdlib Hook Depth
- **Level 1 (Primary)**: High-level frameworks (Express, Spring Web, etc.)
- **Level 2 (Secondary)**: Standard libraries (http, java.net)
- **Level 3 (Fallback)**: Low-level network / runtime hooks

### Hook Failure Behavior
- **Priority 1**: Fail-safe. Never impact application execution.
- **Priority 2**: Degrade gracefully (disable only failing instrumentation).
- **Priority 3**: Low-noise logging (log minimally at debug-level, not noisy).

### Go/Rust Integration API Surface
- **Primary (Default)**: Idiomatic middleware (e.g., net/http, chi, gin, echo, database/sql wrappers in Go; Tower, Axum middleware, and tracing ecosystem in Rust) for zero-friction drop-in setup. Matches Datadog ecosystem patterns.
- **Secondary (Optional)**: Low-level custom tracing API (`tracer.StartSpan()`, manual span creation) for custom business logic, non-standard workflows, and fine-grained control.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Foundational Spec
- `agents/README.md` — The Core Functional Specification for the agents.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agents/node/instrumentation.ts` — Already imports `async_hooks` to be used for context propagation.
- `agents/java/build.gradle` & `EasyMonitorAgent.java` — `ByteBuddy` dependencies and premain setup are already established.

### Established Patterns
- Native data structures (`[]Span`) and MessagePack HTTP transport established in Phase 44.

</code_context>

<specifics>
## Specific Ideas
- Datadog-style approach strongly preferred. Use middleware for entry points, wrappers for common libs, and custom API only when explicitly needed.

</specifics>

<deferred>
## Deferred Ideas
- Deep tracing for external Databases/Queues is technically the goal of Phase 49, but simple entry-point db wrappers are okay if part of the primary ecosystem pattern.

</deferred>

---

*Phase: 45-agent-native-instrumentation-modules*
*Context gathered: 2026-03-26*
