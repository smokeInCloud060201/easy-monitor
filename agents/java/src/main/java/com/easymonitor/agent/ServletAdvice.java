package com.easymonitor.agent;

import net.bytebuddy.asm.Advice;
import com.easymonitor.agent.trace.DatadogSpanExporter.DatadogSpan;
import com.easymonitor.agent.trace.DatadogSpanExporter;

public class ServletAdvice {

    private static Class<?> MDC_CLASS;
    private static boolean MDC_INITIALIZED = false;

    public static final java.util.regex.Pattern URL_SCRUBBER = java.util.regex.Pattern.compile("/([a-zA-Z0-9]+_[0-9]+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\\d+)(/|$|\\?)");
    public static String scrubUrl(String url) {
        if (url == null) return "";
        return URL_SCRUBBER.matcher(url).replaceAll("/?$2");
    }

    public static void debugOnEnter(Object reqObject) {
        System.out.println("[ServletAdvice] onEnter - req: " + reqObject);
    }

    public static void debugOnExit(Object reqObject, Object resObject, Throwable thrown) {
        System.out.println("[ServletAdvice] onExit - req: " + reqObject + ", res: " + resObject + ", thrown: " + thrown);
    }

    private static Class<?> getMdcClass() {
        if (!MDC_INITIALIZED) {
            try {
                MDC_CLASS = Class.forName("org.slf4j.MDC", false, Thread.currentThread().getContextClassLoader());
            } catch (Throwable t) {
                try {
                    MDC_CLASS = Class.forName("org.slf4j.MDC");
                } catch (Throwable t2) {
                }
            }
            MDC_INITIALIZED = true;
        }
        return MDC_CLASS;
    }

    @Advice.OnMethodEnter(suppress = Throwable.class)
    public static void onEnter(@Advice.Argument(0) Object reqObject) {
        debugOnEnter(reqObject);
        boolean isReq_init = false;
        try { 
            if (ReflectionCache.getMethod(reqObject.getClass(), "getMethod") != null) isReq_init = true; 
        } catch (Throwable t) {}
        if (!isReq_init) return;
        
        DatadogSpan span = new DatadogSpan();
        span.name = "web.request";
        
        try {
            String method = (String) ReflectionCache.getMethod(reqObject.getClass(), "getMethod").invoke(reqObject);
            String uri = (String) ReflectionCache.getMethod(reqObject.getClass(), "getRequestURI").invoke(reqObject);
            Object urlBuf = ReflectionCache.getMethod(reqObject.getClass(), "getRequestURL").invoke(reqObject);
            
            span.resource = method + " " + scrubUrl(uri);
            span.meta.put("http.method", method);
            span.meta.put("http.url", urlBuf != null ? scrubUrl(urlBuf.toString()) : "");
            span.source = ServletAdvice.class.getName();
            
            String traceIdStr = null;
            String parentIdStr = null;
            java.lang.reflect.Method getHeaderMethod = ReflectionCache.getMethod(reqObject.getClass(), "getHeader", String.class);
            if (getHeaderMethod != null) {
                traceIdStr = (String) getHeaderMethod.invoke(reqObject, "x-easymonitor-trace-id");
                parentIdStr = (String) getHeaderMethod.invoke(reqObject, "x-easymonitor-parent-id");
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
        span.start = System.currentTimeMillis() * 1000000L; // ns
        span.meta.put("start_time_ms", String.valueOf(System.currentTimeMillis()));
        
        try {
            java.lang.management.ThreadMXBean bean = java.lang.management.ManagementFactory.getThreadMXBean();
            if (bean.isThreadCpuTimeSupported() && bean.isThreadCpuTimeEnabled()) {
                java.lang.reflect.Method setAttr = ReflectionCache.getMethod(reqObject.getClass(), "setAttribute", String.class, Object.class);
                if (setAttr != null) {
                    setAttr.invoke(reqObject, "easymonitor.cpu_time_start", bean.getCurrentThreadCpuTime());
                }
            }
        } catch (Throwable t) {}

        SpanTracker.setSpan(span);

        try {
            Class<?> mdc = getMdcClass();
            if (mdc != null) {
                ReflectionCache.getMethod(mdc, "put", String.class, String.class).invoke(null, "trace_id", String.valueOf(span.traceId));
                ReflectionCache.getMethod(mdc, "put", String.class, String.class).invoke(null, "span_id", String.valueOf(span.spanId));
            }
        } catch (Throwable t) {}
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class, suppress = Throwable.class)
    public static void onExit(@Advice.Argument(0) Object reqObject, @Advice.Argument(1) Object resObject, @Advice.Thrown Throwable thrown) {
        debugOnExit(reqObject, resObject, thrown);
        DatadogSpan span = SpanTracker.getSpan();
        if (span == null) {
            return;
        }
        SpanTracker.clear();

        boolean isReq = false;
        try { 
            if (ReflectionCache.getMethod(reqObject.getClass(), "getMethod") != null) isReq = true; 
        } catch (Throwable t) {}
        if (isReq) {
            try {
                Object startCpuObj = ReflectionCache.getMethod(reqObject.getClass(), "getAttribute", String.class).invoke(reqObject, "easymonitor.cpu_time_start");
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
            try { 
                if (ReflectionCache.getMethod(resObject.getClass(), "getStatus") != null) isRes = true; 
            } catch (Throwable t) {}
        }
        if (isRes) {
            try {
                int status = (Integer) ReflectionCache.getMethod(resObject.getClass(), "getStatus").invoke(resObject);
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
            Class<?> mdc = getMdcClass();
            if (mdc != null) {
                ReflectionCache.getMethod(mdc, "remove", String.class).invoke(null, "trace_id");
                ReflectionCache.getMethod(mdc, "remove", String.class).invoke(null, "span_id");
            }
        } catch (Throwable t) {}
    }
}
