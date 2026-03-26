# Phase 44: Update Easy Monitor Agent Core Functional Specification - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Source:** User Discussion

<domain>
## Phase Boundary

Establishing the shared Data Structures and Transport layers across the 4 languages (Go, Java, Node, Rust). The remaining 13 modules from the `agents/README.md` functional specification will be strictly deferred to follow-up phases.
</domain>

<decisions>
## Implementation Decisions

### 1. Rollout Scope
- Implement Data Structures and Transport layers in Phase 44.
- Explicitly plan future phases within `ROADMAP.md` to roll out the remaining 13 functional modules across the agents so nothing is missed.

### 2. Auto-Instrumentation Strategy
- Do NOT wrap OpenTelemetry SDK binaries under the hood. Implement native first-class instrumentation schemas matching standard Datadog architectures:
- **Java**: Use `-javaagent` with ByteBuddy bytecode instrumentation, modifying classes at load time.
- **Node.js**: Use `require()` patching, `async_hooks` for context propagation, and wrap network/db modules (http, express).
- **Go**: No runtime patching. Use manual + library-based instrumentation with optional auto-instrumentation via build-time or middleware wrapping.
- **Rust**: No runtime patching (no reflection). Use manual instrumentation via tracing libraries. Support OpenTelemetry/Datadog-compatible exporters.

### 3. Transport Protocol
- Logs remain transmitted to Node-Agent via GELF over UDP.
- Metrics and traces MUST communicate with the `node-agent` backend using HTTP POST.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Foundational Spec
- `agents/README.md` — The Core Functional Specification covering all 15 modules.

</canonical_refs>

<specifics>
## Specific Ideas
- Java: Ensure ByteBuddy agent handles pre-main correctly to modify classloaders blindly.
- Node.js: `async_hooks` creates a robust context tracking tree needed for root span parent tracking.
</specifics>

<deferred>
## Deferred Ideas
- Implementation of Error Collection, Correlation Module, Profiling modules, Database/Queue deep-tracing. These will be handled in subsequent planned phases.
</deferred>
