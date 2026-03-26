package com.easymonitor.agent;

import java.util.Map;
import com.easymonitor.agent.trace.DatadogSpanExporter;

public class HttpPropagation {
    public static final String TRACE_ID_HEADER = "x-easymonitor-trace-id";
    public static final String PARENT_ID_HEADER = "x-easymonitor-parent-id";
    public static final String SAMPLING_PRIORITY_HEADER = "x-easymonitor-sampling-priority";

    /**
     * Injects the active span's trace context into the provided HTTP headers map.
     * This allows downstream services to continue the distributed trace.
     *
     * @param headers Map representing outbound HTTP headers
     */
    public static void injectHeaders(Map<String, String> headers) {
        DatadogSpanExporter.DatadogSpan span = SpanTracker.getSpan();
        if (span != null) {
            headers.put(TRACE_ID_HEADER, Long.toUnsignedString(span.traceId));
            headers.put(PARENT_ID_HEADER, Long.toUnsignedString(span.spanId));
            headers.put(SAMPLING_PRIORITY_HEADER, "1");
        }
    }
}
