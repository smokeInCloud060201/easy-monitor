---
wave: 1
depends_on: []
files_modified:
  - agents/node/instrumentation.ts
  - agents/java/src/main/java/com/easymonitor/agent/EasyMonitorAgentCustomizer.java
  - agents/go/telemetry.go
  - agents/rust/easymonitor-agent/src/lib.rs
autonomous: true
---

# Phase 37 Plan: Native Agent GELF Log Exporters

<objective>
To replace heavy OTLP gRPC log exporters in all language agents with custom native Fast UDP Datagram socket exporters that format OTel LogRecords directly into pure Graylog Extended Log Format (GELF) JSON.
</objective>

<requirements_addressed>
- Phase 37
</requirements_addressed>

## Tasks

```xml
<task>
  <description>Refactor Node.js Agent to use native GELF UDP socket</description>
  <read_first>
    - agents/node/instrumentation.ts
  </read_first>
  <action>
    Remove `@opentelemetry/exporter-logs-otlp-grpc` entirely. Implement a custom `GelfLogRecordExporter` class in TypeScript that implements `LogRecordExporter`. Serialize `LogRecord` fields into GELF JSON `{"version":"1.1","host":"local","short_message":...,"_trace_id":...,"level":...}` and emit it via `dgram.createSocket('udp4').send()` to `127.0.0.1:12201`. Wire this custom exporter into the `LoggerProvider` using `BatchLogRecordProcessor`.
  </action>
  <acceptance_criteria>
    - `agents/node/instrumentation.ts` contains `GelfLogRecordExporter`
    - `dgram.createSocket('udp4')` is instantiated and sends to `12201`
    - `exporter-logs-otlp-grpc` import is removed
  </acceptance_criteria>
</task>

<task>
  <description>Refactor Go Agent to use native GELF UDP socket</description>
  <read_first>
    - agents/go/telemetry.go
  </read_first>
  <action>
    Remove `otlploggrpc` in Go `telemetry.go`. Create a custom type `GelfLogExporter` implementing `go.opentelemetry.io/otel/sdk/log.Exporter`. It must open a UDP socket (`net.DialUDP("udp", nil, addr)` to `127.0.0.1:12201`). During `Export(ctx, records)`, range over records, marshal each into a JSON GELF payload, and `Write` strictly to the socket. Avoid blocking operations.
  </action>
  <acceptance_criteria>
    - `agents/go/telemetry.go` contains `GelfLogExporter struct`
    - `net.DialUDP` references `127.0.0.1:12201`
    - `otlploggrpc` is removed completely
  </acceptance_criteria>
</task>

<task>
  <description>Refactor Java Agent to use native GELF UDP DatagramSocket</description>
  <read_first>
    - agents/java/src/main/java/com/easymonitor/agent/EasyMonitorAgentCustomizer.java
  </read_first>
  <action>
    Modify the `EasyMonitorAgentCustomizer` to omit `otel.logs.exporter=otlp`. Create a new class `GelfLogRecordExporter` implementing `io.opentelemetry.sdk.logs.export.LogRecordExporter`. Serialize the Java `LogRecordData` into the exact JSON GELF structure using standard JSON manipulation. Transmit via a singleton `java.net.DatagramSocket` to UDP host `127.0.0.1` port `12201`. Wire it into the OTel SDK programmatically using Java `AutoConfigurationCustomizer` hooks.
  </action>
  <acceptance_criteria>
    - A `GelfLogRecordExporter` Java class exists
    - `java.net.DatagramSocket` is initialized and pushing to `12201`
    - OTLP fallback defaults are unhooked for logs
  </acceptance_criteria>
</task>

<task>
  <description>Refactor Rust Agent to use native GELF UDP socket</description>
  <read_first>
    - agents/rust/easymonitor-agent/src/lib.rs
  </read_first>
  <action>
    Instead of using `opentelemetry_otlp` for logs, drop the `_log_provider` and `opentelemetry_appender_tracing` bridge. Implement a custom `tracing_subscriber::Layer` named `GelfLayer`. Hook into the exact `on_event` tracing lifecycle. Serialize tracing fields into serde_json values representing GELF. Open a `std::net::UdpSocket::bind("0.0.0.0:0")`, connect to `127.0.0.1:12201`, and `send` the JSON strings non-blockingly.
  </action>
  <acceptance_criteria>
    - `agents/rust/easymonitor-agent/src/lib.rs` exports a custom tracing `GelfLayer`
    - `UdpSocket` sends JSON payload to `127.0.0.1:12201`
    - Subscribes `tracing::subscriber::set_global_default` strictly onto the new `GelfLayer`
  </acceptance_criteria>
</task>
```

<verification>
- Start the `mock-app` via `./start.sh`
- Verify that standard logging output inside `shipping-service`, `checkout-service`, and `payment-service` gets intercepted natively and forwarded over UDP 12201 by capturing node-agent `tail` outputs or checking the Dashboard UI directly.
</verification>

<must_haves>
- None of the agents should use `OTLPLogExporter` anymore for standard logs
- All 4 agents must properly define and emit raw UDP Datagram packets structured precisely as GELF JSON.
</must_haves>
