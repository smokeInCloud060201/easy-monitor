# Phase 54: Decouple Telemetry - Research

## Objective
Identify how to completely remove APM tracing artifacts (`#[tracing::instrument]`, `db.Use(&GormTracer{})`) from business logic codebases across all polyglot agents (specifically Rust and Go) without losing observability telemetry, thereby strictly enforcing the "Applications handle business logic, Agents handle tracing" rule.

## Findings

### Rust Agent (SQLx Auto-Instrumentation)
1. Currently, developers are forced to manually add `#[tracing::instrument(name = "db.query", fields(db.statement = "..."))]` to every repository method in `inventory-service` and `notification-service`.
2. **Crucially**, the `sqlx` crate *already* natively emits `tracing::Event`s (not spans) with the target `"sqlx::query"` and fields like `db.statement`, `rows_affected`, and `elapsed`.
3. The custom `DatadogTracingLayer` inside `easymonitor-agent` currently only hooks `on_new_span` and `on_close`. It completely drops `tracing::Event`s unless they are logs processed by `GelfLayer`.
4. **Integration Strategy:** We must implement the `on_event` method in `DatadogTracingLayer`. When an event with `target == "sqlx::query"` is intercepted, we can extract `db.statement` and `elapsed`, convert it into a `DatadogSpan`, parent it to the current context (`ctx.lookup_current()`), and emit it directly to the dashboard. This allows 100% removal of `#[tracing::instrument]` from application code.

### Go Agent (GORM Global Wrapping)
1. The Go services (`product-service` and `user-service`) currently import the agent and run `db.Use(&telemetry.GormTracer{})` during database initialization.
2. In Go, it is impossible to monkey-patch or bytecode-weave code securely without exposing some initialization surface area (unlike Java or Node's `require-in-the-middle`).
3. The current implementation where `db.Use(...)` is strictly located in `main.go` initialization logic (and NOT in any business repository layer) is the **idiomatically correct** OpenTelemetry auto-instrumentation pattern for compiled Go binaries. 
4. **Integration Strategy:** Audit the `product-service` and `user-service` repositories to ensure the `telemetry` module is exclusively confined to global `main.go` bootstrapping and never leaks into business-domain code.

### Java & Node Agents
1. **Java:** ByteBuddy auto-weaves JDBC and Spring `RestTemplate` bytecodes transparently. The Mock App is clean.
2. **Node:** The `require-in-the-middle` module intercepts `pg` transparently natively via the Node agent hook. The Node `payment-service` and `shipping-service` repositories are clean.

## Execution Requirements
1. Update `easymonitor-agent/src/lib.rs` to intercept `sqlx::query` in `DatadogTracingLayer::on_event`.
2. Strip all tracing macros from `inventory-service/src/repository.rs` and `notification-service/src/repository.rs`.

## Validation Architecture
1. Restart the mock-app cluster after removing all manual application logic tracing constraints.
2. Access the Easy Monitor APM Dashboard.
3. Verify that `db.query` spans (specifically `CREATE TABLE`, `INSERT`, `SELECT` from the Rust services) are still precisely stitched into the cascading SAGA waterfalls.

## RESEARCH COMPLETE
