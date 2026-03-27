# Phase 55: Fix trace metrics endpoint aggregation and implement framework-level URL obfuscators in all polyglot agents - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Source:** User Bug Report / PRD Express Path

<domain>
## Phase Boundary
Implement URL anonymization natively inside each language agent's framework interceptors, and restore the APM service details metrics filter to ignore outbound HTTP clients.
</domain>

<decisions>
## Implementation Decisions

### APM Endpoint Aggregation
- The `trace_metrics.rs` RED metrics engine must explicitly discard outbound client queries (e.g. `http.client.request`) from the resources list so `order-service` doesn't claim downstream endpoints as its own APIs.

### Agent Framework-Level URL Masking
- The URL scrub logic (`/?`) must be shifted out of the central `node-agent` proxy and into the native tracing intercepts for **Java**, **Go**, **Rust**, and **Node.js**.
- This ensures language-specific request paths are captured and anonymized safely *before* leaving the application boundary.
</decisions>

<canonical_refs>
## Canonical References
No external specs — requirements fully captured in decisions above.
</canonical_refs>
