---
phase: 15
plan: 1
title: "Replace Recent Traces with Traces section featuring HTTP request list and inline span details"
wave: 1
depends_on: []
files_modified:
  - dashboard/src/pages/ServiceDetail.tsx
  - dashboard/src/components/apm/TracesSection.tsx
autonomous: true
requirements_addressed: []
---

# Plan 1: APM Traces Section — HTTP Request List with Expandable Span Details

<objective>
Replace the "Recent Traces" section in the APM service detail page (`ServiceDetail.tsx`) with a full "Traces" section that:
1. Shows a list of HTTP requests (traces) hitting the service, with method, resource, status, duration, and timestamp
2. When a user clicks an HTTP request row, it expands inline to show the full span waterfall detail (reusing existing `SpanWaterfall` component)
3. Supports pagination to load more traces beyond the initial batch
</objective>

<tasks>

<task id="1" title="Create TracesSection component">
<read_first>
- dashboard/src/components/traces/SpanWaterfall.tsx
- dashboard/src/lib/api.ts (searchTraces, fetchTrace, TraceSummary, SpanResponse types)
- dashboard/src/pages/ServiceDetail.tsx (current Recent Traces section, lines 199-236)
</read_first>

<action>
Create a new file `dashboard/src/components/apm/TracesSection.tsx` with the following implementation:

**Props interface:**
```typescript
interface TracesSectionProps {
  serviceName: string;
  timeRange: string;
}
```

**State:**
- `traces: TraceSummary[]` — list of trace summaries from `searchTraces`
- `expandedTraceId: string | null` — which trace row is currently expanded
- `expandedSpans: SpanResponse[]` — loaded spans for the expanded trace
- `loading: boolean` — initial load state
- `loadingSpans: boolean` — span detail loading state
- `page: number` — current page for pagination (start at 0)
- `total: number` — total trace count from search response
- `hasMore: boolean` — whether more traces exist

**Data fetching:**
- On mount and when `serviceName` or `timeRange` changes, call `searchTraces({ service: serviceName, limit: 20, offset: 0 })` to populate the trace list
- When a trace row is clicked: if already expanded, collapse it. Otherwise set `expandedTraceId` to that trace's ID and call `fetchTrace(traceId)` to load spans into `expandedSpans`
- "Load More" button at bottom calls `searchTraces` with `offset = traces.length` and appends results

**UI structure:**
1. Section header: Zap icon + "Traces" title (uppercase, matching existing section headers)
2. Trace list table with columns:
   - Status indicator (green dot for success, red for error)
   - Resource name (the `root_name` from TraceSummary, e.g. `GET /api/checkout`)
   - Root service name
   - Span count badge
   - Duration with visual bar (relative to max duration in list)
   - Timestamp (relative, e.g. "2m ago")
3. When expanded: render SpanWaterfall component below the clicked row with a smooth height transition
4. "Load More" button at bottom if `hasMore` is true
5. Empty state: "No traces found for this service." centered message

**Styling:**
- Use `glass-panel p-4 shadow-xl` container (matching existing sections)
- Row hover: `hover:bg-white/5`
- Expanded row background: `bg-white/[0.02]` with left border accent `border-l-2 border-primary`
- Duration bar same style as existing (L222-229 in ServiceDetail.tsx)
- Loading spinner for span details: small spinner next to the expanded row
</action>

<acceptance_criteria>
- File `dashboard/src/components/apm/TracesSection.tsx` exists
- File contains `export function TracesSection`
- File imports `SpanWaterfall` from `../traces/SpanWaterfall`
- File imports `searchTraces` and `fetchTrace` from `../../lib/api`
- Component renders SpanWaterfall when a trace is expanded
- Component has "Load More" button with `offset` pagination
- Component renders status dot, root_name, service, span count, duration bar, and timestamp for each trace
- File contains `expandedTraceId` state variable
</acceptance_criteria>
</task>

<task id="2" title="Replace Recent Traces with TracesSection in ServiceDetail.tsx">
<read_first>
- dashboard/src/pages/ServiceDetail.tsx (full file — especially lines 1-8 imports, lines 22-24 state, lines 34-37 data fetching, lines 199-236 Recent Traces section)
- dashboard/src/components/apm/TracesSection.tsx (newly created)
</read_first>

<action>
Modify `dashboard/src/pages/ServiceDetail.tsx`:

1. **Remove imports no longer needed:**
   - Remove `searchTraces` and `TraceSummary` from the import on line 6 (keep other imports)

2. **Add new import:**
   ```typescript
   import { TracesSection } from '../components/apm/TracesSection';
   ```

3. **Remove trace state:**
   - Remove `const [traces, setTraces] = useState<TraceSummary[]>([]);` (line 24)

4. **Remove trace fetch from useEffect:**
   - Remove `searchTraces({ service: name, limit: 10 }).then(r => r.traces).catch(() => []),` (line 37)
   - Remove `t` from the destructured `.then(([s, r, t, e, ld, d])` — change to `.then(([s, r, e, ld, d])`
   - Remove `setTraces(t);` (line 44)

5. **Replace Section 7 (lines 199-236) entirely with:**
   ```tsx
   {/* ─── SECTION 7: Traces ─── */}
   <TracesSection serviceName={name || ''} timeRange={timeRange} />
   ```

This moves the trace data fetching responsibility entirely to TracesSection, which manages its own state and pagination.
</action>

<acceptance_criteria>
- `ServiceDetail.tsx` does NOT contain `Recent Traces` string
- `ServiceDetail.tsx` does NOT contain `useState<TraceSummary[]>`
- `ServiceDetail.tsx` contains `import { TracesSection }` from `../components/apm/TracesSection`
- `ServiceDetail.tsx` contains `<TracesSection serviceName={name || ''} timeRange={timeRange} />`
- `ServiceDetail.tsx` does NOT contain `searchTraces` import
- `ServiceDetail.tsx` compiles without errors (no unused imports, no missing references)
</acceptance_criteria>
</task>

</tasks>

<verification>

## must_haves (Goal-Backward Verification)
- [ ] "Recent Traces" section replaced with "Traces" section in APM service detail page
- [ ] Traces section shows HTTP request list with resource name, status, duration, span count, timestamp
- [ ] Clicking a trace row expands it inline to show full span waterfall detail
- [ ] Clicking an expanded trace row collapses it
- [ ] SpanWaterfall component reused for span detail rendering
- [ ] Pagination via "Load More" button works
- [ ] Empty state displayed when no traces exist
- [ ] No compilation errors

## Commands
```bash
cd dashboard && npx tsc --noEmit
```

</verification>
