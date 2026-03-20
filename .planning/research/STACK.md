# Stack Research

**Domain:** Observability Platform (Logs, Metrics, Traces)
**Researched:** 2026-03-20
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Rust | 1.75+ | Backend Services | High performance, memory safety, and predictable latency essential for processing high-volume telemetry. |
| React | 19.x | Frontend Dashboard | Ubiquitous component-based framework handling complex data visualizations efficiently. |
| gRPC (Tonic) | 0.11+ | Agent-Server Comm | Efficient binary protocol, strongly typed (Protobufs), lower payload overhead vs JSON HTTP for heavy metric streams. |
| Sled | 0.34+ | Embedded Storage | Low-friction key-value store, perfect for a self-hosted "single node" or straightforward datastore without managing external DBs like Postgres/Elasticsearch. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Recharts | 3.8+ | Data Visualization | Rendering time-series charts (CPU/Memory usage). |
| Tailwind CSS | 3.4+ | Styling | Rapid UI development for complex dashboards without fighting custom CSS. |
| Sysinfo | 0.30+ | Node Metrics | Required in the `node-agent` to scrape host OS metrics (CPU, RAM, Disks) cross-platform. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite | Frontend tooling | Offers significantly faster HMR and build times than Create React App or Webpack for React. |
| Docker & Compose | Containerization & Orchestration | Crucial for the "easy deploy" constraint. Allows users to spin up the master service and agents reliably. |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Sled (Embedded) | Elasticsearch / ClickHouse | If the platform pivots to enterprise-scale, multi-terabyte log retention requiring distributed search. |
| React | Vue / Svelte | Purely preference, though React has a larger ecosystem of complex charting libraries. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Heavy Java/JVM Agents | High memory overhead on monitored nodes | Native Rust/Go agents (our `node-agent`) |
| Polling architectures | High latency, missed transient events | Push-based gRPC streaming |

## Stack Patterns by Variant

**If scaling beyond single-node storage:**
- Use ClickHouse or similar columnar DB.
- Because Sled is embedded and key-value, making it less optimal for massive analytical log queries over time.

## Sources

- Industry standards (Datadog, OpenTelemetry) — High confidence mapping to Rust/gRPC.
- Existing codebase initialization mapping.

---
*Stack research for: Observability Platform (Logs, Metrics, Traces)*
*Researched: 2026-03-20*
