package com.easymonitor.agent;

import com.easymonitor.agent.trace.DatadogSpanExporter.DatadogSpan;
import com.easymonitor.agent.trace.DatadogSpanExporter;
import net.bytebuddy.asm.Advice;

public class SpringAdvice {

    public static final java.util.regex.Pattern URL_SCRUBBER = java.util.regex.Pattern.compile("/([a-zA-Z0-9]+_[0-9]+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\\d+)(/|$|\\?)");
    public static String scrubUrl(String url) {
        if (url == null) return "";
        return URL_SCRUBBER.matcher(url).replaceAll("/?$2");
    }

    public static void debugOnEnter(Object req, Object res) {
        System.out.println("[SpringAdvice] onEnter - req: " + req + ", res: " + res);
    }

    public static void debugOnExit(Object req, Object res, Throwable thrown) {
        System.out.println("[SpringAdvice] onExit - req: " + req + ", res: " + res + ", thrown: " + thrown);
    }

    @Advice.OnMethodEnter(suppress = Throwable.class)
    public static void onEnter(@Advice.Argument(0) Object req, @Advice.Argument(1) Object res) {
        debugOnEnter(req, res);
        DatadogSpan span = new DatadogSpan();
        span.name = "web.request";

        try {
            String method = (String) ReflectionCache.getMethod(req.getClass(), "getMethod").invoke(req);
            String uri = (String) ReflectionCache.getMethod(req.getClass(), "getRequestURI").invoke(req);
            Object urlBuf = ReflectionCache.getMethod(req.getClass(), "getRequestURL").invoke(req);

            span.resource = method + " " + scrubUrl(uri);
            span.meta.put("http.method", method);
            span.meta.put("http.url", urlBuf != null ? scrubUrl(urlBuf.toString()) : "");
            span.source = SpringAdvice.class.getName();

            String traceIdStr = null;
            String parentIdStr = null;
            java.lang.reflect.Method getHeaderMethod = ReflectionCache.getMethod(req.getClass(), "getHeader", String.class);
            if (getHeaderMethod != null) {
                traceIdStr = (String) getHeaderMethod.invoke(req, "x-easymonitor-trace-id");
                parentIdStr = (String) getHeaderMethod.invoke(req, "x-easymonitor-parent-id");
            }

            if (traceIdStr != null && !traceIdStr.isEmpty()) {
                span.traceId = Long.parseUnsignedLong(traceIdStr);
            } else {
                span.traceId = java.util.concurrent.ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
            }
            if (parentIdStr != null && !parentIdStr.isEmpty()) {
                span.parentId = Long.parseUnsignedLong(parentIdStr);
            } else {
                span.parentId = 0L;
            }
        } catch (Exception e) {
            span.traceId = java.util.concurrent.ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
            span.parentId = 0L;
        }

        span.spanId = java.util.concurrent.ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
        span.service = System.getenv().getOrDefault("OTEL_SERVICE_NAME", "java-app");
        span.type = "web";
        span.start = System.currentTimeMillis() * 1000000L;
        span.meta.put("start_time_ms", String.valueOf(System.currentTimeMillis()));

        SpanTracker.setSpan(span);
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class, suppress = Throwable.class)
    public static void onExit(@Advice.Argument(0) Object req, @Advice.Argument(1) Object res, @Advice.Thrown Throwable thrown) {
        debugOnExit(req, res, thrown);
        DatadogSpan span = SpanTracker.getSpan();
        if (span == null) return;
        SpanTracker.clear();

        if (res != null) {
            try {
                int status = (Integer) ReflectionCache.getMethod(res.getClass(), "getStatus").invoke(res);
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

        long startMs = Long.parseLong(span.meta.getOrDefault("start_time_ms", String.valueOf(System.currentTimeMillis())));
        span.duration = (System.currentTimeMillis() - startMs) * 1000000L;

        DatadogSpanExporter.submit(span);
    }
}
