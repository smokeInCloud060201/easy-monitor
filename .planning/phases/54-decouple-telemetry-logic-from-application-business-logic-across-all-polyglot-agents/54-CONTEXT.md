# Phase 54: Decouple telemetry logic from application business logic across all polyglot agents - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Source:** User Prompt

<domain>
## Phase Boundary

The goal of this phase is to eliminate all manual OpenTelemetry/tracing annotations, instrumentation macros, and wrapper initialization from the application business logic repositories (`mock-app`). 
Telemetry logic should be 100% decoupled and handled entirely by the respective APM language agents.
</domain>

<decisions>
## Implementation Decisions

### Architectural Rule Enforcement
- **Critical Rule:** Applications handle business logic, agents handle tracing, monitoring, and logging.
- Applications MUST NOT use manual annotations or wrappers to capture traces, spans, or SQL queries.

### Polyglot Cleanups
- **Rust (`inventory-service`, `notification-service`):** Remove all `#[tracing::instrument(...)]` macros from business repository files.
- **Go (`product-service`, `user-service`):** Remove explicit `db.Use(&telemetry.GormTracer{})` wiring from the business logic.
- **Java & Node:** Ensure no application-level APM references exist in the business logic codebase.

### Agent Responsibilities
- The Rust agent and Go agent must be refactored to intercept these events automatically at the framework/database driver level (or via a single standardized entrypoint wrapper) without requiring the application developer to manually annotate or wrap their business repositories.
</decisions>
