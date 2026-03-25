# Phase 37: Now the logs will send with GELF, the agent agents will handle it and send to node-agent - Research

## Goal
To evolve the Easy Monitor instrumentation layer so that all natively intercepted application logs (Java, Node, Go, Rust) bypass the gRPC OTLP port (4317) completely. Instead, each language agent must directly encode intercepted application logs into GELF (Graylog Extended Log Format) JSON payloads and emit them via connectionless UDP datagrams targeting the `node-agent` listener on port `12201`.

---

## Architectural Approach

### Node Agent (`agents/node/instrumentation.ts`)
The Node instrumentation utilizes `@opentelemetry/sdk-logs` to hook Winston. 
1. We will rip out `OTLPLogExporter` and replace it with a custom `GelfLogRecordExporter` class implementing the OpenTelemetry `LogRecordExporter` interface.
2. The custom exporter will use the native Node.js `dgram` library (`dgram.createSocket('udp4')`) to emit JSON buffers.
3. The format maps OTel parameters into GELF standards (`level`, `short_message`, `_trace_id`, `_span_id`, `_service`).

### Go Agent (`agents/go/telemetry.go`)
The Go instrumentation uses `otelslog` and the `otlploggrpc` package.
1. We will strip out `otlploggrpc` from `telemetry.go`.
2. We will write a custom Go `go.opentelemetry.io/otel/sdk/log.Exporter` implementation that leverages `net.DialUDP` to write to `127.0.0.1:12201`.
3. The exporter will continuously serialize Go structured log events into GELF bytes.

### Java Agent (`agents/java/src/main/java/com/easymonitor/agent/`)
The custom Java AutoConfigurationCustomizer currently instructs the JVM to use `otel.logs.exporter=otlp`.
1. We must write a custom OpenTelemetry Log Exporter SPI implementation directly within the `com.easymonitor.agent` package.
2. It will implement `io.opentelemetry.sdk.logs.export.LogRecordExporter`.
3. An `AutoConfigurationCustomizerProvider` will wire it into the auto-configuration phase.
4. Uses standard `java.net.DatagramSocket` for blazing fast UDP fire-and-forget log shipping.

### Mock-App (Testing target)
No changes to `mock-app` logic itself. Restarting the `mock-app` containers will seamlessly trigger the recompiled local SDK agents. The dashboard will automatically reflect high-fidelity GELF logs directly pulled from the application SDK layer instead of filesystem tails.

## RESEARCH COMPLETE
