# Phase 2: Span Waterfall Visualization - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary
Render complex distributed traces in an intuitive waterfall UI similar to Graylog/Jaeger. Correlate spans to underlying logs.
</domain>

<decisions>
## Implementation Decisions

### 1. Trace Ingestion Format
**Decision:** Custom simple JSON format.
- *Rationale:* Avoids the heavy complexity of full OTLP parsing for the MVP scale.

### 2. Waterfall Rendering Strategy
**Decision:** Custom HTML/CSS Grid implementation.
- *Rationale:* Keeps the dashboard lightweight without pulling in heavy charting libraries like D3.js. Good fit for an MVP.

### 3. Log Correlation Strategy
**Decision:** Exact Match.
- *Rationale:* Strict correlation. Logs must contain the exact `trace_id` to show up in the span detail panel. Ensures accuracy over probabilistic heuristics.
</decisions>
