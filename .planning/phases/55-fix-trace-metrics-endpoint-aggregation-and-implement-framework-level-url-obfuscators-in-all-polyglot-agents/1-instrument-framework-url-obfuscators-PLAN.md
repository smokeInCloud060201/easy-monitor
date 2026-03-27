---
wave: 1
depends_on: []
files_modified:
  - master-service/src/processors/trace_metrics.rs
  - agents/go/telemetry.go
  - agents/rust/easymonitor-agent/src/actix_middleware.rs
  - agents/rust/easymonitor-agent/src/reqwest_middleware.rs
  - agents/rust/easymonitor-agent/Cargo.toml
  - agents/java/src/main/java/com/easymonitor/agent/HttpAdvice.java
  - agents/java/src/main/java/com/easymonitor/agent/ServletAdvice.java
  - agents/java/src/main/java/com/easymonitor/agent/SpringHttpAdvice.java
  - agents/node/instrumentation.ts
autonomous: true
---

# Phase 55: Framework-Level Trace Sanitization Plan

<objective>
Restore the master-service endpoint metrics filter and push the URL UUID scrubber regex directly into each polyglot agent's native lifecycle hooks.
</objective>

<task>
<read_first>
- master-service/src/processors/trace_metrics.rs
</read_first>
<action>
Modify `trace_metrics.rs` near line 74 so that `is_api` explicitly ignores client spans.
Change:
`let is_api = span.name.contains(".request") || span.name.contains(".server") || span.name.contains("web.request");`
To exactly:
`let is_api = (span.name.contains(".request") && !span.name.contains(".client")) || span.name.contains(".server") || span.name.contains("web.request");`
</action>
<acceptance_criteria>
- `master-service/src/processors/trace_metrics.rs` contains `!span.name.contains(".client")`
- `cd master-service && cargo check` exits 0
</acceptance_criteria>
</task>

<task>
<read_first>
- agents/go/telemetry.go
</read_first>
<action>
In `agents/go/telemetry.go`:
1. Add `"regexp"` to the import block.
2. Under `var defaultMeta = make(map[string]string)`, add:
```go
var urlScrubber = regexp.MustCompile(`(?i)/([a-zA-Z0-9]+_[0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)(/|$|\?)`)

func scrubURL(u string) string {
	return urlScrubber.ReplaceAllString(u, "/?$2")
}
```
3. Update `WrapHTTPHandler` to use it for both `span.Resource` and `span.SetTag("http.url", ...)` string values.
4. Update `Transport::RoundTrip` similarly to scrub both `req.URL.Path` and `req.URL.String()`.
</action>
<acceptance_criteria>
- `agents/go/telemetry.go` contains `urlScrubber.ReplaceAllString`
</acceptance_criteria>
</task>

<task>
<read_first>
- agents/rust/easymonitor-agent/Cargo.toml
- agents/rust/easymonitor-agent/src/actix_middleware.rs
- agents/rust/easymonitor-agent/src/reqwest_middleware.rs
</read_first>
<action>
1. Add `regex = "1"` and `lazy_static = "1.4"` to `agents/rust/easymonitor-agent/Cargo.toml`.
2. In `agents/rust/easymonitor-agent/src/lib.rs` (or create a utils file if better), add a global `SCRUBBER` regex using `lazy_static` with the same `r"(?i)/([a-zA-Z0-9]+_[0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)(/|$|\?)"` pattern. Wait, better to just put the scrubber logic locally in the middlewares since they execute independently.
3. In `actix_middleware.rs`, before `tracing::info_span!`, declare the scrubber and sanitize `req.uri().to_string()`. Inject the sanitized URL instead of the default.
4. In `reqwest_middleware.rs`, inject logic to extract the current URL, scrub it, and perhaps update the span attributes or mutate the request path directly in the header tracing flow.
</action>
<acceptance_criteria>
- `agents/rust/easymonitor-agent/Cargo.toml` contains `regex`
- `cd agents/rust/easymonitor-agent && cargo check` exits 0
</acceptance_criteria>
</task>

<task>
<read_first>
- agents/java/src/main/java/com/easymonitor/agent/HttpAdvice.java
- agents/java/src/main/java/com/easymonitor/agent/ServletAdvice.java
- agents/java/src/main/java/com/easymonitor/agent/SpringHttpAdvice.java
</read_first>
<action>
In all three Java Advice classes, implement a URL scrubbing regular expression replacement.
Java regex: `url.replaceAll("/([a-zA-Z0-9]+_[0-9]+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\\d+)(/|$|\\?)", "/?$2")`
Update the `http.url` span attribute and the Datadog `resource` string to use the sanitized values before the span is finished.
</action>
<acceptance_criteria>
- `cat agents/java/src/main/java/com/easymonitor/agent/HttpAdvice.java | grep replaceAll` returns at least one match
- `cd agents/java && ./gradlew build` exits 0
</acceptance_criteria>
</task>

<task>
<read_first>
- agents/node/instrumentation.ts
</read_first>
<action>
In `agents/node/instrumentation.ts`:
Create a custom `SpanProcessor` (or patch the existing DataDog processor) that intercepts spans before export.
1. Implement `class UrlScrubbingSpanProcessor implements SpanProcessor`.
2. Inside `onStart(span)`, check `span.attributes['http.url']` and `span.name` or `span.resource`, mapping them through JS `replace` using the same global mask: `/\/([a-zA-Z0-9]+_[0-9]+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\d+)(\/|$|\?)/gi`, replaced with `'/?$2'`.
3. Add this processor to the `tracerProvider.addSpanProcessor(new UrlScrubbingSpanProcessor())`.
</action>
<acceptance_criteria>
- `agents/node/instrumentation.ts` contains `UrlScrubbingSpanProcessor` or equivalent scrub logic
- `cat agents/node/instrumentation.ts | grep replace` returns at least one match
</acceptance_criteria>
</task>
