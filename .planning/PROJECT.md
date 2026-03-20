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

### Active
- [ ] **Unified Dashboard UI** — Complete the Datadog-style intuitive UI to seamlessly pivot between traces, metrics, and logs in the same context.
- [ ] **Span Waterfall Visualization** — Implement request waterfalls (similar to Graylog tracing) mapping entire request lifecycles.
- [ ] **Docker/K8s Easy Integrations** — Build zero-config helm charts / docker compose scripts so users can trivially launch the `node-agent` beside their workloads.

### Out of Scope
- Complex horizontal-scaling Enterprise ELK clusters — this defeats the "easy" and "cost-effective" constraints. The goal is opinionated simplicity, not infinite configuration.
- Complex third-party OAuth integrations (currently relying on stateless JWTs).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **Deployment Model** | Distributed. Opinionated `master-service` (managed SaaS or central node) with lightweight `node-agent` on user infrastructure. | — Pending |
| **Tech Stack** | Rust for backend (performance, safety, memory footprint), React/Vite for Dashboard. | — Validated |

---
*Last updated: 2026-03-20 after initialization*
