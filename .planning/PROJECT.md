# easy-monitor

## Core Value
A unified, low-effort observability platform (Datadog-lite) that brings together metrics, logs, application errors, and trace spans. It drastically reduces the complexity of self-hosting the traditional ELK/Prometheus stack, while avoiding the exorbitant costs of enterprise SaaS solutions, serving as a powerful drop-in solution primarily via an agent injected into client systems.

## Constraints
- **Low friction**: Must be simpler to install and maintain than standard ELK/Grafana stacks.
- **Resource utilization**: The `node-agent` installed on client servers (via Docker/K8s) must be lightweight to not severely impact host workloads.
- **Cost effective**: Storage mechanisms and processing in `master-service` must scale efficiently to keep SaaS unit economics viable.

## Requirements

### Validated
- ✓ **Backend Services Architecture** — Rust workspace (`master-service`, `node-agent`) communicating via gRPC (`tonic`).
- ✓ **Embedded Storage** — `master-service` utilizing `sled` for lightweight fast-path persistent storage.
- ✓ **Client telemetry ingestion** — `node-agent` designed to gather metrics (sysinfo), APM data, logs, and trace spans securely over TLS.
- ✓ **Dashboard Foundation** — Frontend SPA (`dashboard`) using React and Vite, ready to visualize data components.
- ✓ **Unified Dashboard UI** — Datadog-style intuitive UI to seamlessly pivot between traces, metrics, and logs in the same context (v1.0).
- ✓ **Span Waterfall Visualization** — Request waterfalls mapping entire request lifecycles (v1.0).
- ✓ **Docker/K8s Easy Integrations** — Zero-config docker compose scripts for frictionless `node-agent` and platform launches (v1.0).

### Active
- [ ] (Pending next milestone planning)

### Out of Scope
- Complex horizontal-scaling Enterprise ELK clusters — this defeats the "easy" and "cost-effective" constraints. The goal is opinionated simplicity, not infinite configuration.
- Complex third-party OAuth integrations (currently relying on stateless JWTs).

## Context
Shipped v1.0 MVP integrating Rust telemetry pipelines with a React SPA. Total unified observability platform stands at ~340k LOC (including distributions). Phase 44/45 complete — transitioned to 100% Native Datadog-compatible payload transmission and native HTTP/Database instrumentation hooks. Phase 47 complete — implemented bounded buffering, hybrid batching, and sampling for polyglot native agents. Phase 48 complete — integrated precise truncated exception stack trace extraction universally.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **Deployment Model** | Distributed. Opinionated `master-service` (managed SaaS or central node) with lightweight `node-agent` on user infrastructure. | ✓ Validated |
| **Tech Stack** | Rust for backend (performance, safety, memory footprint), React/Vite for Dashboard. | ✓ Validated |
| **Single Container UI** | Axum `ServeDir` embedding Vite static bundle to eliminate NGINX proxies. | ✓ Good |
| **State Persistence** | ClickHouse as OLAP backend for massive trace/log scale. | ✓ Good |

---
*Last updated: 2026-03-26 after Phase 45 complete*
