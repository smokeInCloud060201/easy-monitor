# Phase 50 Research: Log Correlation & Attributes

## Metadata Enrichment Framework
Standard APM agents rely on OS-level environment variables (specifically `OTEL_RESOURCE_ATTRIBUTES` in OpenTelemetry). 
Format: `OTEL_RESOURCE_ATTRIBUTES="deployment.environment=staging,service.version=2.0.0,k8s.pod.name=foo"`.
Extraction algorithm: split by `,`, split by `=`, trim, match `deployment.environment` to `env` and `service.version` to `version`. Write directly to the root telemetry attributes (`span.meta["env"]`).

## Log Correlation Mechanics
Injecting tracing contexts allows backend explorers to match `message:"Error"` with `trace_id`.
- **Node.js**: The global `console` object exposes `log`, `info`, `warn`, `error`. A prototype-level proxy intercepting the first argument `args[0]` to prepend `[trace_id: X span_id: Y]` works natively for all standard stdout.
- **Java**: Logback and SLF4J dominate Java logging. Both respect `MDC` (Mapped Diagnostic Context) utilizing `ThreadLocal` storage. Using native Java Reflection against `org.slf4j.MDC` safely injects contexts.
- **Go**: The core `log` struct cannot be universally patched globally without intercepting `log.SetOutput()`. Exporting a simple format helper `telemetry.FormatLog(ctx, msg)` adheres to idiomatic Go.
- **Rust**: `tracing` macros (`info!`, `error!`) naturally pick up all active Span variables when using `tracing-subscriber::fmt`. The standard ecosystem inherently solves this without manual `eprintln!` interception.
