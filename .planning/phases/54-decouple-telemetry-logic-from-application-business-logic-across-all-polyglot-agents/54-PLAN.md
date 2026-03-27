# Phase 54: Decouple Telemetry - Plan

---
wave: 1
depends_on: []
files_modified:
  - agents/rust/easymonitor-agent/src/lib.rs
  - mock-app/inventory-service/src/repository.rs
  - mock-app/notification-service/src/repository.rs
autonomous: true
---

<objective>
Refactor the Rust APM Agent to natively intercept SQLx tracing events so that all application-level macro annotations can be safely removed from the business logic.
</objective>

<tasks>
<task>
  <description>Implement event interception in the Rust Agent's `DatadogTracingLayer`</description>
  <read_first>
    agents/rust/easymonitor-agent/src/lib.rs
  </read_first>
  <action>
    Modify `agents/rust/easymonitor-agent/src/lib.rs`. Add the `fn on_event(&self, event: &tracing::Event<'_>, ctx: tracing_subscriber::layer::Context<'_, S>)` method to the `Layer<S> for DatadogTracingLayer` implementation block.
    Inside the method, check if `event.metadata().target() == "sqlx::query"`.
    If yes, use a `BTreeMap<String, serde_json::Value>` and the existing `JsonVisitor` to record the event fields (`db.statement`, `elapsed_secs`).
    Look up the current parent trace context via `ctx.lookup_current()` and extract the `trace_id` and `span_id` (which becomes the `parent_id` for the new db child span).
    Format the new `DatadogSpan` struct: name/resource is "db.query", type is "sql". Provide obfuscation logic on `db.statement` if needed using the `regex` logic.
    Calculate the duration based on `elapsed_secs` and push to `self.sender.try_send(dd_span)`.
  </action>
  <acceptance_criteria>
    `grep -A 5 "fn on_event" agents/rust/easymonitor-agent/src/lib.rs` returns the correct method signature within the `DatadogTracingLayer` impl.
  </acceptance_criteria>
</task>

<task>
  <description>Remove application-level tracing macro pollution from Rust repositories</description>
  <read_first>
    mock-app/inventory-service/src/repository.rs
    mock-app/notification-service/src/repository.rs
  </read_first>
  <action>
    Strip out all `#[tracing::instrument(name = "db.query", skip_all, fields(db.statement = "..."))]` macros manually injected into the repository classes of `inventory-service` and `notification-service`. Ensure no tracing annotations are left trailing in the business logic files.
  </action>
  <acceptance_criteria>
    `grep "tracing::instrument" mock-app/inventory-service/src/repository.rs` exits 1 (no results).
    `grep "tracing::instrument" mock-app/notification-service/src/repository.rs` exits 1.
  </acceptance_criteria>
</task>
</tasks>

<must_haves>
- The `DatadogTracingLayer` natively catches SQLx events without breaking the core `on_new_span` and `on_close` flow.
- Rust application repository files contain ZERO references to APM tracing macros.
</must_haves>

<verification_criteria>
- `cargo check` passes cleanly inside the Rust `inventory-service` to assert `DatadogTracingLayer` API compatibility.
</verification_criteria>
