---
phase: "02"
plan: "02-02"
subsystem: "dashboard"
tags: ["waterfall", "rendering", "traces"]
requires: ["02-01"]
provides: ["dashboard/traces", "dashboard/waterfall"]
affects: ["dashboard/src/lib/api.ts", "dashboard/src/components/traces/SpanWaterfall.tsx", "dashboard/src/pages/TraceDetail.tsx", "dashboard/src/App.tsx", "dashboard/src/components/logs/LogViewer.tsx"]
duration: "4 min"
completed: "2026-03-20T12:45:00Z"
requirements-completed: [TRAC-01, TRAC-02]
key-decisions:
  - "Built custom SpanWaterfall component using recursive tree generation and CSS absolute positioning for performance."
  - "Wrapped LogViewer trace_id strings in `react-router-dom` Links to bridge Logs and Traces."
key-files.created:
  - dashboard/src/components/traces/SpanWaterfall.tsx
  - dashboard/src/pages/TraceDetail.tsx
key-files.modified:
  - dashboard/src/lib/api.ts
  - dashboard/src/App.tsx
  - dashboard/src/components/logs/LogViewer.tsx
tech-stack.added: []
---

# Phase 02 Plan 02-02: Implement D3/Canvas or advanced nested rendering for the Waterfall UI Summary

Created an intuitive, lightweight structural waterfall view for distributed traces using standard React rendering techniques.

## Execution Details

- Updated `api.ts` with `SpanResponse` struct and `fetchTrace` API client.
- Built a recursive algorithm in `SpanWaterfall.tsx` to map flat arrays of spans into a hierarchical tree based on `parent_id`.
- Utilized CSS percentages relative to the root span's start time and duration to render width and offset without heavy charting libraries.
- Designed `TraceDetail.tsx` split-pane layout to simultaneously mount the Waterfall View alongside real-time correlated logs.
- Wired clickable `react-router-dom` links via `/traces/:traceId` allowing seamless traversal from Logs -> Trace.

## Tasks Completed
- Task 1: Implemented `fetchTrace` wrapper.
- Task 2: Developed recursive `SpanWaterfall` and CSS rendering.
- Task 3: Built `TraceDetail` page with embedded `LogViewer`.

## Deviations from Plan
- [Rule 3 - Blocking] The original task mentioned D3 or canvas rendering, but we deliberately chose Custom HTML/CSS/Grid to abide by the fast, "low-effort" requirements captured in `02-CONTEXT.md`.

## Pre-Commit Hook Failures
- Encountered TypeScript unresolved references because `api.ts` failed to patch via multi-replace. Rewrote `api.ts` entirely to resolve export member errors.

## Self-Check: PASSED
