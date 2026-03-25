package com.easymonitor.order.service;

import com.easymonitor.order.domain.OrderOrder;
import com.easymonitor.order.repository.OrderRepository;
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
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public Map<String, Object> processOrder(List<Map<String, Object>> items) throws Exception {
        String orderId = "ord_" + System.currentTimeMillis();
        String userId = "usr_" + ThreadLocalRandom.current().nextInt(1000, 9999);
        String cartId = "crt_" + ThreadLocalRandom.current().nextInt(1000, 9999);
        log.info("Processing order: {}, user: {}, cart: {}", orderId, userId, cartId);

        Thread.sleep(ThreadLocalRandom.current().nextLong(3, 11)); // simulate prep

        // Phase 1: Context Resolution (Once per order)
        try {
            restTemplate.getForObject("http://localhost:8088/api/carts/" + cartId, String.class); // verify cart details
            restTemplate.getForObject("http://localhost:8085/api/user/" + userId, String.class); // verify user profile and standing
        } catch (Exception e) {}

        double subtotal = 0;
        
        // Phase 2: Item Processing (Repeats per item)
        for (Map<String, Object> item : items) {
            String categoryId = (String) item.getOrDefault("id", "electronics");
            int qty = ((Number) item.getOrDefault("qty", 1)).intValue();
            double price = ((Number) item.getOrDefault("price", 49.99)).doubleValue();

            try {
                restTemplate.getForObject("http://localhost:8081/api/product/" + categoryId, String.class); // product metadata
                restTemplate.getForObject("http://localhost:8089/api/pricings/" + categoryId, String.class); // calculate true cart price
                restTemplate.getForObject("http://localhost:8086/api/inventorys/" + categoryId, String.class); // check real inventory DB
            } catch (Exception e) {}
            
            subtotal += price * qty;
        }

        Thread.sleep(ThreadLocalRandom.current().nextLong(2, 6)); 
        double total = subtotal + (subtotal * 0.08) + 5.99;

        // Phase 3: Fulfillment Coordination (Once per order)
        try {
            restTemplate.getForObject("http://localhost:8087/api/shipping/status/" + orderId, String.class); // prepare shipping manifest
        } catch (Exception e) {}

        // Process Payment
        Map<String, Object> chargeResult = processPayment(orderId, total);

        // Record Order in PostgreSQL
        OrderOrder order = new OrderOrder(orderId, "completed", total, items.size(), new Date());
        orderRepository.save(order);

        // Cache Order in Redis
        ValueOperations<String, Object> ops = redisTemplate.opsForValue();
        ops.set("order:" + orderId, order, 10, TimeUnit.MINUTES);

        // Notify
        sendNotification(orderId, total);

        return Map.of(
            "order_id", orderId,
            "status", "completed",
            "total", total,
            "payment", chargeResult != null ? chargeResult : Map.of(),
            "items", items.size()
        );
    }

    private Map<String, Object> processPayment(String orderId, double total) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> chargeBody = Map.of(
                "amount", total,
                "currency", "USD",
                "order_id", orderId);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(chargeBody, headers);
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                "http://localhost:8082/api/charge", entity, Map.class);
        return resp.getBody();
    }

    private void sendNotification(String orderId, double total) {
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
        }
    }

    public Map<String, Object> getOrder(String id) {
        // Try caching first
        ValueOperations<String, Object> ops = redisTemplate.opsForValue();
        OrderOrder cached = (OrderOrder) ops.get("order:" + id);
        if (cached != null) {
            log.info("Cache hit for order: {}", id);
            return mapOrder(cached);
        }

        log.info("Cache miss for order: {}. Fetching from DB", id);
        return orderRepository.findById(id).map(this::mapOrder)
                .orElse(Map.of("id", id, "status", "not_found"));
    }

    private Map<String, Object> mapOrder(OrderOrder order) {
        return Map.of(
                "id", order.getId(),
                "status", order.getStatus(),
                "total", order.getTotal(),
                "created_at", order.getCreatedAt().toString());
    }
}
