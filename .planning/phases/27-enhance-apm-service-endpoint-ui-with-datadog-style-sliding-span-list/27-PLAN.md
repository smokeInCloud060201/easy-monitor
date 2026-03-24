---
phase: 27
plan: 01
title: "Enhance APM Endpoint UI — Sliding Span Panel with Datadog-style Waterfall Table"
wave: 1
depends_on: []
files_modified:
  - dashboard/src/components/apm/EndpointsTable.tsx
  - dashboard/src/components/apm/SpanDrawer.tsx
  - dashboard/src/pages/ServiceDetail.tsx
autonomous: true
---

# Plan 01: Sliding Span Panel with Datadog-style Waterfall Table

<objective>
Replace the current inline dropdown-based span list inside `EndpointsTable.tsx` with a full-screen right-side sliding drawer panel (`SpanDrawer.tsx`). When a user clicks an endpoint row, the drawer slides in from the right edge of the viewport and displays:

1. A header showing the selected trace summary (trace ID, duration, span count, timestamp)
2. A table-based waterfall view matching Datadog's layout with columns: **Service / Operation**, **Duration**, **Exec Time**, **% Exec Time**
3. Tree-indented rows with service color dots, collapsible parent-child nesting, and a duration bar visualization
4. The drawer covers ~60% of the screen width and has a smooth CSS animation sliding from right to left
5. An overlay/backdrop that when clicked closes the drawer
</objective>

## Tasks

<task id="1">
<title>Create SpanDrawer component</title>

<read_first>
- dashboard/src/components/apm/EndpointsTable.tsx (current span display logic lines 244–289, tree depth function lines 308–320)
- dashboard/src/components/traces/SpanWaterfall.tsx (existing tree builder `buildSpanTree` and `flattenTree` functions lines 15–54)
- dashboard/src/lib/api.ts (SpanResponse interface line 281–291, fetchTrace function line 293–306, searchTraces function lines 391–406, TraceSummary interface lines 338–346)
</read_first>

<action>
Create a new file `dashboard/src/components/apm/SpanDrawer.tsx` with the following implementation:

**Props interface:**
```typescript
interface SpanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  resource: string;   // the endpoint name, e.g. "GET /api/product/{id}"
  traces: TraceSummary[];
  loadingTraces: boolean;
}
```

**Component structure:**
1. Fixed-position overlay div covering the full viewport with `bg-black/50` and `onClick={onClose}`
2. Inner drawer panel: `fixed top-0 right-0 h-full w-[65vw] bg-gray-950 border-l border-gray-800 shadow-2xl z-50`
3. CSS transition: use `transform translateX(100%)` when closed, `translateX(0)` when open, with `transition-transform duration-300 ease-in-out`

**Drawer content layout:**
- **Header bar** (sticky top): Shows the endpoint name with method badge (reuse `methodColors` from EndpointsTable), a close X button (lucide `X` icon), and the service name
- **Trace list** (left 30% of drawer width, scrollable): A vertical list of recent traces for this endpoint. Each row shows: trace ID (truncated), timestamp, duration, span count, error badge. Clicking a trace loads its spans.
- **Span waterfall table** (right 70% of drawer width): A Datadog-style table with the following column headers:

| Column | Width | Alignment |
|--------|-------|-----------|
| Service / Operation | flex-1 | left |
| Duration | 90px | right |
| Exec Time | 90px | right |
| % Exec Time | 100px | right |

**Span row rendering:**
- Reuse `buildSpanTree` and `flattenTree` from SpanWaterfall.tsx (copy the functions locally or import)
- Each row indented by `depth * 20px` left padding
- Service color dot (2x2 rounded-full) using the hash-based color function from SpanWaterfall.tsx
- Operation name truncated with `truncate` class
- Duration column: show `formatDuration()` of `span.duration_ms`
- Exec Time column: calculate as `span.duration_ms - sum(children.duration_ms)`, floor at 0
- % Exec Time column: calculate as `(exec_time / root_span.duration_ms) * 100`, display as `X.XX%` or `<0.1%` when below 0.1

**State management inside SpanDrawer:**
- `selectedTraceId: string | null` — tracks which trace from the list is currently loaded
- `spans: SpanResponse[]` — loaded via `fetchTrace(selectedTraceId)`
- `loadingSpans: boolean`
- Auto-select the first trace when `traces` prop changes
</action>

<acceptance_criteria>
- File `dashboard/src/components/apm/SpanDrawer.tsx` exists
- Component exports `SpanDrawer` as named export
- SpanDrawer renders a fixed-position overlay when `isOpen` is true
- Drawer width is approximately 65vw
- Drawer has CSS transition with `duration-300`
- Table headers contain exact text: "Service / Operation", "Duration", "Exec Time", "% Exec Time"
- Span rows are indented based on tree depth
- Exec Time is calculated as span duration minus sum of direct children durations
- % Exec Time is calculated relative to root span duration
- Clicking the overlay backdrop calls `onClose`
- Clicking the X button calls `onClose`
</acceptance_criteria>
</task>

<task id="2">
<title>Refactor EndpointsTable to use SpanDrawer instead of inline dropdown</title>

<read_first>
- dashboard/src/components/apm/EndpointsTable.tsx (full file, especially lines 62–305)
- dashboard/src/components/apm/SpanDrawer.tsx (the new component from task 1)
</read_first>

<action>
Modify `dashboard/src/components/apm/EndpointsTable.tsx`:

1. **Remove all inline span expansion logic:**
   - Remove state: `selectedTraceSpans`, `selectedTraceId`, `loadingSpans`
   - Remove the entire `useEffect` for loading span details (lines 102–109)
   - Remove all JSX inside `{isExpanded && (...)}` block (lines 202–295) — replace with nothing (the endpoint row no longer expands inline)

2. **Replace `expandedEndpoint` with `drawerEndpoint`:**
   - Rename state `expandedEndpoint` to `drawerEndpoint: string | null`
   - When an endpoint row is clicked, set `drawerEndpoint` to the resource name (instead of toggling expansion)
   - Keep the `useEffect` that calls `searchTraces` but trigger it based on `drawerEndpoint` instead of `expandedEndpoint`

3. **Render SpanDrawer at the bottom of the component:**
   ```tsx
   import { SpanDrawer } from './SpanDrawer';
   
   // ... at the end of the return, after the </table>:
   <SpanDrawer
     isOpen={drawerEndpoint !== null}
     onClose={() => setDrawerEndpoint(null)}
     serviceName={serviceName}
     resource={drawerEndpoint || ''}
     traces={traces}
     loadingTraces={loadingTraces}
   />
   ```

4. **Remove the chevron rotation animation** — the endpoint row should no longer show expanded/collapsed state. Instead, highlight the row with `bg-primary/10` when its drawer is open.

5. **Keep all sorting logic, method badge rendering, and metrics columns unchanged.**
</action>

<acceptance_criteria>
- EndpointsTable.tsx no longer contains `selectedTraceSpans` or `selectedTraceId` state variables
- EndpointsTable.tsx no longer contains inline JSX for span display (no `getSpanDepth` usage inside the table)
- EndpointsTable.tsx imports and renders `SpanDrawer`
- Clicking an endpoint row opens the SpanDrawer (sets `drawerEndpoint`)
- Clicking the same endpoint row or the drawer close button closes the drawer (sets `drawerEndpoint` to null)
- The `getSpanDepth` function at the bottom of the file can be removed (it's now in SpanDrawer)
- All endpoint table sorting and metrics display still works unchanged
</acceptance_criteria>
</task>

<task id="3">
<title>Add portal mount point and ensure drawer renders above all content</title>

<read_first>
- dashboard/src/pages/ServiceDetail.tsx (parent page that renders EndpointsTable at line 185)
- dashboard/src/App.tsx or equivalent root layout file
</read_first>

<action>
1. Use React `createPortal` in SpanDrawer to render the overlay and drawer panel into `document.body`, ensuring it overlays the entire viewport regardless of parent overflow or stacking context.

2. Add `overflow-hidden` to `document.body` when drawer is open (prevent background scroll):
   ```tsx
   useEffect(() => {
     if (isOpen) {
       document.body.style.overflow = 'hidden';
     } else {
       document.body.style.overflow = '';
     }
     return () => { document.body.style.overflow = ''; };
   }, [isOpen]);
   ```

3. Ensure the drawer has `z-50` and the overlay has `z-40` to stack correctly above the dashboard navigation.

4. Add keyboard support: pressing `Escape` closes the drawer via `onClose`.
</action>

<acceptance_criteria>
- SpanDrawer uses `createPortal` from react-dom
- Background page scroll is prevented when drawer is open
- Pressing Escape key closes the drawer
- Drawer renders above all page content including the sidebar navigation
</acceptance_criteria>
</task>

## Verification

<verification>
1. Navigate to the APM Service Detail page for any service (e.g. `payment-service`)
2. The Endpoints section shows the same sortable table as before
3. Clicking any endpoint row opens a drawer sliding in from the right
4. The drawer shows a list of recent traces on the left and a Datadog-style span table on the right
5. The span table has columns: Service / Operation, Duration, Exec Time, % Exec Time
6. Spans are properly tree-indented with service color dots
7. Clicking the backdrop or X button or pressing Escape closes the drawer
8. No inline dropdown expansion remains in the endpoint table
</verification>

<must_haves>
- Drawer slides from right to left with smooth CSS animation
- Span table matches Datadog layout: tree-indented rows with 4 data columns
- Exec Time calculated as self-time (span duration minus children)
- % Exec Time calculated relative to root span
- No inline dropdown expansion in endpoint table
- Portal-rendered overlay prevents background scroll
</must_haves>
