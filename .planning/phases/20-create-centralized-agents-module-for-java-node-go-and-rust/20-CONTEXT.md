# Phase 20: Centralized Agents Module - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Source:** User Request

<domain>
## Phase Boundary

The user wants to establish a unified `/agents` module in the root of the project to house telemetry interceptors for different languages (Java, Bun/Node, Go, Rust), migrating away from injecting OpenTelemetry library dependencies directly into the application source folders. 
This brings the EasyMonitor offering much closer to Datadog's centralized agent installation paradigm.

</domain>

<decisions>
## Implementation Decisions

### Directory Structure
- We will create an `agents/` folder in the project root containing subfolders for each language tier: `java/`, `node/`, `go/`, and `rust/`.

### 1. `agents/java` (True JVM Zero-Code Agent)
Instead of a custom agent extension, we will place the `opentelemetry-javaagent.jar` here. As proven in Phase 19, the vanilla agent perfectly intercepts Spring Boot when configured correctly via environment variables.

### 2. `agents/node` (Bun/NodeJS Zero-Code Agent)
We will move the central `instrumentation.ts` concept into `agents/node`. The mock-app `payment-service` will be refactored to require this pre-loaded file from the `agents` directory.

### 3. `agents/go` and `agents/rust` (Minimal-Code Helper Modules)
Since Go and Rust do not support dynamic run-time agent injection without eBPF (outside the scope of this mock app design), we will create localized helper modules (`agents/go/telemetry` and `agents/rust/telemetry`). We will refactor `category-service` and `notification-service` respectively to import these centralized modules. 

</decisions>

<canonical_refs>
## Canonical References
- `mock-app/start.sh`
- `mock-app/checkout-service/start.sh`
- `mock-app/payment-service/package.json`
</canonical_refs>
