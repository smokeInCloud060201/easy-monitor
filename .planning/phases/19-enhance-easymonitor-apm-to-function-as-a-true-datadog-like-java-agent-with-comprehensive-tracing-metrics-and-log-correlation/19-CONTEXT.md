# Phase 19: Datadog-like Java Agent - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Source:** User Request and Documentation Discussion

<domain>
## Phase Boundary

The user wants the `easymonitor-apm-java` solution to function identically to Datadog's APM Agent. Datadog uses a true JVM Java Agent (`-javaagent:dd-java-agent.jar`) which provides deep, dynamic bytecode instrumentation to perfectly capture traces, metrics, logs, and profiling from *all* libraries running in the JVM—not just Spring Boot code.

This phase will replace the Spring Boot Starter library approach from Phase 18 with a **true Custom OpenTelemetry Java Agent extension**. 
We will build `easymonitor-javaagent.jar` which embeds the vanilla `opentelemetry-javaagent.jar` and hardcodes our custom Defaults (`http://localhost:4317`, specific log formats, etc.).

</domain>

<decisions>
## Implementation Decisions

### Architectural Approach
- **Custom Agent Distribution:** We will build a new Gradle project `easymonitor-javaagent` that uses the `com.github.johnrengelman.shadow` plugin to bundle our custom code with the upstream OpenTelemetry Java Agent. This is exactly how Datadog, Honeycomb, and Splunk build their custom agents.

### Customizations
- **AutoConfigurationCustomizerProvider:** We implement this SPI interface to programmatically override the `otel.exporter.otlp.endpoint` to `http://localhost:4317` and enable logs/metrics exporters automatically.
- **Service Name Extraction:** We will ensure `otel.service.name` can be easily read or defaulted.

### Refactoring Mock App
- **Spring Boot Starter Removal:** We must remove `easymonitor-apm-java` from `checkout-service/build.gradle`. It breaks the "zero-code" premise to need dependencies in `build.gradle` for APM.
- **Start Script Update:** We will update `mock-app/start.sh` to explicitly add `-javaagent:../easymonitor-javaagent/build/libs/easymonitor-javaagent.jar` back to the JVM startup arguments for the `checkout-service`.
- **Validation:** Ensure the application boots up, creates traces for REST template calls (which were failing before the starter), and includes JDBC spans if we add any data persistence layers. This level of instrumentation depth proves it acts like Datadog.

</decisions>

<canonical_refs>
## Canonical References
- `mock-app/start.sh`
- `mock-app/checkout-service/build.gradle`
</canonical_refs>
