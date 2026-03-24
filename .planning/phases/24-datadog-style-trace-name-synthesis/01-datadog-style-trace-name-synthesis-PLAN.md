---
wave: 1
depends_on: []
files_modified:
  - node-agent/src/apm/mod.rs
  - dashboard/src/components/apm/EndpointsTable.tsx
  - dashboard/src/components/apm/TracesSection.tsx
autonomous: true
---

# Plan 1: Implement Datadog-Style Span Synthesis

## Objective
Update the OpenTelemetry trace receiver in `node-agent` to dynamically synthesize high-fidelity trace names (e.g. `redis.query · DEL`, `actix.request · GET /api/health`, `postgresql.query · SELECT ...`) matching the Datadog UI formatting, and update the associated React Dashboard to parse the bullet separators appropriately.

<read_first>
- `node-agent/src/apm/mod.rs`
- `dashboard/src/components/apm/EndpointsTable.tsx`
- `dashboard/src/components/apm/TracesSection.tsx`
</read_first>

<action>
1. Modify `node-agent/src/apm/mod.rs`:
   - Change the HTTP span string formatter to: `format!("{} · {} {}", prefix, m, r)` (ensure the `·` symbol is properly encoded with spaces).
   - Refactor the Database span format. Extract `tags.get("db.statement")` and fallback to `tags.get("db.operation")`. If a query text exists, format it as `format!("{}.query · {}", sys, query_text)`. Otherwise, fallback to the bare `sys.query`.
2. Update `dashboard/src/components/apm/EndpointsTable.tsx`:
   - The method extraction logic currently fails to parse `express.request · POST /api`. Modify the regex inside `extractMethod` to safely split strings separated by ` · `.
3. Update `dashboard/src/components/apm/TracesSection.tsx`:
   - Enforce tailwind line truncates (`truncate text-xs text-gray-400 font-mono inline-block max-w-full`) to cleanly handle wildly massive 10,000 keyword SQL traces gracefully rendering without exploding the grid.
</action>

<acceptance_criteria>
- `node-agent/src/apm/mod.rs` contains string generation blocks applying the ` · ` delimiter unconditionally to API namespaces and extracted Database statement tags.
- The `node-agent` rust library compiles cleanly.
- `extractMethod` logic natively slices the pre-formatted `sys.query` identifiers away from the main target payloads.
</acceptance_criteria>

## Verification Structure
- Re-run `mock-app` and monitor spans propagated natively into clickhouse for `easy_monitor_traces` evaluating string schema configurations successfully updated containing `·` signatures.
