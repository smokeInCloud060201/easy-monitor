# Architecture Research

**Domain:** Observability Platform (Logs, Metrics, Traces)
**Researched:** 2026-03-20
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Infrastructure                  │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────┐                          │
│  │         [node-agent]          │                          │
│  │  (Metrics, Logs, APM, WAL)    │                          │
│  └───────────────┬───────────────┘                          │
│                  │ (gRPC / TLS streamed)                    │
├──────────────────┼──────────────────────────────────────────┤
│           easy-monitor SaaS / Central Host                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  [master-service]                   │    │
│  │ (Ingress -> Bus -> Processors -> Storage / REST API)│    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                  │
├──────────────────────────┼──────────────────────────────────┤
│                  User Visualization                         │
│  ┌───────────────────────┴──────────────────┐               │
│  │              [dashboard]                 │               │
│  │         (React SPA UI via axum)          │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `node-agent` | Collect host CPU/RAM, tail specific logs, capture APM spans, and buffer data during network disconnects. | Rust binary deployed alongside user workloads (Docker/K8s sidecar or DaemonSet). |
| `master-service` | Authenticate agents, ingest high-throughput streams, index data, and serve GraphQL/REST to UI. | Rust binary utilizing asynchronous Tokio for scaling concurrency and Sled for quick disk persistence. |
| `dashboard` | View metrics over time, search logs, visualize span waterfalls. | React SPA querying the master-service API. |

## Recommended Project Structure

Already validated via existing structure:
```
easy-monitor/
├── node-agent/       # All client-side scraping logic
├── master-service/   # Ingress, bus, storage, REST api
├── shared-proto/     # Contract definition (gRPC)
└── dashboard/        # Frontend code
```

## Architectural Patterns

### Pattern 1: Write-Ahead Log (WAL) Buffering

**What:** The `node-agent` buffers outgoing telemetry locally before sending.
**When to use:** Crucial for observability so intermittent network issues to the `master-service` don't cause data loss.
**Trade-offs:** Consumes local disk on the client infrastructure. Needs strict size/duration limits.

### Pattern 2: Embedded Database (Sled)

**What:** Key-value storage embedded directly into the `master-service` process.
**When to use:** Perfect for single-node SaaS deployments and keeping infrastructure complexity essentially zero.
**Trade-offs:** Horizontal scaling of the `master-service` becomes extremely difficult. Limits total data capacity to a single volume.

## Data Flow

### Request Flow
```
[User App throws Error]
    ↓ (intercepted / stdout)
[node-agent] → [WAL] → [Forwarder (gRPC)] 
    ↓
[master-service] ← [Ingress] ← [Bus] ← [Processors] ← [sled DB]
```

## Anti-Patterns

### Anti-Pattern 1: Synchronous Metric Pumping
**What people do:** HTTP POST for every single metric/log event.
**Why it's wrong:** Tears down network connections rapidly, introduces massive latency and CPU overhead on both ends.
**Do this instead:** HTTP/2 (gRPC) streaming with bidirectional multiplexed channels to aggressively batch events.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `node-agent` ↔ `master-service` | gRPC over TLS (`tonic`) | Protobufs ensure backward compatibility. TLS ensures SaaS security. |

---
*Architecture research for: Observability Platform (Logs, Metrics, Traces)*
*Researched: 2026-03-20*
