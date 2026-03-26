package com.easymonitor.agent;

import com.easymonitor.agent.trace.DatadogSpanExporter;

public class SpanTracker {
    private static final ThreadLocal<DatadogSpanExporter.DatadogSpan> currentSpan = new ThreadLocal<>();

    public static void setSpan(DatadogSpanExporter.DatadogSpan span) {
        currentSpan.set(span);
    }

    public static DatadogSpanExporter.DatadogSpan getSpan() {
        return currentSpan.get();
    }

    public static void clear() {
        currentSpan.remove();
    }
}
