package com.easymonitor.agent;

import net.bytebuddy.asm.Advice;
import com.easymonitor.agent.trace.DatadogSpanExporter.DatadogSpan;
import com.easymonitor.agent.trace.DatadogSpanExporter;
import java.net.HttpURLConnection;

public class HttpAdvice {
    public static final java.util.Map<HttpURLConnection, DatadogSpan> SPANS = new java.util.concurrent.ConcurrentHashMap<>();

    @Advice.OnMethodEnter(suppress = Throwable.class)
    public static void onEnter(@Advice.This HttpURLConnection conn) {
        if (SPANS.containsKey(conn)) return;
        
        DatadogSpan span = new DatadogSpan();
        span.name = "http.client.request";
        span.resource = conn.getRequestMethod() + " " + conn.getURL().getPath();
        span.service = System.getenv().getOrDefault("OTEL_SERVICE_NAME", "java-app");
        span.type = "http";
        span.meta.put("http.method", conn.getRequestMethod());
        span.meta.put("http.url", conn.getURL().toString());
        
        DatadogSpan parent = SpanTracker.getSpan();
        if (parent != null) {
            span.traceId = parent.traceId;
            span.parentId = parent.spanId;
        } else {
            span.traceId = java.util.concurrent.ThreadLocalRandom.current().nextLong();
            span.parentId = 0L;
        }
        span.spanId = java.util.concurrent.ThreadLocalRandom.current().nextLong();
        
        conn.setRequestProperty("x-easymonitor-trace-id", String.valueOf(span.traceId));
        conn.setRequestProperty("x-easymonitor-parent-id", String.valueOf(span.spanId));
        
        span.start = System.currentTimeMillis() * 1000000L;
        span.meta.put("start_time_ms", String.valueOf(System.currentTimeMillis()));
        
        SPANS.put(conn, span);
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class, suppress = Throwable.class)
    public static void onExit(@Advice.This HttpURLConnection conn, @Advice.Thrown Throwable thrown) {
        DatadogSpan span = SPANS.remove(conn);
        if (span == null) return;
        
        try {
            span.meta.put("http.status_code", String.valueOf(conn.getResponseCode()));
            if (conn.getResponseCode() >= 400) span.error = 1;
        } catch (Exception e) {}

        if (thrown != null) {
            span.error = 1;
            String msg = thrown.getMessage();
            span.meta.put("error.message", msg != null ? msg : "null");
            span.meta.put("error.type", thrown.getClass().getName());
        }
        
        long startMs = Long.parseLong(span.meta.get("start_time_ms"));
        span.duration = (System.currentTimeMillis() - startMs) * 1000000L;
        
        DatadogSpanExporter.export(span);
    }
}
