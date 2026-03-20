# Phase 1: Unified Dashboard Foundation - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Core metric and log visualizations, delivering the foundation of the React SPA.
</domain>

<decisions>
## Implementation Decisions

### Dashboard Layout Structure
- Side navigation — allows easy addition of trace/alerting pages later.

### Metrics Visualization Library
- Recharts — for fast and responsive React integration.

### Log Search Behavior
- Live tailing toggle like Graylog/Datadog — fits the "low-effort" observability constraint.

### Global Time Context Sync
- URL-based state `?from=X&to=Y` so dashboard views are easily shareable.

### Claude's Discretion
- UI component design details and internal directory structure within the React app.
- Styling system (using standard CSS/Tailwind as configured).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and Stack
- `../../research/ARCHITECTURE.md` — Explains the component responsibilities and data flow.
- `../../research/STACK.md` — Summarizes the technology selection (React/Vite).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None established yet (React app is completely freshly initialized).

### Established Patterns
- Vite + React frontend initialized in `dashboard/`.

### Integration Points
- `dashboard/src/App.tsx` and `dashboard/src/main.tsx` are the application roots.
</code_context>

<specifics>
## Specific Ideas

- The live log tailing UX should function similarly to Graylog/Datadog.
- URL query parameters MUST be the source of truth for the global time context filter across the entire SPA.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 01-unified-dashboard-foundation*
*Context gathered: 2026-03-20*
