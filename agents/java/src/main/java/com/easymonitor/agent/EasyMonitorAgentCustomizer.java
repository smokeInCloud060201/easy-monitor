package com.easymonitor.agent;

import io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizer;
import io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizerProvider;

import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Customizes the OpenTelemetry SDK AutoConfiguration.
 * This runs inside the javaagent early in JVM startup.
 */
public class EasyMonitorAgentCustomizer implements AutoConfigurationCustomizerProvider {

    private static final Logger logger = Logger.getLogger(EasyMonitorAgentCustomizer.class.getName());

    @Override
    public void customize(AutoConfigurationCustomizer autoConfiguration) {
        try (java.net.DatagramSocket socket = new java.net.DatagramSocket()) {
            String svc = System.getProperty("otel.service.name", System.getenv().getOrDefault("OTEL_SERVICE_NAME", "java-agent"));
            java.util.function.Consumer<String> send = (msg) -> {
                String json = String.format("{\"version\":\"1.1\",\"host\":\"local\",\"short_message\":\"%s\",\"timestamp\":%s,\"level\":6,\"_service\":\"%s\"}",
                        msg, System.currentTimeMillis() / 1000.0, svc);
                try {
                    byte[] bytes = json.getBytes();
                    socket.send(new java.net.DatagramPacket(bytes, bytes.length, java.net.InetAddress.getByName("127.0.0.1"), 12201));
                } catch (Exception ignored) {}
            };
            send.accept("  [EasyMonitor] Java Agent successfully attached!");
        } catch (Exception ignored) {}

        autoConfiguration.addPropertiesCustomizer(config -> {
            Map<String, String> customConfig = new HashMap<>();

            // Force EasyMonitor Opinionated Defaults
            customConfig.put("otel.exporter.otlp.endpoint", "http://localhost:4317");
            customConfig.put("otel.exporter.otlp.protocol", "grpc");
            customConfig.put("otel.traces.exporter", "otlp");
            customConfig.put("otel.metrics.exporter", "otlp");
            customConfig.put("otel.logs.exporter", "gelf");

            return customConfig;
        });
    }

    private void setDefault(Map<String, String> customConfig, io.opentelemetry.sdk.autoconfigure.spi.ConfigProperties currentConfig, String key, String defaultValue) {
        if (currentConfig.getString(key) == null) {
            customConfig.put(key, defaultValue);
        }
    }
}
