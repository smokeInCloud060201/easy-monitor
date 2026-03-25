# Phase 35: Consum all logs from service keeping origin message - Research

## Goal
The user wants to intercept and capture all raw, unfiltered standard output/error logs from the simulated microservices (like Datadog does natively), completely preserving multiline stack traces (like Tomcat's `java.net.SocketException`) and storing the original text exactly as it was emitted. 

## Architectural Approach

Presently, `easy-monitor` uses `node-agent` (a Rust agent running alongside apps) to ingest logs via a UDP GELF receiver (`12201`). Applications use structured JSON loggers to send data there. 

However, raw stdout/stderr (e.g. native JVM crashes, unhandled panics) goes straight to the console and is missed. Because `mock-app/start.sh` pipes all outputs to `mock-app/.logs/*.log`, the most robust "Datadog-like" way to natively capture these logs (without changing the applications) is to add a **Directory Tailer** to `node-agent` that tails `make-app/.logs/`.

### 1. File Tailing in Rust
`node-agent` can spawn a background async task that uses `notify` to watch for changes or simply glob for `.log` files in `mock-app/.logs/` and stream the growing ends of the files.
Because this is Rust in Tokyo, the `linemux` crate is highly recommended. It implements `tail -F` functionality asynchronously and seamlessly follows rotating/new files.

### 2. Multi-line Aggregation
The hardest part about raw log interception is capturing Java stacktraces.
```
java.net.SocketException: Invalid argument
        at java.base/sun.nio.ch.Net.setIntOption0(Native Method)
        at java.base/sun.nio.ch.Net.setSocketOption(Net.java:457)
```
If we treat every literal newline as a new `LogEntry`, the stack dump shatters into 20 fragmented logs.
**Solution**: The tailer must have a multi-line buffer. If a new line starts with whitespace (like `\t` or `  `), it is appended to the previous log entry. Once a line starts with a non-whitespace character (or a timestamp bracket `[`, or a year `202X`), the previous buffered entry is flushed as a complete message.

### 3. LogEntry Protobuf Wrapping
When flushing the raw message buffer, the file tailer maps it to the `LogEntry` proto:
- `service`: Inferred from the filename (e.g. `user.log` -> `user-service`).
- `message`: The literal unbounded multiline raw string buffer.
- `level`: Detected via a dumb regex (e.g., if the payload contains ` ERROR ` or `Exception`, mark as `ERROR`; otherwise `INFO`).
- `trace_id`: Blank (unless we regex it out of the line, but keeping it empty is fine for organic generic logs).
- `timestamp`: Current system time.

### 4. Bypassing UDP
Because the tailer will run directly inside `node-agent`, it doesn't need to send the logs over UDP to itself. It can directly invoke `wal.write_log(log_entry).await` on the existing `WalBuffer`, which will then forward the batches natively to the Master ClickHouse DB.

## Validation Architecture
- Boot the `mock-app` via `./start.sh`.
- Look at `mock-app/.logs/order.log` to see a physical `java.net.SocketException` printout.
- Open the Dashboard Logs Explorer (`localhost:5173/logs`).
- Search for "SocketException" or observe the tail.
- The entry MUST appear exactly correctly formatted as a unified multi-line log chunk, uncorrupted by JSON parsing or truncation, retaining the full native formatting of Tomcat's internal logging.

## RESEARCH COMPLETE
