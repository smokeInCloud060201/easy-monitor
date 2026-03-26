package com.easymonitor.agent;

import net.bytebuddy.asm.Advice;
import com.easymonitor.agent.trace.DatadogSpanExporter.DatadogSpan;
import com.easymonitor.agent.trace.DatadogSpanExporter;

public class ServletAdvice {

    @Advice.OnMethodEnter(suppress = Throwable.class)
    public static void onEnter(@Advice.Argument(0) Object reqObject) {
        boolean isReq_init = false;
        try { reqObject.getClass().getMethod("getMethod"); isReq_init = true; } catch (Throwable t) {}
        if (!isReq_init) return;
        
        DatadogSpan span = new DatadogSpan();
        span.name = "web.request";
        
        try {
            String method = (String) reqObject.getClass().getMethod("getMethod").invoke(reqObject);
            String uri = (String) reqObject.getClass().getMethod("getRequestURI").invoke(reqObject);
            Object urlBuf = reqObject.getClass().getMethod("getRequestURL").invoke(reqObject);
            
            span.resource = method + " " + uri;
            span.meta.put("http.method", method);
            span.meta.put("http.url", urlBuf != null ? urlBuf.toString() : "");
            
            String traceIdStr = (String) reqObject.getClass().getMethod("getHeader", String.class).invoke(reqObject, "x-easymonitor-trace-id");
            String parentIdStr = (String) reqObject.getClass().getMethod("getHeader", String.class).invoke(reqObject, "x-easymonitor-parent-id");
            
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
        span.start = System.currentTimeMillis() * 1000000L; // ns
        span.meta.put("start_time_ms", String.valueOf(System.currentTimeMillis()));
        
        try {
            java.lang.management.ThreadMXBean bean = java.lang.management.ManagementFactory.getThreadMXBean();
            if (bean.isThreadCpuTimeSupported() && bean.isThreadCpuTimeEnabled()) {
                reqObject.getClass().getMethod("setAttribute", String.class, Object.class).invoke(reqObject, "easymonitor.cpu_time_start", bean.getCurrentThreadCpuTime());
            }
        } catch (Throwable t) {}

        SpanTracker.setSpan(span);

        try {
            Class<?> mdc = Class.forName("org.slf4j.MDC");
            mdc.getMethod("put", String.class, String.class).invoke(null, "trace_id", String.valueOf(span.traceId));
            mdc.getMethod("put", String.class, String.class).invoke(null, "span_id", String.valueOf(span.spanId));
        } catch (Throwable t) {}
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class, suppress = Throwable.class)
    public static void onExit(@Advice.Argument(0) Object reqObject, @Advice.Argument(1) Object resObject, @Advice.Thrown Throwable thrown) {
        DatadogSpan span = SpanTracker.getSpan();
        if (span == null) {
            return;
        }
        SpanTracker.clear();

        boolean isReq = false;
        try { reqObject.getClass().getMethod("getMethod"); isReq = true; } catch (Throwable t) {}
        if (isReq) {
            try {
                Object startCpuObj = reqObject.getClass().getMethod("getAttribute", String.class).invoke(reqObject, "easymonitor.cpu_time_start");
                if (startCpuObj != null) {
                    long startCpu = (Long) startCpuObj;
                    java.lang.management.ThreadMXBean bean = java.lang.management.ManagementFactory.getThreadMXBean();
                    long endCpu = bean.getCurrentThreadCpuTime();
                    if (endCpu > startCpu) {
                        span.metrics.put("cpu.user", (double)(endCpu - startCpu) / 1000000.0); // ms
                    }
                }
            } catch (Throwable t) {}
        }
        
        boolean isRes = false;
        if (resObject != null) {
            try { resObject.getClass().getMethod("getStatus"); isRes = true; } catch (Throwable t) {}
        }
        if (isRes) {
            try {
                int status = (Integer) resObject.getClass().getMethod("getStatus").invoke(resObject);
                span.meta.put("http.status_code", String.valueOf(status));
                if (status >= 400) {
                    span.error = 1;
                }
            } catch (Throwable t) {}
        }
        
        if (thrown != null) {
            span.error = 1;
            String msg = thrown.getMessage();
            span.meta.put("error.message", msg != null ? msg : "null");
            span.meta.put("error.type", thrown.getClass().getName());
            
            java.io.StringWriter sw = new java.io.StringWriter();
            java.io.PrintWriter pw = new java.io.PrintWriter(sw);
            thrown.printStackTrace(pw);
            String stack = sw.toString();
            if (stack.length() > 2000) {
                stack = stack.substring(0, 2000) + "... (truncated)";
            }
            span.meta.put("error.stack", stack);
        }
        
        long startMs = Long.parseLong(span.meta.getOrDefault("start_time_ms", String.valueOf(System.currentTimeMillis())));
        span.duration = (System.currentTimeMillis() - startMs) * 1000000L;
        
        DatadogSpanExporter.submit(span);
        SpanTracker.clear();

        try {
            Class<?> mdc = Class.forName("org.slf4j.MDC");
            mdc.getMethod("remove", String.class).invoke(null, "trace_id");
            mdc.getMethod("remove", String.class).invoke(null, "span_id");
        } catch (Throwable t) {}
    }
}
