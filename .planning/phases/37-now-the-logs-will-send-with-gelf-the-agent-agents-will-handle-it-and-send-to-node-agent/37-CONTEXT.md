# Phase 37: Now the logs will send with GELF, the agent agents will handle it and send to node-agent - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

The polyglot microservice application agents (Java, Node, Go, Rust) contained in `agents/` currently utilize standard `OTLPLogExporter` wrappers to ship application logs to port `4317` gRPC. 

We will rip out these heavy gRPC OTLP log abstractions from the underlying agents and replace them with native, ultra-lightweight **GELF (Graylog Extended Log Format) UDP** socket exporters targeting `127.0.0.1:12201`, which natively aligns with `node-agent`'s high-throughput UDP GELF ingestion listener.

</domain>

<decisions>
## Implementation Decisions

### Scope & Behavior
- **Node (`agents/node/instrumentation.ts`)**: Replace `@opentelemetry/exporter-logs-otlp-grpc` with a custom `GelfLogRecordExporter` (or UDP direct socket mapping from the OpenTelemetry LogRecordProcessor).
- **Go (`agents/go/telemetry.go`)**: Replace `otlploggrpc` with a custom UDP networking `Exporter` interface.
- **Java (`agents/java/src/main/java/com/easymonitor/agent/EasyMonitorAgentCustomizer.java`)**: Instead of relying on `otel.logs.exporter=otlp`, implement an `AutoConfigurationCustomizer` that overrides the LogExporter with a bespoke native UDP GELF packet sender.
- **Rust (`agents/rust/src/lib.rs`)**: Construct a `UdpSocket` backend for the Rust tracing-subscriber or `opentelemetry-rust` logger.

### Core GELF Schema Standard
Each custom exporter must parse the intrinsic OTel `LogRecord` and emit the following JSON string as a UDP buffer payload:
```json
{
  "version": "1.1",
  "host": "local",
  "short_message": "...",
  "timestamp": 12345678.90,
  "level": 6,
  "_service": "payment-service",
  "_trace_id": "...",
  "_span_id": "..."
}
```

</decisions>

<canonical_refs>
## Canonical References

- [Graylog GELF Specification](https://go2docs.graylog.org/current/getting_in_log_data/gelf.html)
- `node-agent/src/logs/receiver.rs`: Defines the current UDP `12201` listener schema on the ingestion side.

</canonical_refs>

<code_context>
## Existing Code Insights

- `agents/node/instrumentation.ts`: Hooks `winston` and standardizes it to `LoggerProvider`.
- `agents/go/telemetry.go`: Hooks `slog` into `otelslog`.
- `agents/java/`: Java agent builder standardizing the default `otlp` strings.

</code_context>

<specifics>
## Specific Ideas
- To avoid massive OTel library bloat across 4 languages, creating raw UDP sockets is dramatically faster and simpler than implementing 4 full compliant SDK layers.

</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>

---

*Phase: 37-now-the-logs-will-send-with-gelf-the-agent-agents-will-handle-it-and-send-to-node-agent*
*Context gathered: 2026-03-25*
