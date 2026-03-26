package com.easymonitor.agent.trace;

import org.msgpack.jackson.dataformat.MessagePackFactory;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import java.util.concurrent.*;

public class DatadogSpanExporter {

    private static final ObjectMapper mapper = new ObjectMapper(new MessagePackFactory());
    private static final String ENDPOINT = "http://127.0.0.1:8126/v0.4/traces";
    
    // Background worker for async transmission
    private static final BlockingQueue<DatadogSpan> queue = new LinkedBlockingQueue<>(10000);
    public static final Map<String, String> ENV_META = new HashMap<>();

    static {
        String attrs = System.getenv("OTEL_RESOURCE_ATTRIBUTES");
        if (attrs != null) {
            for (String pair : attrs.split(",")) {
                String[] kv = pair.split("=", 2);
                if (kv.length == 2) {
                    if ("deployment.environment".equals(kv[0])) ENV_META.put("env", kv[1]);
                    else if ("service.version".equals(kv[0])) ENV_META.put("version", kv[1]);
                }
            }
        }

        Thread worker = new Thread(() -> {
            while (true) {
                try {
                    List<DatadogSpan> batch = new ArrayList<>();
                    DatadogSpan first = queue.poll(1, TimeUnit.SECONDS);
                    if (first == null) {
                        continue;
                    }
                    batch.add(first);
                    queue.drainTo(batch, 99); // Take up to 99 more 

                    exportBatch(batch);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        });
        worker.setDaemon(true);
        worker.setName("EasyMonitor-Trace-Worker");
        worker.start();
    }

    public static class DatadogSpan {
        @JsonProperty("trace_id") public long traceId;
        @JsonProperty("span_id") public long spanId;
        @JsonProperty("parent_id") public long parentId;
        @JsonProperty("name") public String name;
        @JsonProperty("resource") public String resource;
        @JsonProperty("service") public String service;
        @JsonProperty("type") public String type = "web";
        @JsonProperty("start") public long start;
        @JsonProperty("duration") public long duration;
        @JsonProperty("error") public int error;
        @JsonProperty("meta") public Map<String, String> meta = new HashMap<>();
        @JsonProperty("metrics") public Map<String, Double> metrics = new HashMap<>();

        public DatadogSpan() {
            this.meta.putAll(ENV_META);
        }
    }

    public static void submit(DatadogSpan span) {
        double sampleRate = 1.0;
        if (span.error == 0 && ThreadLocalRandom.current().nextDouble() > sampleRate) {
            return; // drop silently
        }
        queue.offer(span);
    }

    private static void exportBatch(List<DatadogSpan> spans) {
        List<List<DatadogSpan>> payload = Collections.singletonList(spans);

        try {
            URL url = new URL(ENDPOINT);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/msgpack");
            conn.setDoOutput(true);

            try (OutputStream os = conn.getOutputStream()) {
                mapper.writeValue(os, payload);
            }

            int code = conn.getResponseCode();
            if (code >= 400) {
                System.err.println("[EasyMonitor] Failed to export traces to Datadog agent, status: " + code);
            }
        } catch (Exception e) {
            System.err.println("[EasyMonitor] Failed to export traces: " + e.getMessage());
        }
    }
}
