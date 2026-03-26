# Phase 50 Validation Criteria

## Goals
Ensure APM spans correctly inherit deployment metadata and that developers can link terminal text directly to active traces.

## Criteria
1. **Node**: Execution of `console.log("hello")` while inside a hooked request MUST print `[trace_id: <val> span_id: <val>] hello` natively.
2. **Java**: High-throughput thread resolution triggers `MDC.put` natively through standard JVM loading, failing gracefully if slf4j is missing.
3. **Go**: Compilation passes exposing `telemetry.FormatLog` interfaces cleanly.
4. **Rust**: Zero-touch operation succeeds, passing CI checks.
5. **Metadata**: Across 4 languages, setting `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=demo` generates spans containing `meta["env"] == "demo"`.
