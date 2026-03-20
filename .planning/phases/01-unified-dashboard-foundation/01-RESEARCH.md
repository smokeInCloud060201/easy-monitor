# Phase 1: Unified Dashboard Foundation - Research

**Researched:** 2026-03-20
**Domain:** React SPA Dashboard with live metrics and log tailing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Dashboard Layout Structure: Side navigation — allows easy addition of trace/alerting pages later.
- Metrics Visualization Library: Recharts — for fast and responsive React integration.
- Log Search Behavior: Live tailing toggle like Graylog/Datadog — fits the "low-effort" observability constraint.
- Global Time Context Sync: URL-based state `?from=X&to=Y` so dashboard views are easily shareable.

### Claude's Discretion
- UI component design details and internal directory structure within the React app.
- Styling system (using standard CSS/Tailwind as configured).

### Deferred Ideas (OUT OF SCOPE)
- None.
</user_constraints>

<research_summary>
## Summary

Researched the implementation of a unified observability dashboard using Vite, React, Recharts, and generic SSE/WebSocket for live log tailing. The standard approach for URL-driven global time state is to use `react-router-dom`'s `useSearchParams` hook to ensure the URL remains the source of truth across all views.

Key finding: Do not use local React state (`useState`) for the global time range. It fragments the context. Rely strictly on `useSearchParams`, and wrap the query parsing into a custom `useTimeRange` hook so all charts and log viewers pull from the exact same URL parameters.

**Primary recommendation:** Use `react-router-dom` for navigation and state sync, `recharts` for metrics, and a virtualized list (like `react-virtuoso` or `react-window`) for the live log tailing to avoid DOM bloat when thousands of logs stream in.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | ^6.20.0 | Routing & URL state | The industry standard for React SPA routing |
| recharts | ^2.12.0 | Metrics visualization | Declarative, reliable, works seamlessly with React |
| react-virtuoso | ^4.7.0 | Log virtualization | Essential for rendering thousands of log lines without crashing the browser |
| lucide-react | ^0.300.0 | Icons | Clean, modern icons for the side navigation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^3.0.0 | Date parsing/formatting | When dealing with complex epoch timestamps in the time picker |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-virtuoso | react-window | `react-virtuoso` handles dynamic row heights (crucial for logs) much better out-of-the-box than `react-window`. |

**Installation:**
```bash
npm install react-router-dom recharts react-virtuoso lucide-react date-fns
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```text
dashboard/src/
├── components/
│   ├── layout/           # Sidebar, Topbar, MainLayout
│   ├── metrics/          # TimeSeriesChart, MetricCard
│   ├── logs/             # LogViewer, LogLine, LiveTailToggle
│   └── shared/           # TimePicker, GlobalSearch
├── hooks/
│   ├── useTimeRange.ts   # Parses URL ?from=&to=
│   └── useLiveLogs.ts    # Manages EventSource/WebSocket connection
├── pages/
│   ├── Dashboard.tsx     # Metrics + Logs unified view
│   └── Logs.tsx          # Dedicated logs view
└── lib/                  # API clients, utils
```

### Pattern 1: URL as State for Time Context
**What:** A custom hook that wraps `useSearchParams` to provide the parsed `from` and `to` timestamps to any component.
**When to use:** Globally across the dashboard.
**Example:**
```typescript
import { useSearchParams } from 'react-router-dom';

export function useTimeRange() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const from = searchParams.get('from') || 'now-1h';
  const to = searchParams.get('to') || 'now';
  
  const setTimeRange = (newFrom: string, newTo: string) => {
    setSearchParams(params => {
      params.set('from', newFrom);
      params.set('to', newTo);
      return params;
    });
  };
  
  return { from, to, setTimeRange };
}
```

### Anti-Patterns to Avoid
- **Keeping time state in Context/Redux without URL sync:** Breaks shareability. Users expect to copy-paste the URL to share an incident time-window.
- **Rendering logs in a standard `div` map:** Rendering >500 log lines in the DOM will heavily lag the browser. Must use virtualization.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time string parsing | Regex math for "now-1h" | Datadog-style time parser or `date-fns` | Edge cases around leap years, timezones, and duration strings. |
| Virtualized Lists | Custom scroll listeners | `react-virtuoso` | Dynamic height calculation for multi-line logs is exceptionally difficult to get right. |
| SVG Charting | Raw paths and scales | `recharts` | Hover states, crosshairs, and responsive sizing take weeks to perfect. |

**Key insight:** Observability tools deal with massive data volume. DOM performance is the primary bottleneck. Rely on battle-tested virtualization and charting libraries.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Live Tailing OOM (Out of Memory)
**What goes wrong:** The browser crashes after tailing logs for 10 minutes.
**Why it happens:** The internal array holding the log objects grows infinitely.
**How to avoid:** Implement a hard cap (e.g., maintain only the latest 5,000 logs in the state array) and drop older ones when tailing is active.
**Warning signs:** Tab consumes >1GB of RAM.

### Pitfall 2: Chart/Log Time Desync
**What goes wrong:** The metric chart shows data for 12:00-13:00, but the logs show data from 11:55-12:55.
**Why it happens:** Components fetch data using "now" independently, creating race conditions in their queries.
**How to avoid:** The URL parser must freeze "now" to absolute epochs when a specific window is initiated, or components must share the exact same query bounds.
</common_pitfalls>

<code_examples>
## Code Examples

### Virtualized Log Viewer
```typescript
import { Virtuoso } from 'react-virtuoso';

export function LogViewer({ logs }) {
  return (
    <Virtuoso
      style={{ height: '100%' }}
      data={logs}
      followOutput="smooth" // Auto-scrolls for live tailing
      itemContent={(index, log) => (
        <div className="font-mono text-sm py-1 border-b border-gray-800">
          <span className="text-gray-500">{log.timestamp}</span>
          <span className={`ml-2 ${log.level === 'error' ? 'text-red-500' : 'text-green-500'}`}>[{log.level}]</span>
          <span className="ml-2 text-gray-300">{log.message}</span>
        </div>
      )}
    />
  );
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling APIs | Server-Sent Events (SSE) or WebSockets | 2020+ | Standard for live observability telemetry. SSE is preferred for unidirectional log streaming. |

**New tools/patterns to consider:**
- **Tailwind Grid:** Perfect for constructing the dense UI of a dashboard compared to old flexbox layouts.
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Backend Integration**
   - What we know: `master-service` exists in Rust.
   - What's unclear: Are the API endpoints currently defined for metric/log queries? Do we rely on REST or gRPC-web?
   - Recommendation: MVP should stick to standard REST/SSE for the frontend queries to keep the Vite setup simple, unless `tonic-web` is already configured.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- React Router DOM Docs - URL state management.
- Recharts Docs - Time-series rendering.
- React Virtuoso Docs - Dynamic height virtualization and `followOutput` auto-scrolling.

### Secondary (MEDIUM confidence)
- Datadog/Graylog UI pattern analysis - Standard industry approaches to observability UX.
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: React, Vite
- Ecosystem: React Router, Recharts, React Virtuoso
- Patterns: URL state sync, virtualization, auto-scrolling
- Pitfalls: Browser OOM, Context desync

**Confidence breakdown:**
- Standard stack: HIGH - Industry standard choices.
- Architecture: HIGH - Proven SPA patterns.
- Pitfalls: HIGH - Known issues with heavy DOM charting.
- Code examples: HIGH - Standard library implementations.

**Research date:** 2026-03-20
**Valid until:** 2026-04-20
</metadata>

---

*Phase: 01-unified-dashboard-foundation*
*Research completed: 2026-03-20*
*Ready for planning: yes*
