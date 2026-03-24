package com.easymonitor.pricing.service;

import com.easymonitor.pricing.domain.PricingPricing;
import com.easymonitor.pricing.repository.PricingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@Service
public class PricingService {

    private static final Logger log = LoggerFactory.getLogger(PricingService.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private PricingRepository pricingRepository;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public Map<String, Object> processPricing(List<Map<String, Object>> items) throws Exception {
        String pricingId = "ord_" + System.currentTimeMillis();
        log.info("Processing pricing for pricing: {}", pricingId);

        Thread.sleep(ThreadLocalRandom.current().nextLong(3, 11)); // simulate prep

        double subtotal = 0;
        for (Map<String, Object> item : items) {
            String categoryId = (String) item.getOrDefault("id", "electronics");
            int qty = ((Number) item.getOrDefault("qty", 1)).intValue();
            double price = ((Number) item.getOrDefault("price", 49.99)).doubleValue();

            try {
                restTemplate.getForObject("http://localhost:8081/api/category/" + categoryId, String.class);
            } catch (Exception e) {
                // Ignore failure
            }
            subtotal += price * qty;
        }

        Thread.sleep(ThreadLocalRandom.current().nextLong(2, 6)); 
        double total = subtotal + (subtotal * 0.08) + 5.99;

        // Process Payment
        Map<String, Object> chargeResult = processPayment(pricingId, total);

        // Record Pricing in PostgreSQL
        PricingPricing pricing = new PricingPricing(pricingId, "completed", total, items.size(), new Date());
        pricingRepository.save(pricing);

        // Cache Pricing in Redis
        ValueOperations<String, Object> ops = redisTemplate.opsForValue();
        ops.set("pricing:" + pricingId, pricing, 10, TimeUnit.MINUTES);

        // Notify
        sendNotification(pricingId, total);

        return Map.of(
            "pricing_id", pricingId,
            "status", "completed",
            "total", total,
            "payment", chargeResult != null ? chargeResult : Map.of(),
            "items", items.size()
        );
    }

    private Map<String, Object> processPayment(String pricingId, double total) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> chargeBody = Map.of(
                "amount", total,
                "currency", "USD",
                "pricing_id", pricingId);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(chargeBody, headers);
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                "http://localhost:8082/api/charge", entity, Map.class);
        return resp.getBody();
    }

    private void sendNotification(String pricingId, double total) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Object> notifyBody = Map.of(
                    "pricing_id", pricingId,
                    "email", "customer@example.com",
                    "type", "pricing_confirmation",
                    "total", total);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(notifyBody, headers);
            restTemplate.postForEntity("http://localhost:8083/api/notify", entity, Map.class);
        } catch (Exception e) {
        }
    }

    public Map<String, Object> getPricing(String id) {
        // Try caching first
        ValueOperations<String, Object> ops = redisTemplate.opsForValue();
        PricingPricing cached = (PricingPricing) ops.get("pricing:" + id);
        if (cached != null) {
            log.info("Cache hit for pricing: {}", id);
            return mapPricing(cached);
        }

        log.info("Cache miss for pricing: {}. Fetching from DB", id);
        return pricingRepository.findById(id).map(this::mapPricing)
                .orElse(Map.of("id", id, "status", "not_found"));
    }

    private Map<String, Object> mapPricing(PricingPricing pricing) {
        return Map.of(
                "id", pricing.getId(),
                "status", pricing.getStatus(),
                "total", pricing.getTotal(),
                "created_at", pricing.getCreatedAt().toString());
    }
}
