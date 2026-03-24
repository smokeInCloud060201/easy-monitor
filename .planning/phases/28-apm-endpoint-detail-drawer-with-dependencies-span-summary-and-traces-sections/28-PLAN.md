---
phase: 28
plan: 01
title: "APM Endpoint Detail Drawer — Dependencies, Span Summary, and Traces"
wave: 1
depends_on: []
files_modified:
  - dashboard/src/components/apm/EndpointDrawer.tsx
  - dashboard/src/components/apm/EndpointsTable.tsx
  - dashboard/src/components/apm/SpanDrawer.tsx
autonomous: true
---

# Plan 01: EndpointDrawer with Dependencies, Span Summary, and Traces

<objective>
Replace the current "click endpoint → open SpanDrawer" flow with a two-level drawer architecture:

1. **Level 1 — EndpointDrawer**: When user clicks an endpoint row, a right-to-left sliding drawer opens showing **endpoint-level details** (not span list). This drawer has 3 collapsible sections:
   - **Dependencies**: Downstream services this endpoint calls (derived from trace data)
   - **Span Summary**: Aggregated span statistics — which operations are called, avg duration, call count, % of total time
   - **Traces**: List of recent traces for this endpoint. Clicking a trace opens Level 2.

2. **Level 2 — SpanDrawer (existing)**: When user clicks a trace from the EndpointDrawer's Traces section, the existing SpanDrawer slides in on top with the full waterfall + span detail panel.

This matches the Datadog UX: endpoint details → drill into trace → see spans.
</objective>

## Tasks

<task id="1">
<title>Create EndpointDrawer component</title>

<read_first>
- dashboard/src/components/apm/SpanDrawer.tsx (portal + drawer pattern, lines 1–14 for Props, lines 150–200 for drawer shell)
- dashboard/src/lib/api.ts (fetchResourceSummary line 386, searchTraces line 392, ServiceSummary/TraceSummary types)
- dashboard/src/components/apm/EndpointsTable.tsx (current flow, lines 75–95 for trace loading)
</read_first>

<action>
Create `dashboard/src/components/apm/EndpointDrawer.tsx`:

**Props:**
```typescript
interface EndpointDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  resource: string;           // e.g. "POST /api/checkout"
  resourceMetrics: ResourceWithMetrics | null;  // passed from parent
}
```

**Layout (portal-rendered, right-to-left slide, 65vw):**
- **Header**: Service name + method badge + endpoint path + close X button
- **Summary bar**: Total requests, error rate, avg latency, P95 (loaded via `fetchResourceSummary`)
- **Body** (scrollable, 3 collapsible sections):

**Section 1 — Dependencies:**
- Compute from loaded trace spans: group child spans by `service` field where service != current service
- Show each downstream dependency as a row: service name, call count, avg duration, error count
- Uses span data from the first few traces (aggregate across all loaded trace spans)

**Section 2 — Span Summary:**
- Aggregate all loaded spans by `name` (operation)
- Show a table: Operation name, Service, Avg Duration, Call Count, % of Total Time
- Sorted by total time descending

**Section 3 — Traces:**
- List of recent traces (loaded via `searchTraces`)
- Each row: trace ID (truncated), timestamp, duration, span count, error badge
- **Clicking a trace sets `selectedTraceId`** which opens the existing SpanDrawer as Level 2

**State:**
- `summary: ServiceSummary | null` — loaded via `fetchResourceSummary(serviceName, resource)`
- `traces: TraceSummary[]` — loaded via `searchTraces({ service, resource, limit: 20 })`
- `allSpans: SpanResponse[]` — loaded by fetching first 5 traces' spans for dependency/summary computation
- `selectedTraceId: string | null` — when set, opens SpanDrawer
- `loadingSummary`, `loadingTraces`, `loadingSpans` booleans
- `collapsedSections: Record<string, boolean>` — tracks collapsed state per section

**SpanDrawer integration:**
- Render `<SpanDrawer>` inside EndpointDrawer with `z-[60]` (higher than EndpointDrawer's `z-50`)
- When SpanDrawer is open, EndpointDrawer remains visible underneath (dimmed)
- SpanDrawer receives traces filtered to just the selected trace
</action>

<acceptance_criteria>
- EndpointDrawer renders as a portal with right-to-left slide animation
- Header shows service + method badge + endpoint path
- Summary bar shows RED metrics for the endpoint
- Dependencies section shows downstream services with call count and avg duration
- Span Summary section shows aggregated operation statistics
- Traces section lists recent traces with clickable rows
- Clicking a trace opens SpanDrawer on top
- Escape key closes SpanDrawer first, then EndpointDrawer
- Body scroll lock when drawer is open
</acceptance_criteria>
</task>

<task id="2">
<title>Refactor EndpointsTable to use EndpointDrawer</title>

<read_first>
- dashboard/src/components/apm/EndpointsTable.tsx (full file)
- dashboard/src/components/apm/EndpointDrawer.tsx (from task 1)
</read_first>

<action>
Modify `EndpointsTable.tsx`:

1. **Replace SpanDrawer import with EndpointDrawer:**
   ```typescript
   import { EndpointDrawer } from './EndpointDrawer';
   ```

2. **Remove trace-loading logic from EndpointsTable:**
   - Remove `traces` state, `loadingTraces` state, and the `useEffect` that calls `searchTraces`
   - These are now handled inside EndpointDrawer

3. **Pass `ResourceWithMetrics` to EndpointDrawer:**
   - Find the matching resource object for `drawerEndpoint` and pass it as `resourceMetrics`
   
4. **Replace SpanDrawer render with EndpointDrawer:**
   ```tsx
   <EndpointDrawer
     isOpen={drawerEndpoint !== null}
     onClose={() => setDrawerEndpoint(null)}
     serviceName={serviceName}
     resource={drawerEndpoint || ''}
     resourceMetrics={resources.find(r => r.resource === drawerEndpoint) || null}
   />
   ```
</action>

<acceptance_criteria>
- EndpointsTable no longer imports SpanDrawer
- EndpointsTable no longer manages trace state
- EndpointsTable renders EndpointDrawer
- Clicking endpoint row opens EndpointDrawer (not SpanDrawer)
- All sorting and metrics display unchanged
</acceptance_criteria>
</task>

<task id="3">
<title>Update SpanDrawer for nested usage</title>

<read_first>
- dashboard/src/components/apm/SpanDrawer.tsx (full file)
</read_first>

<action>
Minor modifications to SpanDrawer to support being rendered inside EndpointDrawer:

1. **Add optional `z-index` prop or use `z-[60]`** to render above the EndpointDrawer
2. **Accept `traces` as optional prop** — when provided, skip the trace list sidebar entirely and go straight to waterfall view
3. **Add `singleTraceMode` prop**: When true, don't show the left trace list sidebar, expand the waterfall table to full width
4. **Keep all existing functionality intact** — the bottom span detail panel, tree builder, etc.
</action>

<acceptance_criteria>
- SpanDrawer can render above EndpointDrawer (higher z-index)
- SpanDrawer supports `singleTraceMode` where trace list sidebar is hidden
- All existing SpanDrawer functionality preserved
</acceptance_criteria>
</task>

## Verification

<verification>
1. Navigate to APM Service Detail page (e.g. `http://localhost:5173/apm/services/checkout-service`)
2. Scroll to Endpoints section
3. Click any endpoint row → EndpointDrawer slides in from right
4. Verify 3 sections visible: Dependencies, Span Summary, Traces
5. Dependencies shows downstream service names with call counts
6. Span Summary shows aggregated operations table
7. Traces section lists recent traces
8. Click a trace → SpanDrawer slides in on top with waterfall
9. Press Escape → SpanDrawer closes, EndpointDrawer stays
10. Press Escape again → EndpointDrawer closes
11. Click backdrop → drawer closes

TypeScript: `cd dashboard && npx tsc --noEmit`
</verification>

<must_haves>
- Two-level drawer architecture: EndpointDrawer → SpanDrawer
- EndpointDrawer has Dependencies, Span Summary, and Traces sections
- Clicking a trace in EndpointDrawer opens SpanDrawer on top
- Escape key respects drawer stacking order
- Portal-rendered with body scroll lock
</must_haves>
