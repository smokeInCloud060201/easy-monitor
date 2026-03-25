---
wave: 1
depends_on: []
files_modified:
  - "node-agent/Cargo.toml"
  - "node-agent/src/logs/mod.rs"
  - "node-agent/src/logs/tailer.rs"
  - "node-agent/src/main.rs"
autonomous: true
---

# Plan: Implement Directory File Tailer for Raw Polyglot Application Logs

<objective>
To comprehensively intercept native, unformatted multi-line logs emitted by all microservices running in `mock-app`, build an async file tailer into the `node-agent` using `linemux` that watches `mock-app/.logs/` and natively aggregates output.
</objective>

<tasks>
<task>
  <description>Add file tailing dependencies to node-agent</description>
  <read_first>
    - node-agent/Cargo.toml
  </read_first>
  <action>
    Add `linemux = "0.3"` and `tokio-stream = "0.1"` to `node-agent/Cargo.toml` to power the asynchronous directory log tailing.
  </action>
  <acceptance_criteria>
    - `node-agent/Cargo.toml` contains `linemux`
    - `cargo check` in `node-agent` completes successfully
  </acceptance_criteria>
</task>

<task>
  <description>Implement asynchronous multi-line file tailer logic</description>
  <read_first>
    - node-agent/src/logs/mod.rs
    - node-agent/src/wal/mod.rs
    - shared-proto/proto/logs.proto
  </read_first>
  <action>
    Create `node-agent/src/logs/tailer.rs`. 
    Implement `pub async fn start_file_tailer(wal: std::sync::Arc<crate::wal::WalBuffer>, log_dir: &str) -> anyhow::Result<()>`.
    - Use `linemux::MuxedLines` to tail all `*.log` files matching the `log_dir`.
    - Loop over `lines.next().await`. When a line is yielded:
      - Intercept the `source` filename (e.g. `order.log`). Strip the `.log` extension, and if it doesn't end in `-service`, append it (e.g. `order` -> `order-service`).
      - Check if the line begins with whitespace (using `.starts_with(char::is_whitespace)`). If it does, buffer it into a multi-line string accumulator for that specific file.
      - If it does NOT start with whitespace, flush the previously accumulated string for that file into a new `LogEntry` proto and start a new buffer.
      - Default to level "INFO" (with a basic `to_lowercase().contains("error")` or `"exception"` override to mark it as `level: "ERROR"`).
      - Flush the `LogEntry` natively to `wal.write_log(entry).await`.
  </action>
  <acceptance_criteria>
    - `node-agent/src/logs/tailer.rs` exists and implements `start_file_tailer`.
    - The tailing loop buffers multiline outputs that start with a whitespace character instead of fragmenting them.
  </acceptance_criteria>
</task>

<task>
  <description>Integrate the tailer into the node-agent startup sequence</description>
  <read_first>
    - node-agent/src/main.rs
  </read_first>
  <action>
    In `node-agent/src/main.rs`:
    Inject the module `pub mod tailer;` into `node-agent/src/logs/mod.rs`.
    Read an environment variable `AGENT_LOG_DIR` (defaulting to `../mock-app/.logs` if not set).
    Spawn the background `start_file_tailer` task alongside the existing `start_log_tailer` UDP receiver natively.
  </action>
  <acceptance_criteria>
    - `node-agent/src/main.rs` spawns `start_file_tailer` concurrently with the UDP engine.
  </acceptance_criteria>
</task>

<task>
  <description>Ensure frontend logs view properly scrolls multi-line breaks</description>
  <read_first>
    - dashboard/src/pages/LogsExplorer.tsx
  </read_first>
  <action>
    Locate the log layout rendering the generic `log.message` structure in `dashboard/src/pages/LogsExplorer.tsx`.
    Ensure the bounding generic div uses `whitespace-pre-wrap` or `style={{ whiteSpace: 'pre-wrap' }}` in Tailwind/React so that Java stacktraces correctly render their native multi-line indentations.
  </action>
  <acceptance_criteria>
    - `LogsExplorer.tsx` contains `whitespace-pre-wrap` semantics on the message div.
  </acceptance_criteria>
</task>
</tasks>

<verification>
## Verification Steps
1. Boot all simulation services inside `mock-app` and kill any previous ones using `./start.sh`.
2. Ensure `node-agent` is successfully compiled via `cargo run` and watching `../mock-app/.logs/`.
3. Open `http://localhost:5173/logs` and search specifically for multi-line Java exceptions (e.g. "SocketException"). Ensure the trace is readable as a single cohesive unit.
</verification>

<must_haves>
- `linemux` tailer must properly attribute logs to the source service file.
- Multi-line buffered aggregation MUST retain indentations.
</must_haves>
