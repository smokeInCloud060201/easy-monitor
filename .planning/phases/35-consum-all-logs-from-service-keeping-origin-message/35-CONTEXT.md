# Phase 35: Consum all logs from service keeping origin message - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the `node-agent` and master log ingestion pipeline to capture all raw, unformatted `stdout`/`stderr` logs from the instrumented applications (similar to Datadog's native log tracing) rather than only explicitly structured JSON log lines.
</domain>

<decisions>
## Implementation Decisions

### Scope & Behavior
- Consume all logs natively emitted by the service processes.
- Keep the original log message exactly as it appeared in the terminal (Don't change, parse, or truncate).
- Ensure multi-line stack traces (like `java.net.SocketException`) are preserved and viewable in the dashboard.

### Claude's Discretion
- How the `node-agent` hooks into the application's stdout/stderr streams (e.g., overriding `console.log` in Node, `System.out` in Java, wrapping process stdout, etc).
- How raw logs are mapped/correlated to the current active Trace/Span if the log wasn't emitted through an APM-aware logger.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `master-service/src/write_path`: Existing high-throughput log ingestion and ClickHouse batch writers.
- `node-agent` / Java Agent: Existing instrumentation layers that can be extended to hook raw stream outputs.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly requested to "consum all logs from service, same as Datadog, keep origin logs message, dont change".
- We need to capture raw multi-line errors like `java.net.SocketException: Invalid argument` exactly as printed by Tomcat.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 35-consum-all-logs-from-service-keeping-origin-message*
*Context gathered: 2026-03-25*
