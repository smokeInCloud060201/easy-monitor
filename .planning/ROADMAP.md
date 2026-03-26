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

### Phase 25: Distributed e-commerce architecture covering 5 new microservices, Saga orchestration, and Redis PubSub async queues

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 24
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 25 to break down)

### Phase 26: Replace SAGA with RESTful in mock-app

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 25
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 26 to break down)

### Phase 27: Enhance APM service endpoint UI with Datadog-style sliding span list

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 26
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 27 to break down)

### Phase 28: APM endpoint detail drawer with dependencies, span summary, and traces sections

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 27
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 28 to break down)

### Phase 29: Add pagination to logs page with 100 records per page

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 28
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 29 to break down)

### Phase 30: Node agent Kafka-style batch sending — flush after 5s or 100 records to reduce IO overhead

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 29
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 30 to break down)

### Phase 31: CQRS pattern for master service with high-write DB

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 30
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 31 to break down)

### Phase 32: Database infrastructure monitoring — PostgreSQL, Redis, and extensible to other database types (MySQL, MongoDB, etc.)

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 31
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 32 to break down)

### Phase 33: Dashboard performance review

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 32
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 33 to break down)

### Phase 34: APM error rate consistency - count 4xx/5xx HTTP status as errors across all APIs

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 33
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 34 to break down)

### Phase 35: Consum all logs from service keeping origin message

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 34
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 35 to break down)

### Phase 36: Logs page: delete fields menu, just show logs message and search input. Follow Graylog search syntax (key:"value" AND OR)

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 35
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 36 to break down)

### Phase 37: Now the logs will send with GELF, the agent agents will handle it and send to node-agent

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 36
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 37 to break down)

### Phase 38: Menubar UI improve, the menu bar in the left screen will have 2 mode: Full and short, with full mode will show the full menu icon + text, in short mdoe just show icon only, move the login button from header right to menu bar bottom side

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 37
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 38 to break down)

### Phase 39: Update Dashboard to use tailwindcss instead inner style

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 38
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 39 to break down)

### Phase 40: Fix React frontend ESLint errors and strict mode compliance

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 39
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 40 to break down)

### Phase 41: Logs page - inline row expansion instead of popup

**Goal:** Modify the logs viewer so that clicking a log row expands its details inline beneath the row rather than opening a popup/sidebar panel.
**Requirements**: TBD
**Depends on:** Phase 40
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 41 to break down)

### Phase 42: In the logs page, I want to improve the UI for logs details, when click the message line, dont show the popup for message details, we should expand the message logs details instead

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 41
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 42 to break down)

### Phase 43: Since now I feel the dashboard UI color is too hard to see, can reference Datadog UI color theme to update our application UI

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 42
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 43 to break down)

### Phase 44: Update Easy Monitor Agent Core Functional Specification

**Goal:** Establish the Core Functional Specification and implement the foundational Data Structures and HTTP MessagePack Transport layer across all 4 polyglot agents (Go, Java, Node, Rust).
**Requirements**: TBD
**Depends on:** Phase 43
**Plans:** 2 plans executed

Plans:
- [x] Plan 1: Node Agent MessagePack Trace Receiver and Roadmap Evolution
- [x] Plan 2: Polyglot Agents Data Structures and Transport

### Phase 45: Agent Native Instrumentation Modules
**Goal:** Implement native library and framework hooks (Java Agent/ByteBuddy, Node async_hooks, Go/Rust manual integrations).
**Requirements**: TBD
**Depends on:** Phase 44
**Plans:** 4/4 plans complete
Plans:
- [x] TBD (run /gsd-plan-phase 45 to break down) (completed 2026-03-26)

### Phase 46: Agent Trace Generation & Context Propagation
**Goal:** Implement Span lifecycle management and distributed tracing header propagation (e.g., x-easymonitor-trace-id).
**Requirements**: TBD
**Depends on:** Phase 45
**Plans:** 0/4 plans complete
Plans:
- [x] TBD (run /gsd-plan-phase 46 to break down) (completed 2026-03-26)

### Phase 47: Agent Buffering, Batching & Sampling Modules
**Goal:** Optimize trace transmission via memory buffering, batching into MessagePack payloads, and priority sampling.
**Requirements**: TBD
**Depends on:** Phase 46
**Plans:** 2/2 plans complete
Plans:
- [x] TBD (run /gsd-plan-phase 47 to break down) (completed 2026-03-26)

### Phase 48: Agent Metrics Aggregation & Error Collection
**Goal:** Aggregate local RED metrics and accurately capture exception types and stack traces attached to spans.
**Requirements**: TBD
**Depends on:** Phase 47
**Plans:** 2/2 plans complete
Plans:
- [x] TBD (run /gsd-plan-phase 48 to break down) (completed 2026-03-26)

### Phase 49: Agent Database & External Service Monitoring
**Goal:** Hook into popular database drivers and HTTP clients to automatically trace database queries and external RPCs.
**Requirements**: TBD
**Depends on:** Phase 48
**Plans:** 2/2 plans complete
Plans:
- [x] TBD (run /gsd-plan-phase 49 to break down) (completed 2026-03-26)

### Phase 50: Agent Metadata Enrichment & Correlation
**Goal:** Tag spans with environment metadata (host, service, version) and inject trace IDs into application logs.
**Requirements**: TBD
**Depends on:** Phase 49
**Plans:** 0/2 plans complete
Plans:
- [x] TBD (run /gsd-plan-phase 50 to break down) (completed 2026-03-26)

### Phase 51: Service Mapping & Topology Generation
**Goal:** Map inter-service dependencies dynamically based on incoming trace edges in the Node agent backend.
**Requirements**: TBD
**Depends on:** Phase 50
**Plans:** 0/1 plans complete
Plans:
- [x] TBD (run /gsd-plan-phase 51 to break down) (completed 2026-03-26)

### Phase 52: Agent Runtime Profiling (Optional)
**Goal:** Continuously profile CPU/Memory and associate with application endpoints.
**Requirements**: TBD
**Depends on:** Phase 51
**Plans:** 0/2 plans complete
Plans:
- [x] TBD (run /gsd-plan-phase 52 to break down) (completed 2026-03-26)

### Phase 53: Update node-agent and master-service for agent infrastructure changes

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 52
**Plans:** 0/3 plans complete

Plans:
- [x] TBD (run /gsd-plan-phase 53 to break down) (completed 2026-03-26)
