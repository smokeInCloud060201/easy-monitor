package com.easymonitor.agent;

import net.bytebuddy.asm.Advice;
import com.easymonitor.agent.trace.DatadogSpanExporter.DatadogSpan;
import com.easymonitor.agent.trace.DatadogSpanExporter;

public class SpringHttpAdvice {
    public static final java.util.Map<Object, DatadogSpan> SPANS = java.util.Collections.synchronizedMap(new java.util.WeakHashMap<>());

    private static final java.util.regex.Pattern URL_SCRUBBER = java.util.regex.Pattern.compile("/([a-zA-Z0-9]+_[0-9]+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\\d+)(/|$|\\?)");
    private static String scrubUrl(String url) {
        if (url == null) return "";
        return URL_SCRUBBER.matcher(url).replaceAll("/?$2");
    }

    @Advice.OnMethodEnter(suppress = Throwable.class)
    public static void onEnter(@Advice.This Object req) {
        DatadogSpan span = new DatadogSpan();
        span.name = "http.client.request";
        
        try {
            Object methodObj = ReflectionCache.getMethod(req.getClass(), "getMethod").invoke(req);
            Object uriObj = ReflectionCache.getMethod(req.getClass(), "getURI").invoke(req);
            String pathStr = (String) ReflectionCache.getMethod(uriObj.getClass(), "getPath").invoke(uriObj);
            span.resource = methodObj.toString() + " " + scrubUrl(pathStr);
            span.meta.put("http.method", methodObj.toString());
            span.meta.put("http.url", scrubUrl(uriObj.toString()));
        } catch (Exception e) {}
        
        span.service = System.getenv().getOrDefault("OTEL_SERVICE_NAME", "java-app");
        span.type = "http";
        
        DatadogSpan parent = SpanTracker.getSpan();
        if (parent != null) {
            span.traceId = parent.traceId;
            span.parentId = parent.spanId;
        } else {
            span.traceId = java.util.concurrent.ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
            span.parentId = 0L;
        }
        span.spanId = java.util.concurrent.ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
        
        try {
            Object headersObj = ReflectionCache.getMethod(req.getClass(), "getHeaders").invoke(req);
            ReflectionCache.getMethod(headersObj.getClass(), "set", String.class, String.class).invoke(headersObj, "x-easymonitor-trace-id", String.valueOf(span.traceId));
            ReflectionCache.getMethod(headersObj.getClass(), "set", String.class, String.class).invoke(headersObj, "x-easymonitor-parent-id", String.valueOf(span.spanId));
        } catch (Exception e) {}
        
        span.start = System.currentTimeMillis() * 1000000L;
        span.meta.put("start_time_ms", String.valueOf(System.currentTimeMillis()));
        
        SPANS.put(req, span);
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class, suppress = Throwable.class)
    public static void onExit(@Advice.This Object req, @Advice.Return Object res, @Advice.Thrown Throwable thrown) {
        DatadogSpan span = SPANS.remove(req);
        if (span == null) return;
        
        if (res != null) {
            try {
                Object statusObj = ReflectionCache.getMethod(res.getClass(), "getStatusCode").invoke(res);
                int status = (Integer) ReflectionCache.getMethod(statusObj.getClass(), "value").invoke(statusObj);
                span.meta.put("http.status_code", String.valueOf(status));
                if (status >= 400) span.error = 1;
            } catch (Exception e) {}
        }

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
