package com.easymonitor.agent;

import com.easymonitor.agent.trace.DatadogSpanExporter;

public class SpanTracker {
    private static final ThreadLocal<DatadogSpanExporter.DatadogSpan> currentSpan = new ThreadLocal<>();
    private static java.lang.reflect.Method mdcPut;
    private static java.lang.reflect.Method mdcRemove;

    static {
        try {
            Class<?> mdcClass = Class.forName("org.slf4j.MDC");
            mdcPut = mdcClass.getMethod("put", String.class, String.class);
            mdcRemove = mdcClass.getMethod("remove", String.class);
        } catch (Throwable t) {
            // Ignore if SLF4J is not on the classpath
        }
    }

    public static void setSpan(DatadogSpanExporter.DatadogSpan span) {
        currentSpan.set(span);
        if (mdcPut != null && span != null) {
            try {
                mdcPut.invoke(null, "trace_id", Long.toUnsignedString(span.traceId));
                mdcPut.invoke(null, "span_id", Long.toUnsignedString(span.spanId));
            } catch (Throwable t) {
                // Ignore invocation errors
            }
        }
    }

    public static DatadogSpanExporter.DatadogSpan getSpan() {
        return currentSpan.get();
    }

    public static void clear() {
        currentSpan.remove();
        if (mdcRemove != null) {
            try {
                mdcRemove.invoke(null, "trace_id");
                mdcRemove.invoke(null, "span_id");
            } catch (Throwable t) {
                // Ignore invocation errors
            }
        }
    }
}
