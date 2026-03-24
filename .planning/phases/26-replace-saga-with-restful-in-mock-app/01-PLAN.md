---
wave: 1
depends_on: []
files_modified: ["mock-app/shipping-service/src/index.ts", "mock-app/order-service/src/main/java/com/easymonitor/order/config/RedisConfig.java", "mock-app/order-service/src/main/java/com/easymonitor/order/controller/OrderController.java", "mock-app/payment-service/src/index.ts"]
autonomous: true
---

# Plan 01: Refactor Redis SAGA to REST

<objective>
To replace asynchronous Redis Pub/Sub orchestration in `order-service` and `shipping-service` with new RESTful controllers, and update `payment-service` to dispatch events via direct HTTP calls instead of Redis. No trace headers need manual injecting.
</objective>

<tasks>

<task>
<read_first>
- mock-app/shipping-service/src/index.ts
</read_first>
<action>
1. Open `mock-app/shipping-service/src/index.ts`.
2. Locate the existing `subscriber.subscribe('payment.events')` block and DELETE the entire subscriber block.
3. Replace it with a new standard Express POST REST endpoint:
   ```typescript
   app.post('/api/shipping/allocate', (req, res) => {
       const orderId = req.body.orderId;
       logger.info(`REST Ingress: Received allocation request for order ${orderId}`);
       logger.info(`[SHIPPING] Allocating fulfillment routes for order ${orderId}`);
       res.json({ status: 'allocated', orderId });
   });
   ```
4. Save the file.
</action>
<acceptance_criteria>
- `mock-app/shipping-service/src/index.ts` contains `app.post('/api/shipping/allocate'`
- The file no longer contains `app.subscribe('payment.events')`.
</acceptance_criteria>
</task>

<task>
<read_first>
- mock-app/order-service/src/main/java/com/easymonitor/order/config/RedisConfig.java
- mock-app/order-service/src/main/java/com/easymonitor/order/controller/OrderController.java
</read_first>
<action>
1. Open `mock-app/order-service/src/main/java/com/easymonitor/order/config/RedisConfig.java`.
2. Delete the anonymous block passing `MessageListener` to `new ChannelTopic("payment.events")`. It's approximately inside `redisMessageListenerContainer`. Specifically remove `container.addMessageListener(..., new ChannelTopic("payment.events"));` so `order-service` no longer listens to sagas.
3. Open or create the primary controller class serving the order API, likely `OrderController.java`.
4. Add a new POST mapping:
   ```java
   @PostMapping("/saga/transition")
   public Map<String, Object> transitionSaga(@RequestBody Map<String, Object> payload) {
       System.out.println("[SAGA ORCHESTRATOR] Order Service transitioning payload state via REST: " + payload);
       return Map.of("status", "transitioned");
   }
   ```
</action>
<acceptance_criteria>
- `mock-app/order-service/src/main/java/com/easymonitor/order/config/RedisConfig.java` NO LONGER contains `new ChannelTopic("payment.events")`.
- `mock-app/order-service/src/main/java/com/easymonitor/order/controller/OrderController.java` contains `@PostMapping("/saga/transition")`.
</acceptance_criteria>
</task>

<task>
<read_first>
- mock-app/payment-service/src/index.ts
</read_first>
<action>
1. Open `mock-app/payment-service/src/index.ts`.
2. Locate the Webhook `if (status === 'SUCCESS')` block around line 35.
3. DELETE the lines:
   ```typescript
   const payload = { event: 'payment.succeeded', orderId, paymentId };
   await redisClient.publish('payment.events', JSON.stringify(payload));
   logger.info(`Saga Dispatched: Published 'payment.succeeded' to Redis 'payment.events'`);
   ```
4. REPLACE them with parallel native asynchronous `fetch` requests:
   ```typescript
   const payload = { event: 'payment.succeeded', orderId, paymentId };
   logger.info(`REST Dispatch: Firing payment transitions to Order & Shipping via HTTP`);
   
   Promise.all([
       fetch('http://localhost:8080/api/order/saga/transition', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(payload)
       }).catch(e => logger.error(`Order transition failed: ${e.message}`)),
       
       fetch('http://localhost:8087/api/shipping/allocate', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ orderId })
       }).catch(e => logger.error(`Shipping allocation failed: ${e.message}`))
   ]);
   ```
</action>
<acceptance_criteria>
- `mock-app/payment-service/src/index.ts` contains `fetch('http://localhost:8087/api/shipping/allocate'`
- The file no longer contains `redisClient.publish('payment.events'`.
</acceptance_criteria>
</task>

</tasks>

<verification>
Ensure `app.post('/api/shipping/allocate'` is bound and returns 200 properly without crashing `npm start`. Ensure `start.sh` cycles appropriately by verifying that newly generated checkout traces log properly.
</verification>
<must_haves>
- OpenTelemetry spans natively auto-parent across node and java using HTTP headers without explicit code.
- Redis PubSub completely eliminated from saga fulfillment loop.
</must_haves>
