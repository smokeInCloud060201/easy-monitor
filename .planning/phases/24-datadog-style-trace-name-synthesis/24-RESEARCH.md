# Phase 24 Research: Datadog APM Naming Conventions

## Objective
Analyze the exact schema mapping and string interpolation rules Datadog utilizes for tracing HTTP requests and Relational Database queries so that we can replicate these seamlessly inside the upstream `node-agent` OTLP ingestors.

## Findings

### 1. Database Spans
Datadog represents database queries structurally as:
`[system].query · [SQL Statement or Operation]`

- **Examples captured from provided trace snippet**:
  - `sqlserver.query · SELECT FEAT_UID, ENABLE, DESCRIPTION...`
  - `sqlserver.query · set context_info ?`
  - `redis.query · DEL`
  - `redis.query · HMSET`
- **Implementation Mapping**:
  OpenTelemetry inherently logs the database engine type under the `db.system` attribute (e.g., `postgresql`, `redis`, `sqlserver`). The exact executed query string falls under the standard `db.statement` attribute. If `db.statement` is disabled for privacy or missing, APMs usually track `db.operation` (e.g., `SET`, `DEL`).
  Our `node-agent` Rust OTLP parser needs to extract `db.system`, append `.query`, and then safely interpolate the `db.statement` string preceded by ` · `.

### 2. HTTP Server/Client Spans
Datadog tracks web requests using framework-centric identifiers bridging method combinations:
`[framework_or_module].request · [Method] [Path]`

- **Examples captured from trace snippet**:
  - `servlet.request · POST /v1/closeAccount/...`
  - `http.request · GET /adminservice/loadholidays`
  - `spring.handler · FF4jResource.check`
- **Implementation Mapping**:
  In phase 22 we wrote the prefix resolution logic categorizing spans into buckets (`express.request`, `actix.request`, `servlet.request`, `http.request`). We simply need to ensure the space separator before the HTTP method is upgraded to ` · ` so Datadog's exact bulleted UI cascade propagates seamlessly.

### 3. Frontend UI Parsing & CSS Truncation
The React components (`EndpointsTable.tsx` / `TracesSection.tsx`) currently attempt to extract HTTP methods primarily via the `extractMethod(resource)` hook. 

- **Impact**: Modifying the backend generator to emit ` · ` requires updating the frontend string splitting so that we don't accidentally mangle downstream URLs or break the UI grid.
- **Resolution**: The frontend `EndpointsTable.tsx` currently extracts HTTP methods using a regex evaluating `(GET|POST|PUT...)` explicitly bordering whitespace. The new API formatter (e.g. `express.request · POST /route`) safely yields ` · POST `, structurally maintaining regex compatibility!
- **Mitigation**: Long SQL strings (thousands of characters) will definitively fracture the `TracesSection.tsx` waterfall container limits. Strict Tailwind text truncation (`truncate text-xs font-mono max-w-full`) must be enforced globally across the rendering boundaries.

## Validation Architecture
- Boot cluster containing PostgreSQL and Redis.
- Extract `easy_monitor_traces` records manually observing correct `span_name` payload mappings.
- Assess visual stability of dashboard span traces rendered.

## RESEARCH COMPLETE
