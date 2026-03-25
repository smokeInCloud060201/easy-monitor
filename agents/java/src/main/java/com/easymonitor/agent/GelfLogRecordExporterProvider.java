package com.easymonitor.agent;

import io.opentelemetry.sdk.autoconfigure.spi.ConfigProperties;
import io.opentelemetry.sdk.autoconfigure.spi.logs.ConfigurableLogRecordExporterProvider;
import io.opentelemetry.sdk.logs.export.LogRecordExporter;

public class GelfLogRecordExporterProvider implements ConfigurableLogRecordExporterProvider {
    @Override
    public LogRecordExporter createExporter(ConfigProperties config) {
        return new GelfLogRecordExporter();
    }

    @Override
    public String getName() {
        return "gelf";
    }
}
