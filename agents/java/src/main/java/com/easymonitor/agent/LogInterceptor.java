package com.easymonitor.agent;

import java.io.PrintStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import com.easymonitor.agent.trace.DatadogSpanExporter;

public class LogInterceptor {
    private static DatagramSocket udpSocket;
    private static InetAddress udpAddress;

    public static void install(String serviceName) {
        try {
            udpSocket = new DatagramSocket();
            udpAddress = InetAddress.getByName("127.0.0.1");
        } catch (Exception e) {
            System.err.println("[EasyMonitor] Failed to initialize UDP GELF socket: " + e.getMessage());
            return;
        }

        PrintStream originalOut = System.out;
        PrintStream originalErr = System.err;

        System.setOut(new InterceptPrintStream(originalOut, serviceName, 6)); // INFO
        System.setErr(new InterceptPrintStream(originalErr, serviceName, 3)); // ERROR
    }

    private static class InterceptPrintStream extends PrintStream {
        private final String service;
        private final int level;

        public InterceptPrintStream(PrintStream original, String service, int level) {
            super(original, true);
            this.service = service;
            this.level = level;
        }

        @Override
        public void write(byte[] buf, int off, int len) {
            super.write(buf, off, len);
            String chunk = new String(buf, off, len).trim();
            if (chunk.isEmpty() || chunk.length() < 2)
                return;
            fireGelf(chunk);
        }

        private void fireGelf(String message) {
            // Prevent recursive loops if the agent prints natively
            if (message.contains("[EasyMonitor]"))
                return;

            try {
                // Escape backslashes first, then quotes, then newlines
                String escapedMsg = message.replace("\\", "\\\\")
                        .replace("\"", "\\\"")
                        .replace("\n", "\\n")
                        .replace("\r", "");
                long timestamp = System.currentTimeMillis();

                StringBuilder json = new StringBuilder();
                json.append("{")
                        .append("\"version\":\"1.1\",")
                        .append("\"host\":\"local\",")
                        .append("\"short_message\":\"").append(escapedMsg).append("\",")
                        .append("\"timestamp\":").append(timestamp / 1000.0).append(",")
                        .append("\"level\":").append(level).append(",")
                        .append("\"_service\":\"").append(service).append("\"");

                DatadogSpanExporter.DatadogSpan span = SpanTracker.getSpan();
                if (span != null) {
                    String traceId = Long.toUnsignedString(span.traceId, 16);
                    String spanId = Long.toUnsignedString(span.spanId, 16);

                    // Pad to 16 hex chars for Datadog UI correlation
                    while (traceId.length() < 16)
                        traceId = "0" + traceId;
                    while (spanId.length() < 16)
                        spanId = "0" + spanId;

                    json.append(",\"_trace_id\":\"").append(traceId).append("\"");
                    json.append(",\"_span_id\":\"").append(spanId).append("\"");
                }

                json.append("}");

                byte[] payload = json.toString().getBytes("UTF-8");
                DatagramPacket packet = new DatagramPacket(payload, payload.length, udpAddress, 12201);
                udpSocket.send(packet);
            } catch (Exception e) {
                // Fail silently to prevent app crash
            }
        }
    }
}
