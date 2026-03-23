---
wave: 1
depends_on: []
files_modified:
  - "agents/java/opentelemetry-javaagent.jar"
  - "agents/node/package.json"
  - "agents/node/instrumentation.ts"
  - "agents/go/telemetry/tracer.go"
  - "agents/rust/telemetry/Cargo.toml"
  - "agents/rust/telemetry/src/lib.rs"
  - "mock-app/start.sh"
  - "mock-app/payment-service/src/instrumentation.ts"
  - "mock-app/payment-service/package.json"
  - "mock-app/category-service/main.go"
  - "mock-app/notification-service/src/main.rs"
autonomous: true
---

# Phase 20: Create Centralized Polyglot Agents

<objective>
To create a unified `/agents` repository containing OpenTelemetry initialization logic for Java, Node/Bun, Go, and Rust. Then, refactor the mock-app microservices to use these centralized agents rather than maintaining their own disparate telemetry setups.
</objective>

<tasks>

<task>
  <description>Create the `agents` folder and establish the Java and Node/Bun agents.</description>
  <action>
    Create the directory structure: `agents/java`, `agents/node`, `agents/go`, `agents/rust`.
    
    **Java Agent:**
    Move or copy `opentelemetry-javaagent.jar` from `mock-app/checkout-service/` into `agents/java/`. Ensure it exists as the centralized source of truth for JVM apps.

    **Node Agent:**
    In `agents/node/`, create `package.json` with the required OpenTelemetry auto-instrumentation dependencies (core, sdk-trace-node, sdk-metrics, sdk-logs, auto-instrumentations-node).
    Create `agents/node/instrumentation.ts` that initializes the `NodeSDK` with OTLP exporters for traces and logs configured for localhost:4317.
    
    **Refactor Mock Apps:**
    Run `bun install` inside `agents/node/` to install the node agent dependencies.
    Modify `mock-app/start.sh` to point the Java and Bun startup commands to these centralized agents (e.g., `java -javaagent:../../agents/java/opentelemetry-javaagent.jar` and `bun run --preload ../../agents/node/instrumentation.ts`).
    Delete `mock-app/payment-service/src/instrumentation.ts` as it's no longer needed. Update `payment-service` package.json if necessary to remove OTel dependencies.
  </action>
  <acceptance_criteria>
    - `agents/java/opentelemetry-javaagent.jar` exists.
    - `agents/node/instrumentation.ts` exists and resolves dependencies correctly.
    - `mock-app/start.sh` utilizes the centralized Java and Node agents.
  </acceptance_criteria>
</task>

<task>
  <description>Establish the Go and Rust minimal-code agents and refactor mock apps.</description>
  <action>
    **Go Agent:**
    Create a new go module in `agents/go` via `go mod init github.com/easymonitor/agents/go`. Add `opentelemetry` dependencies.
    Create `agents/go/telemetry.go` exposing `Init("service-name")` which sets up the OTLP trace exporter.
    Modify `mock-app/category-service/go.mod` to `replace github.com/easymonitor/agents/go => ../../agents/go`.
    Modify `mock-app/category-service/main.go` to import and call this centralized module.

    **Rust Agent:**
    Create a new rust lib in `agents/rust/easymonitor-agent` (`cargo new --lib easymonitor-agent`).
    Add `tracing`, `tracing-opentelemetry`, and `opentelemetry-otlp` dependencies to `agents/rust/easymonitor-agent/Cargo.toml`.
    Create a public function `init_telemetry(service_name: &str)` in `lib.rs` that installs the global tracer and subscriber.
    Modify `mock-app/notification-service/Cargo.toml` to depend on `easymonitor-agent = { path = "../../agents/rust/easymonitor-agent" }` and remove raw OTel dependencies.
    Modify `mock-app/notification-service/src/main.rs` to initialize via `easymonitor_agent::init_telemetry("notification-service")`.
  </action>
  <acceptance_criteria>
    - `agents/go` exposes an initialization helper.
    - `category-service` compiles after being refactored to use the local module.
    - `agents/rust` exposes a `.rlib`/crate initialization helper.
    - `notification-service` compiles after being refactored to use the local crate.
  </acceptance_criteria>
</task>

</tasks>

<must_haves>
- The `/agents` directory acts as the sole provider of OTel logic for the mock-app.
- The `mock-app` services themselves contain essentially zero knowledge of OpenTelemetry configuration internals.
- The centralized agents default to EasyMonitor's opinionated parameters (`http://localhost:4317`).
</must_haves>
