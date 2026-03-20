# Pitfalls Research

**Domain:** Observability Platform (Logs, Metrics, Traces)
**Researched:** 2026-03-20
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Unbounded Agent Resource Consumption

**What goes wrong:**
The `node-agent` installed on a user's machine consumes 100% CPU or exhausts RAM, causing the user's primary business application to crash.

**Why it happens:**
Inefficient log parsing loops, unbounded internal channel queues, or trying to buffer infinite amounts of data if the network goes down.

**How to avoid:**
Hard caps on memory usage in the agent. Drop telemetry data if queues are full (sacrificing observability for host safety).

**Warning signs:**
Users reporting "easy-monitor killed my server."

**Phase to address:**
Agent Core implementation / Node Agent MVP phase.

---

### Pitfall 2: Contextless Tracing (Broken Waterfalls)

**What goes wrong:**
Logs and trace spans arrive at the backend, but the dashboard cannot link them together. The span waterfall appears broken into hundreds of disjointed root spans.

**Why it happens:**
Improper propagation of `trace_id` and `span_id` headers across RPCs/HTTP calls in the instrumented application. 

**How to avoid:**
Use strict OpenTelemetry propagation standards.

**Warning signs:**
Dashboard shows traces with only 1 span deep, or logs exist without trace links.

**Phase to address:**
Trace Data Ingestion & Dashboard Waterfall UI phase.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Relying solely on `sled` | No database cluster to manage | Impossible to scale horizontally to petabytes. | Acceptable for MVP and "lite" deployments. Must migrate to ClickHouse for Enterprise SaaS. |
| In-memory aggregation | Fast queries | Data loss on master restart | Only for transient counters (e.g. active connections), not historical traces. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Indexing every field | OOM or disk full in `master-service` | Only index specific tags (host, service, level). Leave log body as full-text unindexed or basic regex scan. | >100GB of log data. |

## "Looks Done But Isn't" Checklist

- [ ] **Span Waterfall UI:** Often missing the timeline sync (making sure children spans visually align with parent time bounds) — verify by loading a complex 50-span trace.
- [ ] **Docker Deployment:** Often missing proper mount configurations for host-level metrics (e.g., `/proc` mounts for `sysinfo` to work inside docker) — verify by deploying agent via docker on a test VM.

---
*Pitfalls research for: Observability Platform (Logs, Metrics, Traces)*
*Researched: 2026-03-20*
