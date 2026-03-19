package com.easymonitor.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@SpringBootApplication
@RestController
public class NotificationServiceApplication {
    private static final Logger logger = LoggerFactory.getLogger(NotificationServiceApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(NotificationServiceApplication.class, args);
    }

    @PostMapping("/api/notify")
    public String notify(@RequestBody Map<String, Object> payload) {
        String status = (String) payload.getOrDefault("status", "unknown");
        String message = (String) payload.getOrDefault("message", "");
        
        logger.info("Notification Service actively processing notification request natively for status: {}", status);
        
        if ("failed".equals(status)) {
            logger.error("High Priority Alert Triggered! Payment transaction failed recursively: {}", message);
            // Simulate slow alert routing
            try { Thread.sleep(300); } catch (Exception e) {}
        } else {
            logger.info("Standard notification emitted: Payment transaction finished completely successful organically.");
             try { Thread.sleep(50); } catch (Exception e) {}
        }
        
        return "Notification seamlessly parsed cleanly natively successfully";
    }
}
