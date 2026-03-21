# Phase 7: Research — Enhanced Mock App Request Flows

## Current State Analysis

### Existing Service Topology
| Service | File | Port | Role |
|---------|------|------|------|
| api-gateway | index.js | 8080 | 2 flat endpoints (GET /api/users, POST /api/checkout) — standalone, no downstream calls |
| category-service | category.js | 8081 | GET /api/category/:id — returns static JSON, single setTimeout |
| payment-service | payment.js | 8082* | POST /api/charge — 200ms sleep + calls notification-service |
| order-service | order.js | 8083 | POST /api/checkout — calls category-service → payment-service |
| notification-service | Java Spring Boot | 8084 | POST /api/notify — receives payment status |

**⚠ Port conflict:** payment.js listens on 8083 (same as order.js). Should be 8082.

### Current Request Flow
```
start.sh → curl POST localhost:8083/api/checkout (every 1s)
  └─ order-service (8083)
      ├─ GET category-service (8081) → static JSON
      └─ POST payment-service (8082) → sleep 200ms
          └─ POST notification-service (8084) → log
```

### What's Missing for Rich Waterfalls
1. **Span depth**: Max 4 levels deep. Datadog waterfalls typically show 6-10+ levels
2. **No DB simulation**: No simulated database query spans (SELECT, INSERT, UPDATE)
3. **No cache layer**: No cache hit/miss simulation
4. **No validation spans**: No input validation, auth token checks
5. **No parallel calls**: Everything is sequential — no Promise.all patterns
6. **Single flow**: Only checkout flow generates multi-service traces
7. **No resource variation**: Each service has 1 endpoint with 1 resource name

## Architecture Decisions

### Approach: Enrich existing services with sub-spans using OpenTelemetry API
- Use `@opentelemetry/api` to create **manual child spans** within each service
- Simulate DB queries, cache lookups, validation as named child spans with realistic timing
- Add new endpoints to services for more resource variety
- Fix port conflict (payment.js → 8082)

### Target Waterfall Depth
Checkout flow should produce **8-12 spans** per trace:
```
order-service: POST /api/checkout (root)
  ├─ order-service: validate_cart
  ├─ category-service: GET /api/category/:id
  │   └─ category-service: db.query SELECT categories
  ├─ order-service: check_inventory (cache)
  ├─ payment-service: POST /api/charge
  │   ├─ payment-service: validate_card
  │   ├─ payment-service: fraud_check
  │   ├─ payment-service: db.query INSERT transactions
  │   └─ notification-service: POST /api/notify
  │       └─ notification-service: send_email
  └─ order-service: db.query INSERT orders
```

### Single Plan (All mock-app changes)
This is a focused phase — only modifying mock-app files. One plan is sufficient.
