# Phase 50: Agent Metadata Enrichment & Correlation

## Objective 
Enrich APM traces with standardized environment constraints (`deployment.environment`, `service.version`) and unify application logging telemetry by injecting `trace_id` and `span_id` contexts into outbound application logs (Log Correlation). 

## Proposal

### 1. Extensible Environment Metadata 
All agents (Node, Go, Rust, Java) will parse the standard `OTEL_RESOURCE_ATTRIBUTES` environment variable.
- Supported bindings: `deployment.environment=production,service.version=1.0.0`
- The attributes will be universally attached to all generated traces natively as root `env` and `version` labels allowing environment filtering dynamically.

### 2. Polyglot Log Correlation 

**Node.js**: 
- Safely override `console.log`, `console.info`, `console.warn`, and `console.error`.
- Dynamically invoke `traceStorage.getStore()` locally.
- Auto-prepend constraints like `[trace_id: <trace> span_id: <span_id>]` immediately into the stdout boundaries.

**Java**:
- Provide an `MDCAdvice` or update the raw `ServletAdvice`. 
- Since SLF4J and Logback map `MDC` strictly, we can use standard ByteBuddy interceptors (or direct reflection) to statically set `org.slf4j.MDC.put("trace_id", ...)` whenever a thread boundary starts resolving contexts natively.

**Rust**:
- Native `tracing::info!` macros natively include spans inside the context if the application harnesses `tracing_subscriber::fmt`. Zero-touch needed outside verifying fields are present in the mock-app.

**Go**:
- The standard `log` module doesn't natively map contextual bounds unless explicitly passed. We will export an explicit `telemetry.InjectLogContext` returning the standard prefix formatting wrapper to ensure safe Go injection.

## Review Goals
Karson, any adjustments needed on the logging implementations (specifically for Node overriding `console` global vs Java injecting into `org.slf4j.MDC`)?
