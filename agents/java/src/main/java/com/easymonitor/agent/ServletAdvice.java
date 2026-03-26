package com.easymonitor.agent;

import net.bytebuddy.asm.Advice;
import com.easymonitor.agent.trace.DatadogSpanExporter.DatadogSpan;
import com.easymonitor.agent.trace.DatadogSpanExporter;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class ServletAdvice {

    @Advice.OnMethodEnter(suppress = Throwable.class)
    public static void onEnter(@Advice.Argument(0) Object reqObject) {
        if (!(reqObject instanceof HttpServletRequest)) {
            return;
        }
        HttpServletRequest request = (HttpServletRequest) reqObject;
        
        DatadogSpan span = new DatadogSpan();
        span.name = "web.request";
        span.resource = request.getMethod() + " " + request.getRequestURI();
        span.service = System.getenv().getOrDefault("OTEL_SERVICE_NAME", "java-app");
        span.type = "web";
        span.meta.put("http.method", request.getMethod());
        span.meta.put("http.url", request.getRequestURL().toString());
        
        String traceIdStr = request.getHeader("x-easymonitor-trace-id");
        String parentIdStr = request.getHeader("x-easymonitor-parent-id");
        
        try {
            if (traceIdStr != null && !traceIdStr.isEmpty()) {
                span.traceId = Long.parseUnsignedLong(traceIdStr);
            } else {
                span.traceId = java.util.concurrent.ThreadLocalRandom.current().nextLong();
            }
            if (parentIdStr != null && !parentIdStr.isEmpty()) {
                span.parentId = Long.parseUnsignedLong(parentIdStr);
            }
            span.spanId = java.util.concurrent.ThreadLocalRandom.current().nextLong();
        } catch (Exception e) {
            span.traceId = java.util.concurrent.ThreadLocalRandom.current().nextLong();
            span.spanId = java.util.concurrent.ThreadLocalRandom.current().nextLong();
        }
        
        span.start = System.currentTimeMillis() * 1000000L; // ns
        span.meta.put("start_time_ms", String.valueOf(System.currentTimeMillis()));
        
        try {
            java.lang.management.ThreadMXBean bean = java.lang.management.ManagementFactory.getThreadMXBean();
            if (bean.isThreadCpuTimeSupported() && bean.isThreadCpuTimeEnabled()) {
                request.setAttribute("easymonitor.cpu_time_start", bean.getCurrentThreadCpuTime());
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

        if (reqObject instanceof HttpServletRequest) {
            try {
                HttpServletRequest request = (HttpServletRequest) reqObject;
                Object startCpuObj = request.getAttribute("easymonitor.cpu_time_start");
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
        
        if (resObject instanceof HttpServletResponse) {
            HttpServletResponse response = (HttpServletResponse) resObject;
            span.meta.put("http.status_code", String.valueOf(response.getStatus()));
            if (response.getStatus() >= 400) {
                span.error = 1;
            }
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
        
        long startMs = Long.parseLong(span.meta.get("start_time_ms"));
        span.duration = (System.currentTimeMillis() - startMs) * 1000000L;
        
        DatadogSpanExporter.export(span);
        SpanTracker.clear();

        try {
            Class<?> mdc = Class.forName("org.slf4j.MDC");
            mdc.getMethod("remove", String.class).invoke(null, "trace_id");
            mdc.getMethod("remove", String.class).invoke(null, "span_id");
        } catch (Throwable t) {}
    }
}
