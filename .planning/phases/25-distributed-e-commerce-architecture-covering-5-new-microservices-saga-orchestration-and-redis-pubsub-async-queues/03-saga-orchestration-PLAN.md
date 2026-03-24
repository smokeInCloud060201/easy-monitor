---
wave: 3
depends_on: ["02-scaffold-microservices-PLAN.md"]
files_modified: ["mock-app/order-service", "mock-app/shipping-service", "mock-app/inventory-service"]
autonomous: true
---

# Plan: Choreograph the SAGA Orchestration Engine via Redis

<objective>
Configure `order-service` as the SAGA Orchestrator and bind all downstream participants to Redis PubSub event streams ensuring async transaction commits.
</objective>

<tasks>
<task>
<description>Orchestrate Redis Pub/Sub async webhooks</description>
<read_first>
- .planning/phases/25-distributed-e-commerce-architecture-covering-5-new-microservices-saga-orchestration-and-redis-pubsub-async-queues/25-CONTEXT.md
</read_first>
<action>
1. Add `Idempotency-Key` interceptors across `order-service` (`POST /api/v1/checkout`).
2. Integrate `Jedis/Lettuce` or standard library wrappers natively enabling `order-service` to broadcast `payment.succeeded` across Redis upon triggering the webhook.
3. Configure `shipping-service` and `inventory-service` background listeners natively subscribed to `payment.events` on `spdiredisq2.sap.local:6379`.
4. Process mock HTTP Client calls between Cart, Pricing, and Inventory returning final payloads matching CONTEXT limits.
</action>
<acceptance_criteria>
- `order-service` Java Spring Boot handles PubSub broadcast reliably
- `inventory-service` Rust daemon logs async Redis subscription connections flawlessly
</acceptance_criteria>
</task>
</tasks>
