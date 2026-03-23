package com.easymonitor.checkout;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@RestController
public class CheckoutController {

    private final RestTemplate restTemplate = new RestTemplate();
    private final Tracer tracer = GlobalOpenTelemetry.getTracer("checkout-service");

    // ─── POST /api/checkout ───
    @PostMapping("/api/checkout")
    public ResponseEntity<Map<String, Object>> checkout(@RequestBody Map<String, Object> body) {
        String orderId = "ord_" + System.currentTimeMillis();

        try {
            // Step 1: Validate request
            List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("items",
                    List.of(Map.of("id", "electronics", "qty", 2, "price", 49.99)));
            simulateSpan("validate_request", 3, 10, Map.of(
                    "cart.item_count", String.valueOf(items.size()),
                    "order.id", orderId
            ));

            // Step 2: Check stock via category-service for each item
            double subtotal = 0;
            for (Map<String, Object> item : items) {
                String categoryId = (String) item.getOrDefault("id", "electronics");
                int qty = ((Number) item.getOrDefault("qty", 1)).intValue();
                double price = ((Number) item.getOrDefault("price", 49.99)).doubleValue();

                Span catSpan = tracer.spanBuilder("http.client GET /api/category/" + categoryId)
                        .setSpanKind(SpanKind.CLIENT)
                        .setAttribute("http.method", "GET")
                        .setAttribute("http.url", "http://localhost:8081/api/category/" + categoryId)
                        .setAttribute("peer.service", "category-service")
                        .startSpan();
                try (Scope ignored = catSpan.makeCurrent()) {
                    restTemplate.getForObject("http://localhost:8081/api/category/" + categoryId, String.class);
                    catSpan.setStatus(StatusCode.OK);
                } catch (Exception e) {
                    catSpan.setStatus(StatusCode.ERROR, e.getMessage());
                    catSpan.recordException(e);
                    // Continue even if category fails (5% random failure)
                } finally {
                    catSpan.end();
                }

                subtotal += price * qty;
            }

            // Step 3: Calculate totals
            simulateSpan("calculate_totals", 2, 5, Map.of(
                    "order.subtotal", String.format("%.2f", subtotal),
                    "order.tax", String.format("%.2f", subtotal * 0.08),
                    "order.shipping", "5.99"
            ));
            double total = subtotal + (subtotal * 0.08) + 5.99;

            // Step 4: Process payment via payment-service
            Map<String, Object> chargeResult = null;
            Span paySpan = tracer.spanBuilder("http.client POST /api/charge")
                    .setSpanKind(SpanKind.CLIENT)
                    .setAttribute("http.method", "POST")
                    .setAttribute("http.url", "http://localhost:8082/api/charge")
                    .setAttribute("peer.service", "payment-service")
                    .startSpan();
            try (Scope ignored = paySpan.makeCurrent()) {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                Map<String, Object> chargeBody = Map.of(
                        "amount", total,
                        "currency", "USD",
                        "order_id", orderId
                );
                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(chargeBody, headers);
                ResponseEntity<Map> resp = restTemplate.postForEntity(
                        "http://localhost:8082/api/charge", entity, Map.class);
                chargeResult = resp.getBody();
                paySpan.setStatus(StatusCode.OK);
            } catch (Exception e) {
                paySpan.setStatus(StatusCode.ERROR, e.getMessage());
                paySpan.recordException(e);
                return ResponseEntity.status(500).body(Map.of(
                        "error", "Payment failed",
                        "detail", e.getMessage()
                ));
            } finally {
                paySpan.end();
            }

            // Step 5: Record order in DB
            simulateDbSpan("INSERT", "orders",
                    "INSERT INTO orders (id, status, total, items) VALUES ('" + orderId + "', 'completed', " + total + ", ?)",
                    12, 35);

            // Step 6: Update order cache
            simulateCacheSpan("SET", "order:" + orderId, 1, 5);

            // Step 7: Send notification via notification-service
            Span notifySpan = tracer.spanBuilder("http.client POST /api/notify")
                    .setSpanKind(SpanKind.CLIENT)
                    .setAttribute("http.method", "POST")
                    .setAttribute("http.url", "http://localhost:8083/api/notify")
                    .setAttribute("peer.service", "notification-service")
                    .startSpan();
            try (Scope ignored = notifySpan.makeCurrent()) {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                Map<String, Object> notifyBody = Map.of(
                        "order_id", orderId,
                        "email", "customer@example.com",
                        "type", "order_confirmation",
                        "total", total
                );
                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(notifyBody, headers);
                restTemplate.postForEntity("http://localhost:8083/api/notify", entity, Map.class);
                notifySpan.setStatus(StatusCode.OK);
            } catch (Exception e) {
                notifySpan.setStatus(StatusCode.ERROR, e.getMessage());
                // Non-critical: don't fail checkout if notification fails
            } finally {
                notifySpan.end();
            }

            return ResponseEntity.ok(Map.of(
                    "order_id", orderId,
                    "status", "completed",
                    "total", total,
                    "payment", chargeResult != null ? chargeResult : Map.of(),
                    "items", items.size()
            ));

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Checkout failed",
                    "detail", e.getMessage()
            ));
        }
    }

    // ─── GET /api/orders/{id} ───
    @GetMapping("/api/orders/{id}")
    public ResponseEntity<Map<String, Object>> getOrder(@PathVariable String id) {
        // Cache lookup
        boolean cacheHit = ThreadLocalRandom.current().nextDouble() < 0.7;
        simulateCacheSpan("GET", "order:" + id, 1, 5);

        if (!cacheHit) {
            simulateDbSpan("SELECT", "orders",
                    "SELECT * FROM orders WHERE id = '" + id + "'",
                    10, 40);
        }

        return ResponseEntity.ok(Map.of(
                "id", id,
                "status", "completed",
                "total", 149.99,
                "created_at", new Date().toString()
        ));
    }

    // ─── GET /api/health ───
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "healthy", "service", "checkout-service");
    }

    // ─── Helpers ───
    private void simulateSpan(String name, int minMs, int maxMs, Map<String, String> attrs) {
        Span span = tracer.spanBuilder(name).startSpan();
        try (Scope ignored = span.makeCurrent()) {
            attrs.forEach(span::setAttribute);
            Thread.sleep(ThreadLocalRandom.current().nextLong(minMs, maxMs + 1));
            span.setStatus(StatusCode.OK);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            span.end();
        }
    }

    private void simulateDbSpan(String op, String table, String statement, int minMs, int maxMs) {
        Span span = tracer.spanBuilder("db.query " + op + " " + table).startSpan();
        try (Scope ignored = span.makeCurrent()) {
            span.setAttribute("db.system", "postgresql");
            span.setAttribute("db.operation", op);
            span.setAttribute("db.sql.table", table);
            span.setAttribute("db.statement", statement);
            Thread.sleep(ThreadLocalRandom.current().nextLong(minMs, maxMs + 1));
            // 2% error rate
            if (ThreadLocalRandom.current().nextDouble() < 0.02) {
                span.setStatus(StatusCode.ERROR, "connection timeout");
                span.recordException(new RuntimeException("DB connection timeout"));
            } else {
                span.setStatus(StatusCode.OK);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            span.end();
        }
    }

    private void simulateCacheSpan(String op, String key, int minMs, int maxMs) {
        Span span = tracer.spanBuilder("cache." + op + " " + key).startSpan();
        try (Scope ignored = span.makeCurrent()) {
            span.setAttribute("cache.system", "redis");
            span.setAttribute("cache.operation", op);
            span.setAttribute("cache.key", key);
            Thread.sleep(ThreadLocalRandom.current().nextLong(minMs, maxMs + 1));
            span.setStatus(StatusCode.OK);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            span.end();
        }
    }
}
