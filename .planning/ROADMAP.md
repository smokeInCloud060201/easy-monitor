# Roadmap: easy-monitor

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-03-20)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-03-20</summary>

- [x] Phase 1: Unified Dashboard Foundation (3/3 plans) — completed 2026-03-20
- [x] Phase 2: Span Waterfall Visualization (2/2 plans) — completed 2026-03-20
- [x] Phase 3: Zero-Config Deployment Engineering (2/2 plans) — completed 2026-03-20

</details>

## Progress

**Execution Order:**
Phases execute in numeric order.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Unified Dashboard Foundation | v1.0 | 3/3 | Complete | 2026-03-20 |
| 2. Span Waterfall Visualization | v1.0 | 2/2 | Complete | 2026-03-20 |
| 3. Zero-Config Deployment Engineering | v1.0 | 2/2 | Complete | 2026-03-20 |


### Phase 4: Add authentication feature

**Goal:** Replace hardcoded login stub with real authentication — credential validation, secure JWT, login UI, session management, role-based access, and admin user management panel.
**Requirements**: TBD
**Depends on:** Phase 3
**Plans:** 3 plans

Plans:
- [ ] Plan 1: Backend Authentication Foundation (Wave 1)
- [ ] Plan 2: Dashboard Authentication Frontend (Wave 2)
- [ ] Plan 3: Admin User Management Panel (Wave 3)



### Phase 5: Add services map

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 4
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 5 to break down)

### Phase 6: Add APM feature same as Datadog

**Goal:** Full Datadog-style APM with time-series RED metrics, service/resource drill-down pages, trace search with filters, and enhanced trace detail with span metadata — replacing mock backends with real ClickHouse queries.
**Requirements**: TBD
**Depends on:** Phase 5
**Plans:** 3 plans

Plans:
- [ ] Plan 1: APM Backend Foundation — Time-Series RED & Real Trace Queries (Wave 1)
- [ ] Plan 2: APM Frontend — Service Detail & Resource Drill-Down Pages (Wave 2)
- [ ] Plan 3: APM Trace Search & Error Tracking (Wave 2)

### Phase 7: Enhance mock app with realistic multi-step request flows for span waterfall testing

**Goal:** Enrich mock app services with manual child spans (DB queries, cache lookups, validation, fraud checks) to produce 8-12 span traces for rich waterfall visualization. Fix port conflict, add new endpoints for resource variety.
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 1 plan

Plans:
- [ ] Plan 1: Enrich Mock App with Deep Multi-Step Request Flows (Wave 1)

### Phase 8: Logs feature — GrayLog-style UI and metadata

**Goal:** Full GrayLog-style log exploration — rich metadata pipeline, timeline histogram, field statistics sidebar, expandable log detail with all metadata, and field-based filtering. Replace minimal log viewer with production-grade log analysis UX.
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 2 plans

Plans:
- [ ] Plan 1: Logs Backend — Rich Metadata API & ClickHouse Schema Enhancement (Wave 1)
- [ ] Plan 2: Logs Dashboard — GrayLog-Style UI with Histogram, Fields Sidebar & Expandable Detail (Wave 2)


### Phase 9: Feature service map — same as DataDog

**Goal:** DataDog-style interactive service topology map — derive inter-service edges from trace parent-child spans, render as a graph with health-ringed nodes (RED metrics), directional edges showing traffic flow, clickable node detail panel, and auto-layout with zoom/pan.
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 2 plans

Plans:
- [ ] Plan 1: Service Map Backend — Topology API with Edge Detection from Traces (Wave 1)
- [ ] Plan 2: Service Map Dashboard — Interactive Topology Graph with Health Indicators (Wave 2)


### Phase 10: Update APM page — Modern Datadog-style multi-section service monitoring dashboard

**Goal:** Complete rebuild of the APM service detail page with 7 Datadog-style sections: service health overview (5 metric cards), latency distribution histogram with percentile markers, requests & errors time-series, error tracking with top errors list, sortable endpoints/resources table, dependency mini-map (upstream → service → downstream), and recent traces. New backend endpoints for latency distribution and service dependencies.
**Requirements**: TBD
**Depends on:** Phase 9
**Plans:** 0/2 plans executed

Plans:
- [ ] Plan 1: APM Backend Enhancements — Latency Distribution & Service Dependencies API (Wave 1)
- [ ] Plan 2: Modern APM Dashboard — Datadog-style Multi-Section Service Page (Wave 2)


### Phase 11: Update dashboard UI — Datadog-style design system (colors, theme, typography, layout, components)

**Goal:** Overhaul the dashboard design system to match Datadog: purple brand palette (#632CA6), Inter/JetBrains Mono typography via Google Fonts, refined dark backgrounds, grouped sidebar navigation with purple accents, glass-panel component variants, and consistent page-level styling across all views.
**Requirements**: TBD
**Depends on:** Phase 10
**Plans:** 0/2 plans executed

Plans:
- [ ] Plan 1: Design System Foundation — Colors, Typography, Tailwind Tokens & CSS Variables (Wave 1)
- [ ] Plan 2: UI Component Overhaul — Sidebar, Layout, Headers, and Page Refinements (Wave 2)


### Phase 12: Fix logs query parser — structured search syntax support

**Goal:** Fix logs search bar to support structured query syntax (`service:X AND message:"Y"`). Add frontend query parser that decomposes structured queries into individual API filter fields, extend backend to support additional filter columns (`host`, `source`, `namespace`, `node_name`).
**Requirements**: TBD
**Depends on:** Phase 11
**Plans:** 1 plan

Plans:
- [ ] Plan 1: Structured Query Parser & Backend Filter Extensions (Wave 1)

### Phase 13: Sanitize sensitive data in trace span resource names

**Goal:** Replace dynamic tokens (numeric IDs, UUIDs, hex strings, transaction IDs) in span resource names with `?` at ingestion time. Prevents high-cardinality RED metric keys and hides sensitive data in the traces UI.
**Requirements**: TBD
**Depends on:** Phase 12
**Plans:** 1 plan

Plans:
- [ ] Plan 1: Resource Name Sanitization at Ingestion (Wave 1)

### Phase 14: Filter out internal service logs and traces (master-service, node-agent)

**Goal:** Drop logs and traces from internal infrastructure services (master-service, node-agent) at the gRPC ingress layer before they enter the event bus, preventing them from appearing in the dashboard.
**Requirements**: TBD
**Depends on:** Phase 13
**Plans:** 1 plan

Plans:
- [ ] Plan 1: Filter Internal Services at Ingress (Wave 1)

### Phase 15: APM Traces section - replace Recent Traces with HTTP request list and span detail view

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 14
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 15 to break down)

### Phase 16: Fix service map empty and APM list missing services (orderservice, categoryservice, notification-service)

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 15
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 16 to break down)

### Phase 17: Rebuild mock-app as polyglot microservices — Spring Boot (checkout), Go (category), Bun (payment), Rust (notification) with full checkout flow and OTLP tracing

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 16
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 17 to break down)

### Phase 18: Feature: Create easymonitor-apm-java Spring Boot Starter library

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 17
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 18 to break down)

### Phase 19: Enhance easymonitor APM to function as a true Datadog-like Java Agent with comprehensive tracing, metrics, and log correlation

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 18
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 19 to break down)

### Phase 20: Create centralized agents module for Java, Node, Go, and Rust

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 19
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 20 to break down)

### Phase 21: Refactor agents to support true zero-code Datadog-style pure injection removing application OTel dependencies

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 20
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 21 to break down)

### Phase 22: Refactor APM trace span names to show structured API paths like Datadog

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 21
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 22 to break down)

### Phase 23: Refactor mock-app to DDD architecture with PostgreSQL and Redis connections

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 22
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 23 to break down)

### Phase 24: Datadog Style Trace Name Synthesis

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 23
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 24 to break down)
