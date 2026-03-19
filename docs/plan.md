# Easy Monitor - Implementation Plan

This document outlines the phased approach to building the **Easy Monitor** platform in Rust, featuring an architecture heavily modeled after the robust **Datadog Agent (Collector/Forwarder/DogStatsD)** and **Datadog Cloud Backend (Stream Processing)**.

---

## Phase 1: Foundation & Core Infrastructure (Completed)
**Target**: Set up the central Rust Cargo workspace, define internal gRPC protocols, and stub the scalable stream-processing architecture.

### Details & Requirements:
- **Workspace Initialization**: Create `master-service`, `node-agent`, and `shared-proto`.
- **Protocol Definitions**: Define `metrics.proto`, `logs.proto`, `traces.proto`.
- **Master Event Bus Setup**: Inside `master-service`, initialize the core `tokio` multi-producer, single-consumer (MPSC) or broadcast channels that will serve as the internal Kafka-equivalent message bus.

---

## Phase 2: Node Agent Ingestion (DogStatsD, Collector, APM) (Completed)
**Target**: Implement Datadog-style ingestion directly from instrumented apps.

### Details & Requirements:
- **DogStatsD Server**: Open a `tokio::net::UdpSocket` on port `8125`. Write a parser for DogStatsD formatting (`metric.name:value|type|@sample_rate|#tags`).
- **Collector Worker**: Implements periodic "Checks". Add `sysinfo` host checks and `notify` log file tailing.
- **APM OTLP Receiver**: Expose gRPC/HTTP endpoints for Spans (`4317/4318`), handling context propagation (`W3C Trace Context`).
- **Local Storage Buffer (WAL)**: All three modules write asynchronously to a local `sled` database instance.

---

## Phase 3: Node Agent Forwarder & Master Ingress (Completed)
**Target**: Transmit the buffered data reliably to the Master Service.

### Details & Requirements:
- **The Forwarder (Node Agent)**: 
  - A thread loop that reads oldest entries from `sled`, compresses them with `zstd`, and sends via `tonic` gRPC to the Master Service.
  - Deletes local entries solely upon a `SyncAck`.
- **gRPC Ingress (Master Service)**:
  - Validates `mTLS` certs.
  - Accepts `SyncMetrics`, `SyncLogs`, `SyncTraces`.
  - Instantly publishes the raw protobuf payloads onto the **Master Event Bus** and replies with `SyncAck`. *No database calls happen here.*

---

## Phase 4: Master Service Stream Processors & Database (Completed)
**Target**: Process the streamed data synchronously without blocking ingestion.

### Details & Requirements:
- **Trace-to-Metrics Engine (RED Metrics)**: Consumes trace payloads from the Event Bus. Computes **Rate, Errors, Duration** for each `Service`/`Resource`, and emits the generated metrics back to the bus.
- **Alerts Evaluator**: Consumes metrics/logs from the Event Bus, maintaining rolling time-windows to trigger configured alarms.
- **Storage Writer / Flusher**: The final consumer on the event bus. Flushes massive aggregated batches into the Time-Series DB (`arrow`/`parquet`) and Log/Trace Index (`tantivy`).

---

## Phase 5: Master Service Queries & API Gateway (Completed)
**Target**: Expose the synthesized data to the Dashboard via HTTP.

### Details & Requirements:
- **API Gateway (`axum`)**:
  - `GET /api/v1/apm/services` & `GET /api/v1/apm/services/{name}/resources`
  - `POST /api/v1/traces/query` - Fetch Flame-Graph hierarchies.
  - `POST /api/v1/metrics/query` - standard metric charting queries.

---

## Phase 6: Unified Dashboard UI (Frontend) (Completed)
**Target**: Datadog-inspired Single Pane of Glass.

### Details & Requirements:
- **Project Structure**: Setup React/Vue TS project + Tailwind.
- **APM Service Catalog & Resource View**: Top-level UI for auto-computed RED metrics and latency drill-downs.
- **Trace Explorer & Flame Graphs**: Multi-span interactive waterfalls seamlessly correlated with Live Log sidewards (using `trace_id`).

---

## Phase 7: Alerting & RBAC (Completed)
**Target**: Enterprise production readiness.

### Details & Requirements:
- **Alert Notifications Engine**: Webhooks, Slack, Email routing.
- **RBAC**: JWT token validation limits.
