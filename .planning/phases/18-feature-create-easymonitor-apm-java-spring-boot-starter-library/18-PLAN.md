---
wave: 1
depends_on: []
files_modified:
  - ".settings/gradle"
  - "easymonitor-apm-java/build.gradle"
  - "easymonitor-apm-java/settings.gradle"
  - "easymonitor-apm-java/src/main/resources/META-INF/spring.factories"
  - "easymonitor-apm-java/src/main/java/com/easymonitor/apm/EasyMonitorApmAutoConfiguration.java"
  - "easymonitor-apm-java/src/main/resources/application.properties"
  - "easymonitor-apm-java/src/main/resources/logback-spring.xml"
  - "mock-app/checkout-service/build.gradle"
  - "mock-app/start.sh"
  - "mock-app/checkout-service/src/main/java/com/easymonitor/checkout/CheckoutController.java"
  - "settings.gradle"
autonomous: true
---

# Phase 18: Build EasyMonitor APM Library (Spring Boot Starter)

<objective>
To build a custom Spring Boot Starter library (`easymonitor-apm-java`) that automatically provisions OpenTelemetry tracing and logging without requiring a `-javaagent`, functioning like a Datadog "zero-code" library integration. We will also refactor `checkout-service` to use it.
</objective>

<tasks>

<task>
  <description>Create the `easymonitor-apm-java` Spring Boot library project structure and inject opinionated OpenTelemetry properties.</description>
  <read_first>
    - `/Users/karson.tang/workspace/personal/easy-monitor/settings.gradle`
  </read_first>
  <action>
    Create a new directory `/Users/karson.tang/workspace/personal/easy-monitor/easymonitor-apm-java` and add it to the root `settings.gradle` using `include 'easymonitor-apm-java'`. 
    Create `easymonitor-apm-java/build.gradle` containing Spring Boot 3 plugin, maven-publish, java-library, and dependencies for:
    - `org.springframework.boot:spring-boot-starter`
    - `io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter`
    - `io.opentelemetry.instrumentation:opentelemetry-logback-appender-1.2`
    
    Create `application.properties` setting standard APM endpoint defaults like `otel.exporter.otlp.endpoint=http://localhost:4317`, `otel.logs.exporter=otlp`, `otel.metrics.exporter=none`, `otel.traces.exporter=otlp`.
    Create an `EasyMonitorApmAutoConfiguration.java` configuration class.
    Create `META-INF/spring.factories` listing `org.springframework.boot.autoconfigure.EnableAutoConfiguration=com.easymonitor.apm.EasyMonitorApmAutoConfiguration`.
  </action>
  <acceptance_criteria>
    - `easymonitor-apm-java/build.gradle` contains `opentelemetry-spring-boot-starter`
    - `easymonitor-apm-java/src/main/resources/META-INF/spring.factories` exists and points to the right class.
  </acceptance_criteria>
</task>

<task>
  <description>Refactor `checkout-service` to use the new `easymonitor-apm-java` dependency instead of the `-javaagent`.</description>
  <read_first>
    - `/Users/karson.tang/workspace/personal/easy-monitor/mock-app/checkout-service/build.gradle`
    - `/Users/karson.tang/workspace/personal/easy-monitor/mock-app/start.sh`
    - `/Users/karson.tang/workspace/personal/easy-monitor/settings.gradle`
  </read_first>
  <action>
    Modify `mock-app/checkout-service/build.gradle` to add:
    `implementation project(':easymonitor-apm-java')` (assuming root `settings.gradle` includes both, or publish locally and use version).
    
    Modify `mock-app/start.sh` to remove `-javaagent:opentelemetry-javaagent.jar` from the Java command for `checkout-service`.
    The command should just be `java -jar build/libs/checkout-service.jar <args>`.
    
    Modify `mock-app/checkout-service/src/main/java/com/easymonitor/checkout/CheckoutController.java` to add an `org.slf4j.Logger` and log `log.info("Processing checkout for order '{}'", orderId);` when checkout begins, and `log.info("Finished processing order '{}'", orderId);` at the end.
  </action>
  <acceptance_criteria>
    - `mock-app/checkout-service/build.gradle` contains the `easymonitor-apm-java` dependency.
    - `mock-app/start.sh` does NOT contain `opentelemetry-javaagent.jar` for checkout application.
    - `CheckoutController.java` contains `log.info` statements.
  </acceptance_criteria>
</task>

</tasks>

<must_haves>
- The OpenTelemetry Auto-Instrumentation natively starts up with Spring via the starter dependency.
- Logs emitted by SLF4J are magically sent to OTLP due to the logback OTel appender included in our starter.
- Traces and logs show up in EasyMonitor dashboard just by adding the `easymonitor-apm-java` build dependency, no manual agent injection via JVM arguments.
</must_haves>
