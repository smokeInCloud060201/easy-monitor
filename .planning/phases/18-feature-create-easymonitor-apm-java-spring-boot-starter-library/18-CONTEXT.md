# Phase 18: Build EasyMonitor APM Library - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Source:** User Request and PRD Discussion

<domain>
## Phase Boundary

The goal is to create a custom APM library (`easymonitor-apm-java`) that provides a zero-code "Datadog-like" integration experience for Spring Boot applications. Instead of messy manual span creation or requiring operators to attach a `-javaagent` at JVM startup, developers simply drop the library into their project `build.gradle` and get instant distributed tracing and log collection out of the box.

This phase includes:
1. Creating the reusable Spring Boot Starter library (`easymonitor-apm-java`).
2. Configuring it to use OpenTelemetry auto-instrumentation and SLF4J/Logback integration with an opinionated `http://localhost:4317` endpoint.
3. Updating the existing `checkout-service` to use this new library instead of the manual `-javaagent`.

</domain>

<decisions>
## Implementation Decisions

### Architectural Approach
- **Dependency vs Agent:** We will build a Spring Boot Starter library (`easymonitor-apm-java`) rather than a bytecode-level Java Agent, as explicitly requested by the user. This is a modern, dependency-based approach that achieves zero-code instrumentation for Spring Boot apps.

### Dependencies
- **OpenTelemetry Spring Boot Starter:** Core auto-instrumentation for HTTP requests, Spring Web MVC, and database calls (`opentelemetry-spring-boot-starter`).
- **OpenTelemetry Logback Appender:** To automatically capture and ship all standard Spring Boot SLF4J logs (`opentelemetry-logback-appender-1.2`) with embedded trace context.

### AutoConfiguration
- **Configuration Class:** `EasyMonitorApmAutoConfiguration.java` will be injected automatically using `spring.factories`.
- **Opinionated Defaults:** It will force the exporter endpoint to `http://localhost:4317` and enable gRPC export by default, making the experience plug-and-play for EasyMonitor developers.

### Refactoring Checkout Service
- **Build.gradle:** Add `implementation 'com.easymonitor:easymonitor-apm-java:1.0.0-SNAPSHOT'`.
- **Start Script:** Remove the `-javaagent:opentelemetry-javaagent.jar` flag from `/mock-app/start.sh` for the `checkout-service`.
- **Application Code:** Update `CheckoutController.java` to include standard SLF4J logging to demonstrate auto-correlation of logs and traces.

</decisions>

<canonical_refs>
## Canonical References
- `mock-app/checkout-service/build.gradle` — Target service to refactor.
- `mock-app/start.sh` — Target startup script to remove the javaagent from.

</canonical_refs>
