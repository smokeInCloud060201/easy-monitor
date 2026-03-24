# ARCHITECTURE

## System Pattern
The easy-monitor application follows a distributed telemetry collection and processing architecture, consisting of a central master service, node agents placed on hosts, and a frontend dashboard.

## Layers and Data Flow
1. **Node Agent (`node-agent`)**:
   - **Collector/Receiver Boundary**: Gathers data locally. Uses `sysinfo` to pull host metrics, has sub-modules like `apm`, `dogstatsd`, `logs`.
   - **Local Cache/WAL**: Stores events/metrics in a Write-Ahead Log (`wal`) briefly to withstand network disruptions to the master.
   - **Forwarder**: Streams telemetry data to the master service via `tonic` (gRPC).

2. **Master Service (`master-service`)**:
   - **Ingress Layer (`ingress`)**: gRPC endpoints to receive data from node agents.
   - **Message Bus/Event Loop (`bus`)**: Internal orchestration of incoming telemetry streams.
   - **Processors (`processors`)**: Handles aggregation, alerting thresholds, and data transformations.
   - **Storage Layer (`storage`)**: Persists processed telemetry into an embedded `sled` database.
   - **API Layer (`api`)**: REST/HTTP interface (`axum`) serving the frontend.

3. **Dashboard (`dashboard`)**:
   - **Frontend UI Layer**: React frontend consuming the API layer. Uses `axios` to fetch data and `recharts` to render time-series metrics.

## Entry Points
- `master-service/src/main.rs`: Execution point for the central manager. Starts gRPC ingress and HTTP API servers.
- `node-agent/src/main.rs`: Execution point for the host agent. Starts metric collectors and forwarder loops.
- `dashboard/src/main.tsx`: Entry point for the frontend SPA.

## Instrumentation Strategy (Zero-Code Rule)
**CRITICAL ARCHITECTURAL CONSTRAINT:** The main mock application services MUST focus purely on Domain-Driven Design (DDD) and core business logic.
- **Never install or import** `opentelemetry`, `tracing-opentelemetry`, or ANY native APM SDK packages directly inside the mock app services (e.g., `payment-service`, `inventory-service`, `notification-service`).
- All Distributed Tracing, Logging, and Monitoring logic (including W3C context extraction/injection headers) **MUST** be implemented externally by the internal agents inside the `agents/` and `node-agent/` directories.
- To bridge the gap, Agents must rely on zero-code features (like auto-instrumentation, `global.fetch` monkeypatches, standard middleware wrap hooks, or generic `TracingLogger` integrations) rather than manual Carrier context injection inside application routes.
