package com.easymonitor.pricing;

import com.easymonitor.pricing.service.PricingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class PricingController {

    @Autowired
    private PricingService pricingService;

    // ─── POST /api/pricing ───
    @PostMapping("/api/pricing")
    public ResponseEntity<Map<String, Object>> pricing(@RequestBody Map<String, Object> body) {
        try {
            List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("items",
                    List.of(Map.of("id", "electronics", "qty", 2, "price", 49.99)));
                    
            Map<String, Object> result = pricingService.processPricing(items);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Pricing failed",
                    "detail", e.getMessage()));
        }
    }

    // ─── GET /api/pricings/{id} ───
    @GetMapping("/api/pricings/{id}")
    public ResponseEntity<Map<String, Object>> getPricing(@PathVariable String id) {
        return ResponseEntity.ok(pricingService.getPricing(id));
    }

    // ─── GET /api/health ───
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "healthy", "service", "pricing-service");
    }
}
