# Requirements: easy-monitor

**Defined:** 2026-03-20
**Core Value:** A unified, low-effort observability platform (Datadog-lite) that brings together metrics, logs, application errors, and trace spans.

## v1 Requirements

### Telemetry Ingestion

- [ ] **INGST-01**: `node-agent` reliably collects and buffers host metrics, logs, and spans.
- [ ] **INGST-02**: `master-service` receives, processes, and stores telemetry data via gRPC.

### Unified Dashboard

- [ ] **DASH-01**: User can view a global time-series chart of host metrics.
- [ ] **DASH-02**: User can search and filter centralized logs.
- [ ] **DASH-03**: User can click a time window to see logs and traces from that exact moment (Unified Context).

### Distributed Tracing

- [ ] **TRAC-01**: User can view a span waterfall chart for a specific request.
- [ ] **TRAC-02**: User can navigate from a trace span directly to the logs generated during that span.

### Deployment

- [ ] **DEPL-01**: User can deploy the `master-service` and `dashboard` via a single `docker-compose up`.
- [ ] **DEPL-02**: User can deploy the `node-agent` to a target host via a simple docker command.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenant SSO | Deferred to v2. Focus is simple self-hosted/lite SaaS. |
| Elasticsearch Backend | Embedded Sled is required for "low-effort" MVP constraint. |
| Machine Learning alerting | Too complex for v1. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INGST-01 | Phase 1 | Pending |
| INGST-02 | Phase 1 | Pending |
| DASH-01 | Phase 1 | Pending |
| DASH-02 | Phase 1 | Pending |
| DASH-03 | Phase 1 | Pending |
| TRAC-01 | Phase 2 | Pending |
| TRAC-02 | Phase 2 | Pending |
| DEPL-01 | Phase 3 | Pending |
| DEPL-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after initial definition*
