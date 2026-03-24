---
wave: 2
depends_on: ["01-rename-legacy-services-PLAN.md"]
files_modified: ["mock-app/user-service", "mock-app/inventory-service", "mock-app/shipping-service", "mock-app/pricing-service", "mock-app/cart-service"]
autonomous: true
---

# Plan: Initialize Distributed Network Topology

<objective>
Scaffold the five remaining polyglot microservices mandated by the architecture and wire up their Redis and Postgres configuration variables.
</objective>

<tasks>
<task>
<description>Create base domains matching existing frameworks</description>
<read_first>
- mock-app/docker-compose.yml
- mock-app/start.sh
</read_first>
<action>
1. Clone `product-service` as scaffolding for the new Go `user-service`. Setup `/internal/users`. (Port 8085)
2. Clone `notification-service` as scaffolding for the Rust `inventory-service` binding `POST /internal/inventory/reserve` logic. (Port 8086)
3. Scaffold an Express.js boilerplate for `shipping-service` hooking up OpenTelemetry bindings copying existing Node logic. (Port 8087)
4. Clone `order-service` (Java) to build `cart-service` (Port 8088) and `pricing-service` (Port 8089) endpoints returning JSON maps defined in CONTEXT.md.
5. Inject them into `start.sh`.
</action>
<acceptance_criteria>
- `mock-app/inventory-service/Cargo.toml` exists
- `mock-app/user-service/go.mod` exists
- All 5 new services successfully build natively without dropping fatal trace constraints.
</acceptance_criteria>
</task>
</tasks>
