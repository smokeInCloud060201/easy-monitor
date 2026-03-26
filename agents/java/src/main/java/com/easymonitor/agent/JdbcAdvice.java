package com.easymonitor.agent;

import net.bytebuddy.asm.Advice;
import com.easymonitor.agent.trace.DatadogSpanExporter;
import com.easymonitor.agent.trace.DatadogSpanExporter.DatadogSpan;
import java.sql.PreparedStatement;
import java.sql.Connection;

public class JdbcAdvice {
    public static final java.util.Map<Object, DatadogSpan> SPANS = java.util.Collections.synchronizedMap(new java.util.WeakHashMap<>());
    public static final java.util.Map<Object, String> QUERIES = java.util.Collections.synchronizedMap(new java.util.WeakHashMap<>());
    private static final java.util.regex.Pattern OBFUSCATOR = java.util.regex.Pattern.compile("(['\"]).*?\\1|(\\b\\d+\\b)");

    public static class PrepareAdvice {
        @Advice.OnMethodExit(suppress = Throwable.class)
        public static void onExit(@Advice.Argument(0) String sql, @Advice.Return PreparedStatement stmt) {
            if (stmt != null && sql != null) {
                QUERIES.put(stmt, OBFUSCATOR.matcher(sql).replaceAll("?"));
            }
        }
    }

    public static class ExecuteAdvice {
        @Advice.OnMethodEnter(suppress = Throwable.class)
        public static void onEnter(@Advice.This PreparedStatement stmt) {
            String sql = QUERIES.get(stmt);
            if (sql == null) sql = "unknown";
            
            DatadogSpan span = new DatadogSpan();
            span.name = "db.query";
            span.resource = sql;
            span.service = System.getenv().getOrDefault("OTEL_SERVICE_NAME", "java-app");
            span.type = "sql";
            span.meta.put("db.system", "sql");
            span.meta.put("db.query", sql);
            
            DatadogSpan parent = SpanTracker.getSpan();
            if (parent != null) {
                span.traceId = parent.traceId;
                span.parentId = parent.spanId;
            } else {
                span.traceId = java.util.concurrent.ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
                span.parentId = 0L;
            }
            span.spanId = java.util.concurrent.ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
            span.start = System.currentTimeMillis() * 1000000L;
            span.meta.put("start_time_ms", String.valueOf(System.currentTimeMillis()));
            
            SPANS.put(stmt, span);
        }

        @Advice.OnMethodExit(onThrowable = Throwable.class, suppress = Throwable.class)
        public static void onExit(@Advice.This PreparedStatement stmt, @Advice.Thrown Throwable thrown) {
            DatadogSpan span = SPANS.remove(stmt);
            if (span == null) return;
            
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
}
