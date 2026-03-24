package com.easymonitor.order;

import com.easymonitor.order.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class OrderController {

    @Autowired
    private OrderService orderService;

    // ─── POST /api/order ───
    @PostMapping("/api/order")
    public ResponseEntity<Map<String, Object>> order(@RequestBody Map<String, Object> body) {
        try {
            List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("items",
                    List.of(Map.of("id", "electronics", "qty", 2, "price", 49.99)));
                    
            Map<String, Object> result = orderService.processOrder(items);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Order failed",
                    "detail", e.getMessage()));
        }
    }

    // ─── GET /api/orders/{id} ───
    @GetMapping("/api/orders/{id}")
    public ResponseEntity<Map<String, Object>> getOrder(@PathVariable String id) {
        return ResponseEntity.ok(orderService.getOrder(id));
    }

    // ─── GET /api/health ───
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "healthy", "service", "order-service");
    }

    // ─── POST /api/order/saga/transition ───
    @PostMapping("/api/order/saga/transition")
    public Map<String, Object> transitionSaga(@RequestBody Map<String, Object> payload) {
        System.out.println("[SAGA ORCHESTRATOR] Order Service transitioning payload state via REST: " + payload);
        return Map.of("status", "transitioned");
    }
}
