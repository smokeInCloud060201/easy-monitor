package com.easymonitor.agent;

import io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizer;
import io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizerProvider;

import java.util.HashMap;
import java.util.Map;

/**
 * Customizes the OpenTelemetry SDK AutoConfiguration.
 * This runs inside the javaagent early in JVM startup.
 */
public class EasyMonitorAgentCustomizer implements AutoConfigurationCustomizerProvider {

    @Override
    public void customize(AutoConfigurationCustomizer autoConfiguration) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println(" [EasyMonitor] Java Agent successfully attached!");
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        autoConfiguration.addPropertiesCustomizer(config -> {
            Map<String, String> customConfig = new HashMap<>();

            // Force EasyMonitor Opinionated Defaults
            customConfig.put("otel.exporter.otlp.endpoint", "http://localhost:4317");
            customConfig.put("otel.exporter.otlp.protocol", "grpc");
            customConfig.put("otel.traces.exporter", "otlp");
            customConfig.put("otel.metrics.exporter", "otlp");
            customConfig.put("otel.logs.exporter", "otlp");

            return customConfig;
        });
    }

    private void setDefault(Map<String, String> customConfig, io.opentelemetry.sdk.autoconfigure.spi.ConfigProperties currentConfig, String key, String defaultValue) {
        if (currentConfig.getString(key) == null) {
            customConfig.put(key, defaultValue);
        }
    }
}
