---
phase: 26
slug: replace-saga-with-restful-in-mock-app
date: 2026-03-24
---

# Validation Strategy

## 1. Goal Overview
To guarantee the microservices function identically without Redis PubSub, substituting distributed domain events with purely synchronous explicit REST API actions while ensuring APM tracking remains flawless.

## 2. Validation Environments & Setup
- `mock-app` via `./start.sh` representing the end-to-end multi-service topology.

## 3. Nyquist Test Cases

### 3.1 Shipping Service REST Access (Dimension 1 & 2)
**Goal:** Prove `POST /api/shipping/allocate` natively triggers the fulfillment logic previously stored in raw event streams.
**Action:** `curl -X POST http://localhost:8087/api/shipping/allocate -H 'Content-Type: application/json' -d '{"orderId":"ord_manual_test"}'`
**Assertion:** Should return 200 OK. Logs should output `[SHIPPING] Allocating fulfillment routes for order ord_manual_test`.

### 3.2 End-to-End Tracing Parentage (Dimension 5 & 8)
**Goal:** Confirm the removal of RediSagas unifies tracing directly over Standard HTTP.
**Action:** Allow `start.sh` traffic generator to cycle.
**Assertion:** Observe `.logs/shipping.log` and `.logs/payment.log` to prove event reception occurs natively matching standard timestamps without exception traces. 

## 4. Rollback Plan
Preserve Redis Pub/Sub capabilities in `start.sh` without deleting `ioredis` modules to allow immediate rollback. Abandon branch if OpenTelemetry standard HTTP headers mysteriously fail cross-boundary.
