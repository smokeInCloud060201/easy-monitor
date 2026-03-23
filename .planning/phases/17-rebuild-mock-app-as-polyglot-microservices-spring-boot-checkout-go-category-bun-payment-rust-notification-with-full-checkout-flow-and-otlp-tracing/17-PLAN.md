---
phase: 17
plan: 1
title: "Rebuild mock-app as polyglot microservices with full checkout flow and OTLP tracing"
wave: 1
depends_on: []
files_modified:
  - mock-app/ (full rebuild)
  - mock-app/start.sh
autonomous: true
requirements_addressed: []
---

# Plan 1: Polyglot Microservices Mock App

<objective>
Replace the current Node.js mock-app with 4 microservices in 4 different languages, all instrumented with OpenTelemetry, communicating via HTTP to simulate a realistic production checkout flow. Each service uses simulated DB and cache operations to create deep, multi-span traces.

**Architecture:**
```
Client (traffic generator)
  └→ checkout-service (Spring Boot 3 / Java)  :8080
       ├→ category-service (Go)                :8081  — validate items/stock
       ├→ payment-service (Bun/TypeScript)     :8082  — charge payment
       └→ notification-service (Rust/Axum)     :8083  — send confirmation
```

All services export OTLP gRPC to `localhost:4317` (node-agent).
</objective>

<tasks>

<task id="1" title="Clean existing mock-app and scaffold structure">
<action>
1. Remove all existing Node.js mock-app files (`index.js`, `order.js`, `payment.js`, `category.js`, `tracing.js`, `instrumentation.js`, `package.json`, `package-lock.json`, `node_modules/`)
2. Keep `notification-service/` directory as a reference but will be replaced with Rust
3. Create the 4 service directories:
   - `mock-app/checkout-service/` (Spring Boot 3)
   - `mock-app/category-service/` (Go)
   - `mock-app/payment-service/` (Bun)
   - `mock-app/notification-service/` (Rust - replace existing Java)
4. Create new `mock-app/start.sh` that builds and starts all 4 services
5. Create `mock-app/traffic.sh` that generates varied checkout traffic
</action>
</task>

<task id="2" title="checkout-service — Spring Boot 3 (Java 17+)">
<action>
Create a Spring Boot 3 application with:

**Endpoints:**
- `POST /api/checkout` — Main checkout flow:
  1. Validate request (parse items, quantities)
  2. Call category-service `GET /api/category/{id}` to verify stock for each item
  3. Calculate totals (subtotal, tax, shipping)
  4. Call payment-service `POST /api/charge` with amount
  5. Record order in DB (`INSERT INTO orders`)
  6. Call notification-service `POST /api/notify` with order confirmation
  7. Return order summary
- `GET /api/orders/{id}` — Lookup order (cache → DB fallback)
- `GET /api/health` — Health check

**OTLP Setup:** Use `opentelemetry-javaagent.jar` (already exists) with env vars:
```
OTEL_SERVICE_NAME=checkout-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
```

**Simulated DB/Cache:**
- Use `Thread.sleep()` with random durations for DB queries (15-80ms)
- Use `Thread.sleep()` for cache ops (1-10ms, 70% hit rate)
- Create manual spans via `@WithSpan` or Tracer API for each operation

**Error simulation:** 5% chance of stock unavailable, 3% checkout timeout
</action>
</task>

<task id="3" title="category-service — Go">
<action>
Create a Go service with:

**Endpoints:**
- `GET /api/category/{id}` — Get category with stock info:
  1. Check Redis cache for category
  2. On miss: query DB for category details
  3. Warm cache
  4. Load related products from DB
  5. Return category + stock/price info
- `GET /api/category/search?q=` — Search categories (full-text sim)
- `GET /api/health` — Health check

**OTLP Setup:** Use `go.opentelemetry.io/otel` with OTLP gRPC exporter:
```go
import "go.opentelemetry.io/otel"
import "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
```
- Wrap HTTP handler with `otelhttp.NewHandler()`
- Create manual spans for DB/cache ops via `tracer.Start()`

**Simulated DB/Cache:**
- `time.Sleep()` with random durations
- Cache: 1-8ms, DB: 15-70ms
- DB spans: `db.query SELECT categories`, `db.query SELECT products`
- Cache spans: `cache.GET category:{id}`, `cache.SET category:{id}`

**Error simulation:** 2% DB timeout, 1% cache error
</action>
</task>

<task id="4" title="payment-service — Bun (TypeScript)">
<action>
Create a Bun service with:

**Endpoints:**
- `POST /api/charge` — Process payment:
  1. Validate card details (span: `validate_card`, 10-30ms)
  2. Fraud detection check (span: `fraud_check`, 30-120ms)
  3. Check duplicate transactions in DB
  4. Process charge (85% success rate)
  5. Record transaction in DB
  6. Update merchant balance cache
  7. Return transaction result
- `GET /api/payment/status/{id}` — Check transaction status (cache → DB)
- `GET /api/health` — Health check

**OTLP Setup:** Use `@opentelemetry/sdk-node` with `@opentelemetry/exporter-trace-otlp-grpc`:
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
```
- Auto-instrumentation for Bun's fetch server
- Manual spans for DB/cache/validation ops

**Simulated DB/Cache:**
- `Bun.sleep()` or `setTimeout` with random durations
- Create child spans with proper parent context

**Error simulation:** 15% payment declined, 5% card validation fail, 3% fraud flagged
</action>
</task>

<task id="5" title="notification-service — Rust (Axum)">
<action>
Create a Rust Axum service with:

**Endpoints:**
- `POST /api/notify` — Send notification:
  1. Parse notification request (order_id, email, type)
  2. Lookup user preferences in DB (span: `db.query SELECT user_prefs`)
  3. Render email template (span: `render_template`, 5-15ms)
  4. Simulate SMTP send (span: `smtp.send`, 50-200ms)
  5. Record notification in DB
  6. Update notification cache with delivery status
  7. Return delivery receipt
- `GET /api/notifications/{order_id}` — Check notification status
- `GET /api/health` — Health check

**OTLP Setup:** Use `opentelemetry` + `opentelemetry-otlp` Rust crates:
```toml
opentelemetry = { version = "0.22", features = ["trace"] }
opentelemetry-otlp = { version = "0.15", features = ["tonic"] }
tracing-opentelemetry = "0.23"
```
- Use `tracing` crate with `tracing-opentelemetry` layer
- Extract trace context from incoming HTTP headers via `opentelemetry::propagation`

**Simulated DB/Cache:**
- `tokio::time::sleep()` with random durations
- Create spans via `tracing::instrument` macro

**Error simulation:** 3% SMTP timeout, 1% template render error
</action>
</task>

<task id="6" title="start.sh and traffic generator">
<action>
Create `mock-app/start.sh`:
1. Build all 4 services (gradle bootJar, go build, bun install, cargo build)
2. Start all 4 with proper OTEL env vars pointing to localhost:4317
3. Wait for services to be healthy
4. Start traffic generator loop

Traffic patterns (every 2 seconds):
```bash
# Full checkout flow (gateway → category → payment → notification)
curl -X POST localhost:8080/api/checkout -d '{"items":[...]}'

# Direct category browse
curl localhost:8081/api/category/electronics

# Payment status check
curl localhost:8082/api/payment/status/txn_xxx

# Notification lookup
curl localhost:8083/api/notifications/ord_xxx

# Category search
curl localhost:8081/api/category/search?q=electronics
```
</action>
</task>

</tasks>

<verification>

## must_haves
- [ ] All 4 services start and respond to health checks
- [ ] Full checkout flow produces traces visible in dashboard with all 4 services
- [ ] Service map shows edges: checkout→category, checkout→payment, checkout→notification
- [ ] Each service creates DB and cache child spans visible in span waterfall
- [ ] `start.sh` builds and runs all services with one command

## Commands
```bash
cd mock-app && ./start.sh
# Wait 30 seconds
curl http://localhost:3000/api/v1/apm/services  # Should list all 4 services
curl http://localhost:3000/api/v1/apm/service-map  # Should show connected graph
```

</verification>
