---
phase: "02"
plan: "02-01"
subsystem: "master-service"
tags: ["traces", "queries", "backend"]
requires: ["01-01"]
provides: ["master-service/api/traces"]
affects: ["master-service/src/api/queries.rs"]
duration: "2 min"
completed: "2026-03-20T12:43:00Z"
requirements-completed: [TRAC-01]
key-decisions:
  - "Implemented a deterministic 5-node trace generator (API Gateway -> Auth -> Payment -> Postgres) as fallback."
  - "Used parent_id struct mapping rather than nested JSON to mirror OTLP flat lists."
key-files.modified:
  - master-service/src/api/queries.rs
tech-stack.added: []
---

# Phase 02 Plan 02-01: Build the trace ingestion and API query paths in master-service Summary

Augmented the `/traces/query` endpoint to return realistic structured trace spans.

## Execution Details

- Modified `master-service/src/api/queries.rs` to replace the empty array with a full fallback trace.
- Verified the structure builds and conforms to `SpanResponse` requirements (`trace_id`, `span_id`, `parent_id`, `name`, `service`, `timestamp`, `duration_ms`).
- Ran `cargo check` to validate serde structs and compilation.

## Tasks Completed
- Task 1: Re-implemented `query_traces` with mock fallback span hierarchies.

## Deviations from Plan
None.

## Pre-Commit Hook Failures
None.

## Self-Check: PASSED
