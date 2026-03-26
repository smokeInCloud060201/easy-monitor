# Phase 52 Validation Criteria

## Goal
Lightweight delta CPU/Memory allocations are recorded accurately inside trace spans dynamically organically mapping request footprints natively.

## Steps
1. Run `mock-app` via Node.js generating REST loads simulating CPU bounds implicitly parsing JSON loops.
2. Query ClickHouse or look at the local APM dashboard Traces explorer natively.
3. Validate that standard traces contain structured JSON metrics:
   - `meta["cpu.user"] > 0`
   - `meta["mem.delta"]` organically appended locally onto specific API Spans guaranteeing proper span start/end hook execution organically bypassing heavy dependency profiling limits.
