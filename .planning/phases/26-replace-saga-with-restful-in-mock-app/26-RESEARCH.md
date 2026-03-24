# Phase 26: Replace SAGA with RESTful in mock-app
## Research Document

### Current System Design (SAGA Orchestration)
The current mock-app features an asynchronous Saga pattern over Redis Pub/Sub:
1. **Initiation**: `order-service` receives an order via POST `/api/order`. It fetches reference data, then POSTs to `payment-service`'s `/api/charge`.
2. **Payment Ingress**: The `payment-service` accepts the charge and returns. An external webhook simulator independently POSTs back to `payment-service/api/v1/payments/webhook`.
3. **Saga Dispatch (Current)**: Under the webhook, if `status=SUCCESS`, `payment-service` publishes a stringified JSON payload `{event: 'payment.succeeded', orderId}` directly to the Redis topic `payment.events`.
4. **Saga Consumers (Current)**:
   - `shipping-service` binds a Redis `.subscribe('payment.events')` listener in its `bootstrap()` routine inside `index.ts`. It logs the allocation logic.
   - `order-service` spins up an anonymous RedisMessageListener inside its `RedisConfig.java` bound to `payment.events`, converting the payload string back and updating its internal logs marking the order as completed.

### Proposed Architecture (RESTful Sync)
To eliminate the `payment.events` Redis backbone and rely on purely synchronous standard HTTP routes (which intrinsically benefits OpenTelemetry propagation):
1. **Shipping Service**: Expose `POST /api/shipping/allocate`. Payload: `{ "orderId": "..." }`.
2. **Order Service**: Expose `POST /api/order/saga/transition`. Payload: `{ "orderId": "...", "event": " payment.succeeded" }`.
3. **Payment Service**: In the success block of the `paymentId` webhook, swap `redisClient.publish` for HTTP POSTs to these incoming endpoints securely via Node's local `fetch()` or `http` libs.

### Downstream Impact
- `agents/node/instrumentation.ts`: The recent monkey-patch we added for `ioredis` `.publish` and `.emit` will still be valid for any legacy queuing, but since we are removing RediSagas, traces will naturally propagate over standard HTTP headers. OpenTelemetry Node Auto-Instrumentation seamlessly proxies `fetch`.
- `mock-app/start.sh`: Must ensure boot orders don't crash if HTTP is prioritized. The Sagas naturally handled asynchronous readiness, but REST endpoints require proper API mapping. We will preserve fault tolerance by simply catching HTTP exceptions from `payment-service` if downstream is heavily delayed.

## Validation Architecture
- W3C Distributed Tracing: The final implementation *must* show that the `shipping-service` allocation span is natively parented to the `payment-service` webhook span out of the box.
