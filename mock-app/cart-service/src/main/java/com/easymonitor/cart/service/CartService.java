package com.easymonitor.cart.service;

import com.easymonitor.cart.domain.CartCart;
import com.easymonitor.cart.repository.CartRepository;
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
public class CartService {

    private static final Logger log = LoggerFactory.getLogger(CartService.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private CartRepository cartRepository;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public Map<String, Object> processCart(List<Map<String, Object>> items) throws Exception {
        String cartId = "ord_" + System.currentTimeMillis();
        log.info("Processing cart for cart: {}", cartId);

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
        Map<String, Object> chargeResult = processPayment(cartId, total);

        // Record Cart in PostgreSQL
        CartCart cart = new CartCart(cartId, "completed", total, items.size(), new Date());
        cartRepository.save(cart);

        // Cache Cart in Redis
        ValueOperations<String, Object> ops = redisTemplate.opsForValue();
        ops.set("cart:" + cartId, cart, 10, TimeUnit.MINUTES);

        // Notify
        sendNotification(cartId, total);

        return Map.of(
            "cart_id", cartId,
            "status", "completed",
            "total", total,
            "payment", chargeResult != null ? chargeResult : Map.of(),
            "items", items.size()
        );
    }

    private Map<String, Object> processPayment(String cartId, double total) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> chargeBody = Map.of(
                "amount", total,
                "currency", "USD",
                "cart_id", cartId);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(chargeBody, headers);
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                "http://localhost:8082/api/charge", entity, Map.class);
        return resp.getBody();
    }

    private void sendNotification(String cartId, double total) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Object> notifyBody = Map.of(
                    "cart_id", cartId,
                    "email", "customer@example.com",
                    "type", "cart_confirmation",
                    "total", total);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(notifyBody, headers);
            restTemplate.postForEntity("http://localhost:8083/api/notify", entity, Map.class);
        } catch (Exception e) {
        }
    }

    public Map<String, Object> getCart(String id) {
        // Try caching first
        ValueOperations<String, Object> ops = redisTemplate.opsForValue();
        CartCart cached = (CartCart) ops.get("cart:" + id);
        if (cached != null) {
            log.info("Cache hit for cart: {}", id);
            return mapCart(cached);
        }

        log.info("Cache miss for cart: {}. Fetching from DB", id);
        return cartRepository.findById(id).map(this::mapCart)
                .orElse(Map.of("id", id, "status", "not_found"));
    }

    private Map<String, Object> mapCart(CartCart cart) {
        return Map.of(
                "id", cart.getId(),
                "status", cart.getStatus(),
                "total", cart.getTotal(),
                "created_at", cart.getCreatedAt().toString());
    }
}
