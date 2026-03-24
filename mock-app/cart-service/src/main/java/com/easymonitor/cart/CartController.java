package com.easymonitor.cart;

import com.easymonitor.cart.service.CartService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class CartController {

    @Autowired
    private CartService cartService;

    // ─── POST /api/cart ───
    @PostMapping("/api/cart")
    public ResponseEntity<Map<String, Object>> cart(@RequestBody Map<String, Object> body) {
        try {
            List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("items",
                    List.of(Map.of("id", "electronics", "qty", 2, "price", 49.99)));
                    
            Map<String, Object> result = cartService.processCart(items);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Cart failed",
                    "detail", e.getMessage()));
        }
    }

    // ─── GET /api/carts/{id} ───
    @GetMapping("/api/carts/{id}")
    public ResponseEntity<Map<String, Object>> getCart(@PathVariable String id) {
        return ResponseEntity.ok(cartService.getCart(id));
    }

    // ─── GET /api/health ───
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "healthy", "service", "cart-service");
    }
}
