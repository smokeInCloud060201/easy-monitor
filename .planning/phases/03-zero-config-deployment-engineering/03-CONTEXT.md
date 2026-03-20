# Phase 3: Zero-Config Deployment Engineering - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary
Package the platform (Master Service, Dashboard, Node Agent, and ClickHouse) into frictionless Docker deployments so users can spin up the full observability stack with zero manual configuration.
</domain>

<decisions>
## Implementation Decisions

### 1. Container Build Strategy
**Decision:** Configure `docker-compose.yml` to build from source using local Dockerfiles.
- *Rationale:* Best for developers who clone the repo. Ensures they are always running the code they see.

### 2. Frontend Serving Strategy
**Decision:** Embed it. Compile the React build into `master-service` and serve it via our Rust Axum router.
- *Rationale:* Simplest infrastructure (one less container). Aligns with the "low-effort" single-binary goal for the master platform.

### 3. State Persistence
**Decision:** Add a ClickHouse container to the `docker-compose.yaml` and wire `master-service` to it.
- *Rationale:* Progresses the MVP beyond pure mock data, allowing real ingestion testing and demonstrating the true value of the platform.
</decisions>
