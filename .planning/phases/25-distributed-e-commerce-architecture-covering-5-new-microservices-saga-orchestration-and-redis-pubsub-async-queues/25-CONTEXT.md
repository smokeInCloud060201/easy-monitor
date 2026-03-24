# E-Commerce Architecture Requirements

## Service Renames
- `category-service` -> `product-service`
- `checkout-service` -> `order-service`

## New Microservices Core
1. **Cart Service** (`springboot` / `java-agent`)
   - Manages user shopping cart (Add/remove/update items)
   - Calculates subtotal before checkout.
2. **User / Account Service** (`Go` / `go-agent`)
   - Handles user information, auth, profiles, addresses, preferences.
3. **Inventory Service** (`Rust` / `rust-agent`)
   - Checks stock, reserves items (vital to avoid overselling).
4. **Shipping / Delivery Service** (`Express` / `node-agent`)
   - Calculates shipping costs/method selection. Tracks delivery.
5. **Pricing / Promotion Service** (`springboot` / `java-agent`)
   - Applies discounts, coupons, final tax computation.

## Communications Protocol
- Synchronous REST for external API bounds.
- **Redis PubSub** for Event-Driven Async Message Queues (instead of heavy brokers).

## Orchestration Flow (Saga / Idempotency)
1.  Client -> `POST /api/v1/checkout` (Idempotency-Key required).
2.  System orchestrates Cart, Inventory, Pricing validation internally.
3.  Creates Order (`PENDING`).
4.  Initiates Payment -> Returns `paymentUrl` and `PENDING_PAYMENT`.
5.  **Webhook** triggers `POST /api/v1/payments/webhook` with `SUCCESS`.
6.  Event `payment.succeeded` fired across Redis PubSub.
7.  Async Consumers adapt State:
    - Order -> `CONFIRMED`
    - Inventory -> Confirm deduction
    - Shipping -> Create shipment
    - Notifications -> Send email/SMS

*(Saga Compensation: If payment fails, cancel order, release inventory via `POST /internal/inventory/release`)*

## Internal Web Traffic Mocks
*   `GET /internal/carts/{cartId}`
*   `POST /internal/products/batch`
*   `POST /internal/inventory/reserve`
*   `POST /internal/pricing/calculate`
*   `POST /internal/orders`
*   `POST /internal/payments`
