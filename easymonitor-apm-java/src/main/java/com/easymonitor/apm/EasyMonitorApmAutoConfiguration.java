package com.easymonitor.apm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.PropertySource;
import jakarta.annotation.PostConstruct;

@AutoConfiguration
@PropertySource("classpath:easymonitor-apm-default.properties")
public class EasyMonitorApmAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(EasyMonitorApmAutoConfiguration.class);

    @PostConstruct
    public void init() {
        log.info("EasyMonitor APM Java Agent initialized! Tracing and logging are now auto-instrumented via OTLP.");
    }
}
