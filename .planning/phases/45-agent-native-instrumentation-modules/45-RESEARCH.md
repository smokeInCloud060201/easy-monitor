# Phase 45 Research: Agent Native Instrumentation Modules

## Objective
Identify the specific hooks and instrumentation modules required to capture spans natively across the Node.js, Java, Go, and Rust agents without relying on open-telemetry SDKs. The goal is a Datadog-style approach (Level 1/2 hooks) with fail-safe behavior.

## Current State Analysis
- **Node.js**: Currently only wraps the global `fetch` API. Uses `require-in-the-middle` but doesn't actually hook into any modules yet. `AsyncLocalStorage` is set up correctly for context propagation.
- **Java**: ByteBuddy agent is scaffolded (`premain` exists), but no actual class transformations are implemented. 
- **Go**: Has a basic `WrapHTTPHandler` for `net/http` servers, but lacks client wrappers and database or advanced routing hooks.
- **Rust**: Has `DatadogTracingLayer` for the `tracing` ecosystem, and an `actix_middleware.rs` implementation.

## Required Native Hooks by Language

### 1. Node.js (`agents/node`)
- **HTTP/HTTPS (Client & Server)**: Hook into the core `http` and `https` modules using `require-in-the-middle` to capture incoming requests and outgoing client calls.
- **Express.js**: Hook into the `express` router to capture parameterized route paths as resource names, instead of raw URLs.
- **Database (Optional Level 2)**: Add a simple wrapper for `pg` (PostgreSQL) or `mysql2` if feasible within this phase, matching the Level 2 priority.

### 2. Java (`agents/java`)
- **Servlet API (Level 1)**: ByteBuddy transformer for `javax.servlet.Filter` or `HttpServlet.service` to capture inbound HTTP requests.
- **Spring Web (Level 1)**: Hook into `DispatcherServlet` or `@RestController` mapping to get parameterized route paths.
- **HTTP Clients**: Hook into `HttpURLConnection` or Apache `HttpClient` for outbound requests.
- **JDBC (Level 2)**: Hook into `java.sql.PreparedStatement` to capture database queries.

### 3. Go (`agents/go`)
- **Enhanced HTTP**: Provide a `WrapHTTPClient` round-tripper for outbound requests.
- **Framework Middlewares**: Provide drop-in middleware for popular routers (`gin`, `echo`, `chi`) to capture correct route patterns.
- **Database SQL**: Provide a `database/sql/driver` wrapper or a replacement `Open` function to capture SQL queries.

### 4. Rust (`agents/rust`)
- **Axum Middleware**: Provide a `tower::Service` middleware for `axum` to capture route properties, similar to the existing `actix_web` middleware.
- **Reqwest**: Provide a `reqwest-middleware` implementation to propagate context via HTTP headers and capture outbound spans.
- **SQLx (Optional)**: Provide a way to capture SQLx queries, typically handled nicely via `tracing` macros already, but verify the span names match expectations.

## Hook Failure & Error Handling Strategy
- **Node.js**: Wrap original functions in `try/catch`. If the hook fails to start a span, fallback to executing the original function.
- **Java**: ByteBuddy Advice methods should heavily use `@Advice.OnMethodEnter(suppress = Throwable.class)` to guarantee that instrumentation errors never break the application.
- **Go / Rust**: Leverage idiomatic middleware/wrappers that explicitly recover from panics or safely handle `Result/error` types, logging internally if telemetry fails.

## Validation Architecture
- **E2E Testing**: Start the mock-app polyglot services with the new hooks.
- **Verification**: Ensure the node-agent receives `[][]DatadogSpan` payloads where `resource` is correct (e.g., `/api/users/:id` instead of `/api/users/123`), and that client/server spans link correctly via trace context headers (`x-easymonitor-trace-id`, etc.).

## RESEARCH COMPLETE
