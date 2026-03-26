# Phase 49 Research: Database & External Service Monitoring

## Overview
Phase 49 requires us to hook out-of-band requests natively across 4 agents. 

## Architectural Approaches

### 1. Node.js
- **HTTP Outbound**: Standard `http.request` and `https.request` modules can be wrapped. `axios` uses `http` natively, so wrapping `http` automatically traces `axios`. Node 18+ global `fetch` can be wrapped directly (`global.fetch`).
- **DB Outbound**: `pg` (Postgres) exposes `Client.prototype.query`. `mysql2` exposes `Connection.prototype.execute` and `query`. These will be safely monkey-patched via Node `require` overrides or direct prototype manipulation.
- **Obfuscation**: A pure Regex tokenization `sql.replace(/(['"]).*?\1|(\b\d+\b)/g, '?')` will securely replace literal PII strings before they map to `span.meta['db.query']`.

### 2. Go
- **HTTP Outbound**: Already instrumented in Phase 46 via `telemetry.WrapHTTPClient`.
- **DB Outbound**: Since Go's `database/sql` hides driver implementations, we will provide a `telemetry.DB` struct that embeds `*sql.DB` and provides traced wrappers around `QueryContext`, `ExecContext`, and `QueryRowContext`. 
- **Obfuscation**: The same JS regex equivalent (`regexp.Compile`) will be applied to the SQL query strings.

### 3. Rust
- **Ecosystem Integration**: The Rust APM wrapper `DatadogTracingLayer` already intercepts `tracing` events. Rather than monkey-patching specific HTTP/DB clients, we will utilize the native ecosystem (e.g. `reqwest-tracing` and `sqlx`). 
- **Implementation**: The `DatadogTracingLayer` `on_close` hook will be expanded to detect span payloads possessing `db.statement` or `http.url` fields natively emitted by third-party libraries. If `db.statement` is detected, the layer will automatically obfuscate the PII values.

### 4. Java
- **HTTP Outbound**: ByteBuddy interception of `java.net.HttpURLConnection.connect()` and `.getInputStream()`.
- **DB Outbound**: ByteBuddy interception of `java.sql.PreparedStatement.execute()`, `.executeQuery()`, and `.executeUpdate()`. To capture the query, we intercept `java.sql.Connection.prepareStatement(String sql)` first, mapping the String to the resulting Statement instance.
- **Obfuscation**: Java regex replace `replaceAll("(['\"]).*?\\1|(\\b\\d+\\b)", "?")`.

## Data Pipeline Security
SQL PII is scrubbed immediately on the agent thread before ever touching the memory boundaries or the MessagePack compiler, fully preventing data leaks to the backend network.
