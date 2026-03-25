package com.easymonitor.agent;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.sdk.common.CompletableResultCode;
import io.opentelemetry.sdk.logs.data.LogRecordData;
import io.opentelemetry.sdk.logs.export.LogRecordExporter;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.Collection;

public class GelfLogRecordExporter implements LogRecordExporter {

    private DatagramSocket socket;
    private InetAddress address;
    private int port = 12201;

    public GelfLogRecordExporter() {
        try {
            socket = new DatagramSocket();
            address = InetAddress.getByName("127.0.0.1");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public CompletableResultCode export(Collection<LogRecordData> logs) {
        if (socket == null) return CompletableResultCode.ofSuccess();

        for (LogRecordData log : logs) {
            try {
                int levelNum = log.getSeverity() != null ? log.getSeverity().getSeverityNumber() : 9;
                int gelfLevel = 6;
                if (levelNum >= 21) gelfLevel = 2;
                else if (levelNum >= 17) gelfLevel = 3;
                else if (levelNum >= 13) gelfLevel = 4;
                else if (levelNum <= 8) gelfLevel = 7;

                String serviceName = log.getResource().getAttribute(AttributeKey.stringKey("service.name"));
                if (serviceName == null) serviceName = "unknown";
                
                String body = log.getBody() != null ? log.getBody().asString() : "";
                body = body.replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");

                String traceId = log.getSpanContext().isValid() ? log.getSpanContext().getTraceId() : "";
                String spanId = log.getSpanContext().isValid() ? log.getSpanContext().getSpanId() : "";
                
                double timestamp = log.getTimestampEpochNanos() / 1_000_000_000.0;

                String json = String.format(
                    "{\"version\":\"1.1\",\"host\":\"local\",\"short_message\":\"%s\",\"timestamp\":%f,\"level\":%d,\"_service\":\"%s\",\"_trace_id\":\"%s\",\"_span_id\":\"%s\"}",
                    body, timestamp, gelfLevel, serviceName, traceId, spanId
                );

                byte[] buffer = json.getBytes(StandardCharsets.UTF_8);
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length, address, port);
                socket.send(packet);
            } catch (Exception e) {
                // Ignore send errors to prevent crashing app
            }
        }
        return CompletableResultCode.ofSuccess();
    }

    @Override
    public CompletableResultCode flush() {
        return CompletableResultCode.ofSuccess();
    }

    @Override
    public CompletableResultCode shutdown() {
        if (socket != null && !socket.isClosed()) {
            socket.close();
        }
        return CompletableResultCode.ofSuccess();
    }
}
