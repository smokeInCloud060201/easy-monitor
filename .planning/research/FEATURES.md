# Feature Research

**Domain:** Observability Platform (Logs, Metrics, Traces)
**Researched:** 2026-03-20
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Standard Metrics | Need to know CPU, RAM, Disk usage | LOW | `sysinfo` already provides this via the node-agent. |
| Centralized Logs | Need to search logs without SSHing into machines | MEDIUM | Requires good ingestion pipeline and UI virtual scrolling for large logs. |
| Distributed Tracing | Modern microservices are impossible to debug without seeing request spans | HIGH | Requires instrumenting user code or intercepting network frames to map parent-child spans. |
| Time-based filtering | All observability data is inherently time-series | MEDIUM | Global time-picker in the dashboard that syncs across logs, metrics, and traces. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified Context (Datadog-style) | Jump instantly from a metric spike to the exact log/trace at that second. | HIGH | Requires tight data schema correlation (e.g. `trace_id` attached to logs). |
| Zero-Config Agent | "Just run this docker command" installation | MEDIUM | Low friction onboarding is the core value proposition. |
| Span Waterfall Visualization | Clear visual breakdown of where time is spent in a request | HIGH | The UI must render complex nested trees intuitively (like Graylog/Jaeger). |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Infinite Log Retention | "We need to keep everything forever" | Blows up embedded storage and costs | Hot/Cold storage tiers or aggressive sampling/rolling logs limit. |
| High-cardinality custom metrics without limits | "Track every distinct user ID as a tag" | Destroys index performance and memory | Metric aggregation at the agent level or pre-defined tag limits. |

## Feature Dependencies

```
[Agent Deployment]
    └──requires──> [Metrics/Log Receiver (Master)]
                       └──requires──> [Storage Engine]
                       └──requires──> [Unified Dashboard]

[Span Waterfall UI] ──requires──> [Trace Ingestion Pipeline]
```

### Dependency Notes

- **[Unified Dashboard] requires [Storage Engine]:** Needs a fast way to query the unified context.
- **[Span Waterfall UI] requires [Trace Ingestion Pipeline]:** Cannot render spans that aren't properly correlated and stored by the backend.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [x] Backend Agent & Receiver Architecture — The plumbing must work securely.
- [ ] Unified Context Dashboard — Global time picker, basic metrics charts, and searchable log viewer.
- [ ] Span Waterfall Visualization — The ability to drill down into a request trace.
- [ ] Docker Compose Onboarding — Trivial to start.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Alerting & Notifications — Send alerts to Slack/Email when thresholds are breached.
- [ ] Advanced Log Parsing — Extracting JSON fields automatically.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Multi-tenant SaaS — Managing arbitrary external organizations securely.
- [ ] Machine Learning Anomaly Detection — Too complex for MVP.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Unified Context UI | HIGH | HIGH | P1 |
| Span Waterfall UI | HIGH | HIGH | P1 |
| Docker Compose Onboarding | HIGH | LOW | P1 |
| Alerting Engine | MEDIUM | MEDIUM | P2 |
| Machine Learning Anomalies | LOW | HIGH | P3 |

## Sources

- Direct user requirements (Datadog/Graylog hybrid).
- OpenTelemetry specification (Traces/Spans standards).

---
*Feature research for: Observability Platform (Logs, Metrics, Traces)*
*Researched: 2026-03-20*
