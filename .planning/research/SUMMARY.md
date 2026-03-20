# Project Research Summary

**Project:** easy-monitor
**Domain:** Observability Platform (Logs, Metrics, Traces)
**Researched:** 2026-03-20
**Confidence:** HIGH

## Executive Summary

Observability platforms like Datadog and Graylog solve massive enterprise problems but introduce extreme cost or complexity. Implementing a "Datadog-lite" platform requires careful balancing: it must provide the "Holy Trinity" of observability (Logs, Metrics, Traces) unified by context, but it must be deployable with zero-config effort (e.g., a simple Docker Compose file) and maintain very low resource overhead on both the client (agent) and the server (master).

The recommended approach, matching the existing trajectory of the code, relies heavily on a high-performance Rust backend using `tonic` (gRPC) for efficient telemetry streaming, pushing the heavy lifting to the master node while keeping the `node-agent` incredibly lightweight. 

The primary risk is the "Unified Context" UI and Data Model. If logs, metrics, and traces are siloed in the dashboard, the product fails its core value proposition.

## Key Findings

### Recommended Stack

**Core technologies:**
- Rust / Tokio: High concurrency, memory-safe backend services.
- gRPC (Tonic): Efficient, batched telemetry streaming over TLS.
- React / Vite: Dashboard UI framework.
- Sled: Embedded key-value store for simplified data persistence without managing external database clusters.

### Expected Features

**Must have (table stakes):**
- Standard Metrics (CPU/RAM/Disk)
- Centralized log aggregation with search.
- Distributed tracing basic ingestion.

**Should have (competitive):**
- **Unified Context**: Jump instantly between a metric spike and the relevant trace/logs.
- **Span Waterfall Visualization**: Graylog-style intuitive request breakdowns.
- **Zero-Config Deployment**: Painless Docker/K8s onboarding.

### Architecture Approach

**Major components:**
1. `node-agent` — Lightweight host process collecting metrics/logs/spans, buffering via local WAL, streaming via gRPC.
2. `master-service` — Central ingestion engine, storing data in `sled`, querying via REST.
3. `dashboard` — React SPA visualizing the data.

### Critical Pitfalls

1. **Unbounded Agent Resources** — Throttle memory usage on `node-agent` to prevent crashing user host applications.
2. **Contextless Tracing** — Ensure strict linking of `trace_id` between logs and spans, else the waterfall UI fails.
3. **Database Exhaustion** — Sled isn't built for infinite analytics. Enforce strict retention policies or sampling out of the gate.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Unified Dashboard Foundation
**Rationale:** The backend architecture is mostly validated. The user needs to see the value immediately.
**Delivers:** Core React SPA wiring, basic metric charts, and log viewer integration.
**Addresses:** Unified Context feature foundation.

### Phase 2: Span Waterfall Visualization
**Rationale:** The core differentiating feature requested by the user.
**Delivers:** The complex UI component for rendering request trees and linking them to logs.
**Addresses:** Span Waterfall Visualization.

### Phase 3: Zero-Config Deployment Engineering
**Rationale:** Makes the MVP accessible to users to prove the "easy setup" value.
**Delivers:** Polished Docker Compose files, Helm charts, and agent installation scripts.
**Avoids:** Unbounded Agent Resources (by shipping with safe defaults).

### Research Flags

- **Phase 2 (Span Waterfall):** Needs deep research into D3.js or sophisticated React graphing libraries to render complex nested trees efficiently without DOM lag.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Validated by existing codebase and industry norms. |
| Features | HIGH | Directly maps to user requests to blend Datadog and Graylog. |
| Architecture | HIGH | Standard agent/master telemetry pattern. |
| Pitfalls | HIGH | Known limitations of embedded DBs and distributed tracing. |

**Overall confidence:** HIGH

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
