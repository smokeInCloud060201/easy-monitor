# Roadmap: easy-monitor

## Overview

Building a Datadog-lite observability platform from foundational telemetry ingestion through unified visualization and ending with frictionless deployment packages.

## Phases

- [x] **Phase 1: Unified Dashboard Foundation** - Core metric and log visualization. (completed 2026-03-20)
- [x] **Phase 2: Span Waterfall Visualization** - Distributed trace rendering and log correlation. (completed 2026-03-20)
- [ ] **Phase 3: Zero-Config Deployment Engineering** - Docker Compose and agent distribution.

## Phase Details

### Phase 1: Unified Dashboard Foundation
**Goal**: Deliver the core React SPA wiring, metric charts, and log viewer integration on top of existing backend ingestion.
**Depends on**: Nothing (first phase)
**Requirements**: [INGST-01, INGST-02, DASH-01, DASH-02, DASH-03]
**Success Criteria**:
  1. User can load the dashboard and see live host metrics charts.
  2. User can search through ingested logs in a real-time table.
  3. Clicking a specific time window on a chart globally filters the logs block.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Establish Dashboard layout, routing, and API clients
- [ ] 01-02: Implement Metrics time-series charts component
- [ ] 01-03: Implement Log searchable data table and global time context

### Phase 2: Span Waterfall Visualization
**Goal**: Render complex distributed traces in an intuitive waterfall UI similar to Graylog/Jaeger.
**Depends on**: Phase 1
**Requirements**: [TRAC-01, TRAC-02]
**Success Criteria**:
  1. User sees a hierarchical tree of a request's lifecycle.
  2. User can click a specific span in the waterfall to view correlated logs.
**Plans**: 2 plans

Plans:
- [ ] 02-01: Build the trace ingestion and API query paths in master-service
- [ ] 02-02: Implement D3/Canvas or advanced nested rendering for the Waterfall UI

### Phase 3: Zero-Config Deployment Engineering
**Goal**: Make the MVP universally accessible to users via Docker.
**Depends on**: Phase 2
**Requirements**: [DEPL-01, DEPL-02]
**Success Criteria**:
  1. `docker-compose up` cleanly boots master-service and dashboard.
  2. Starting `node-agent` docker image immediately registers it in the dashboard.
**Plans**: 2 plans

Plans:
- [ ] 03-01: Containerize master-service, dashboard, and write compose file
- [ ] 03-02: Containerize node-agent and document usage

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Unified Dashboard Foundation | 0/3 | Complete    | 2026-03-20 |
| 2. Span Waterfall Visualization | 0/2 | Complete    | 2026-03-20 |
| 3. Zero-Config Deployment Engineering | 0/2 | Not started | - |
