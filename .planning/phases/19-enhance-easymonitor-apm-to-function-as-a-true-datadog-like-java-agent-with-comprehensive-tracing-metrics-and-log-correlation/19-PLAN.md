---
wave: 1
depends_on: []
files_modified:
  - ".settings/gradle"
  - "easymonitor-javaagent/build.gradle"
  - "easymonitor-javaagent/settings.gradle"
  - "easymonitor-javaagent/src/main/resources/META-INF/services/io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizerProvider"
  - "easymonitor-javaagent/src/main/java/com/easymonitor/agent/EasyMonitorAgentCustomizer.java"
  - "mock-app/checkout-service/build.gradle"
  - "mock-app/start.sh"
  - "easymonitor-apm-java/build.gradle" 
autonomous: true
---

# Phase 19: Build EasyMonitor Custom Java Agent

<objective>
To build a custom OpenTelemetry Java Agent distribution (`easymonitor-javaagent.jar`) that programmatically sets opinionated EasyMonitor defaults (OTLP endpoint, log capturing), perfectly mimicking the zero-code, comprehensive Datadog APM instrumentation footprint.
</objective>

<tasks>

<task>
  <description>Create the `easymonitor-javaagent` builder project and implement the custom SPI extension.</description>
  <read_first>
    - `/Users/karson.tang/workspace/personal/easy-monitor/settings.gradle`
  </read_first>
  <action>
    Create a new directory `/Users/karson.tang/workspace/personal/easy-monitor/easymonitor-javaagent` and add `include 'easymonitor-javaagent'` to the root `settings.gradle`. 
    
    Create `easymonitor-javaagent/build.gradle` utilizing:
    - plugin `java`
    - plugin `com.github.johnrengelman.shadow` version `8.1.1`
    - dependencies: 
      `compileOnly 'io.opentelemetry:opentelemetry-sdk-extension-autoconfigure-spi:1.37.0'`
      `runtimeOnly 'io.opentelemetry.javaagent:opentelemetry-javaagent:2.4.0-alpha'` (or latest stable)
      
    Config the `shadowJar` task to merge service files and set `archiveBaseName = 'easymonitor-javaagent'`.
    
    Create `src/main/java/com/easymonitor/agent/EasyMonitorAgentCustomizer.java` implementing `io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizerProvider`.
    In its `customize` method, programmatically force: 
    - `otel.exporter.otlp.endpoint` to `http://localhost:4317`
    - `otel.traces.exporter` to `otlp`
    - `otel.metrics.exporter` to `otlp`
    - `otel.logs.exporter` to `otlp`
    - Print a startup banner: `[EasyMonitor] Java Agent successfully attached!`
    
    Create the SPI registration file `src/main/resources/META-INF/services/io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizerProvider` containing the FQCN `com.easymonitor.agent.EasyMonitorAgentCustomizer`.
  </action>
  <acceptance_criteria>
    - `easymonitor-javaagent/build.gradle` defines the `shadowJar` task.
    - `EasyMonitorAgentCustomizer.java` contains `http://localhost:4317`.
    - `META-INF/services/io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizerProvider` exists and points to the customizer.
  </acceptance_criteria>
</task>

<task>
  <description>Refactor `checkout-service` to remove the Spring Boot APM library and attach our new `easymonitor-javaagent.jar`.</description>
  <read_first>
    - `/Users/karson.tang/workspace/personal/easy-monitor/mock-app/checkout-service/build.gradle`
    - `/Users/karson.tang/workspace/personal/easy-monitor/mock-app/start.sh`
  </read_first>
  <action>
    Modify `mock-app/checkout-service/build.gradle`:
    Remove `implementation 'com.easymonitor:easymonitor-apm-java:1.0.0-SNAPSHOT'` (or the project reference, whichever is there). The application build script must be completely clean of any APM dependencies.
    
    Modify `mock-app/start.sh`:
    Change the `java -jar` command for `checkout-service` to:
    `java -javaagent:../../easymonitor-javaagent/build/libs/easymonitor-javaagent-all.jar -jar build/libs/checkout-service.jar --server.port=8080` (adjust paths as necessary to point to the built shadow jar).
    Remove any `OTEL_EXPORTER_OTLP_ENDPOINT` environment variables from the script, since our custom agent handles that internally now. Keep `OTEL_SERVICE_NAME`.
  </action>
  <acceptance_criteria>
    - `mock-app/checkout-service/build.gradle` does NOT contain `easymonitor-apm`.
    - `mock-app/start.sh` contains `-javaagent` pointing to the new `easymonitor-javaagent-all.jar`.
    - The start script correctly provisions the service name `OTEL_SERVICE_NAME=checkout-service`.
  </acceptance_criteria>
</task>

</tasks>

<must_haves>
- The agent builds successfully as a single massive fat-jar containing upstream bytecode manipulation mechanisms.
- The `checkout-service` requires absolutely zero code or dependency changes to output full telemetry.
- When started, the JVM prints the `[EasyMonitor]` custom startup banner.
</must_haves>
