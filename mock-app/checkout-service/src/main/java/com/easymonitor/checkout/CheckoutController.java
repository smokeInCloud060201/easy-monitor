package com.easymonitor.checkout;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
public class CheckoutController {

    private static final Logger log = LoggerFactory.getLogger(CheckoutController.class);
    private final RestTemplate restTemplate = new RestTemplate();

    // ─── POST /api/checkout ───
    @PostMapping("/api/checkout")
    public ResponseEntity<Map<String, Object>> checkout(@RequestBody Map<String, Object> body) {
        String orderId = "ord_" + System.currentTimeMillis();
        log.info("Processing checkout for order: {}", orderId);

        try {
            // Step 1: Validate request
            List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("items",
                    List.of(Map.of("id", "electronics", "qty", 2, "price", 49.99)));
            Thread.sleep(ThreadLocalRandom.current().nextLong(3, 11)); // simulate processing

            // Step 2: Check stock via category-service for each item
            double subtotal = 0;
            for (Map<String, Object> item : items) {
                String categoryId = (String) item.getOrDefault("id", "electronics");
                int qty = ((Number) item.getOrDefault("qty", 1)).intValue();
                double price = ((Number) item.getOrDefault("price", 49.99)).doubleValue();

                try {
                    restTemplate.getForObject("http://localhost:8081/api/category/" + categoryId, String.class);
                } catch (Exception e) {
                    // Continue even if category fails (5% random failure)
                }

                subtotal += price * qty;
            }

            // Step 3: Calculate totals
            Thread.sleep(ThreadLocalRandom.current().nextLong(2, 6)); // simulate processing
            double total = subtotal + (subtotal * 0.08) + 5.99;

            // Step 4: Process payment via payment-service
            Map<String, Object> chargeResult = null;
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                Map<String, Object> chargeBody = Map.of(
                        "amount", total,
                        "currency", "USD",
                        "order_id", orderId);
                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(chargeBody, headers);
                ResponseEntity<Map> resp = restTemplate.postForEntity(
                        "http://localhost:8082/api/charge", entity, Map.class);
                chargeResult = resp.getBody();
            } catch (Exception e) {
                return ResponseEntity.status(500).body(Map.of(
                        "error", "Payment failed",
                        "detail", e.getMessage()));
            }

            // Step 5: Record order in DB
            simulateDbOperation();

            // Step 6: Update order cache
            simulateCacheOperation();

            // Step 7: Send notification via notification-service
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                Map<String, Object> notifyBody = Map.of(
                        "order_id", orderId,
                        "email", "customer@example.com",
                        "type", "order_confirmation",
                        "total", total);
                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(notifyBody, headers);
                restTemplate.postForEntity("http://localhost:8083/api/notify", entity, Map.class);
            } catch (Exception e) {
                // Non-critical: don't fail checkout if notification fails
            }

            return ResponseEntity.ok(Map.of(
                    "order_id", orderId,
                    "status", "completed",
                    "total", total,
                    "payment", chargeResult != null ? chargeResult : Map.of(),
                    "items", items.size()));

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Checkout failed",
                    "detail", e.getMessage()));
        }
    }

    // ─── GET /api/orders/{id} ───
    @GetMapping("/api/orders/{id}")
    public ResponseEntity<Map<String, Object>> getOrder(@PathVariable String id) {
        // Cache lookup
        boolean cacheHit = ThreadLocalRandom.current().nextDouble() < 0.7;
        simulateCacheOperation();

        if (!cacheHit) {
            simulateDbOperation();
        }

        return ResponseEntity.ok(Map.of(
                "id", id,
                "status", "completed",
                "total", 149.99,
                "created_at", new Date().toString()));
    }

    // ─── GET /api/health ───
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "healthy", "service", "checkout-service");
    }

    // ─── Helpers ───
    private void simulateDbOperation() {
        try {
            Thread.sleep(ThreadLocalRandom.current().nextLong(10, 41));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void simulateCacheOperation() {
        try {
            Thread.sleep(ThreadLocalRandom.current().nextLong(1, 6));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
