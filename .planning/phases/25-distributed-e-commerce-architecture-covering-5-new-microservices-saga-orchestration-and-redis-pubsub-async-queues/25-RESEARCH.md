# Phase 25 Research: Distributed E-Commerce Architecture

## Objective
Establish a polyglot microservice expansion plan migrating the generic mock environment into a fully-fledged DDD E-commerce backend spanning Spring Boot, Go, Rust, and Node.js.

## Architecture Scope
1.  **Cart Service** (Spring Boot): Manages transient cart data before checkout.
2.  **User Service** (Go): Handles profile state and auth mock endpoints.
3.  **Inventory Service** (Rust): Critical boundary handling reservation blocks preventing overselling.
4.  **Shipping Service** (Express Node): Calculates delivery options.
5.  **Pricing Service** (Spring Boot): Applies complex matrix discounts.
6.  **Product Service** (Go): (Renamed from category-service). Focuses on item metadata.
7.  **Order Service** (Java): (Renamed from checkout-service). Becomes the central SAGA Orchestrator tracking state (PENDING -> PENDING_PAYMENT -> CONFIRMED).

## Key Patterns Identified
-   **Idempotency**: The `POST /api/v1/checkout` endpoint MUST accept an `Idempotency-Key` header to block double-charges.
-   **SAGA Orchestration**: Order Service governs the transaction map. If Payment Service returns a 400/500, a Compensation transaction (`POST /internal/inventory/release`) fires over the network.
-   **Async Event Boundaries**: Message Queues leverage **Redis PubSub** using the existing Redis clustered connection `redis://spdiredisq2.sap.local:6379`. Listeners will subscribe to the `payment.events` channel awaiting `{"event": "payment.succeeded", "orderId": "..."}` payloads.

## Validation Architecture
- Validate container connectivity and ports.
- Validate `GET /internal/carts/{cartId}` endpoints across service arrays.
- Confirm SAGA fallback execution via `p1qixapi.sap.local` integration mocks.
