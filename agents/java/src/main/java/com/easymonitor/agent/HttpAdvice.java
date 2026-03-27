package com.easymonitor.agent;

import net.bytebuddy.asm.Advice;
import com.easymonitor.agent.trace.DatadogSpanExporter.DatadogSpan;
import com.easymonitor.agent.trace.DatadogSpanExporter;
import java.net.HttpURLConnection;

public class HttpAdvice {
    public static final java.util.Map<Object, DatadogSpan> SPANS = java.util.Collections.synchronizedMap(new java.util.WeakHashMap<>());

    private static final java.util.regex.Pattern URL_SCRUBBER = java.util.regex.Pattern.compile("/([a-zA-Z0-9]+_[0-9]+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\\d+)(/|$|\\?)");
    private static String scrubUrl(String url) {
        if (url == null) return "";
        return URL_SCRUBBER.matcher(url).replaceAll("/?$2");
    }

    @Advice.OnMethodEnter(suppress = Throwable.class)
    public static void onEnter(@Advice.This HttpURLConnection conn) {
        if (SPANS.containsKey(conn)) return;
        
        DatadogSpan span = new DatadogSpan();
        span.name = "http.client.request";
        span.resource = conn.getRequestMethod() + " " + scrubUrl(conn.getURL().getPath());
        span.service = System.getenv().getOrDefault("OTEL_SERVICE_NAME", "java-app");
        span.type = "http";
        span.meta.put("http.method", conn.getRequestMethod());
        span.meta.put("http.url", scrubUrl(conn.getURL().toString()));
        
        DatadogSpan parent = SpanTracker.getSpan();
        if (parent != null) {
            span.traceId = parent.traceId;
            span.parentId = parent.spanId;
        } else {
            span.traceId = java.util.concurrent.ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
            span.parentId = 0L;
        }
        span.spanId = java.util.concurrent.ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
        
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
        
        DatadogSpanExporter.submit(span);
    }
}
