# EasyMonitor

EasyMonitor is a frictionless, unified observability platform integrating metrics, logs, application errors, and trace spans natively into a single interface. Think of it as a low-effort, Datadog-inspired monitoring pipeline built for simplicity and scale in Rust and React.

## Quick Start (Zero-Config Deployment)

You can spin up the full observability platform (Master UI, Gateway API, and ClickHouse persistence) effortlessly:

```bash
docker-compose up -d
```

Once running, navigate to `http://localhost:3000` to access the Unified Dashboard.

## Deploying the Telemetry Agent

To stream metrics from a target host up to your EasyMonitor instance, deploy the `node-agent` container. 

*Note: For the agent to capture deep host-level metrics, it should be run with host network and PID bindings.*

```bash
docker build -t easy-monitor-agent -f node-agent/Dockerfile .

docker run -d \
  --name easy-monitor-agent \
  --net=host \
  --pid=host \
  -e MASTER_NODE_URL=http://localhost:3000 \
  -e RUST_LOG=info \
  easy-monitor-agent
```

## Architecture

1. **Dashboard:** A React SPA (Vite + Recharts + Virtuoso) compiling down to static assets served by Axum.
2. **Master Service:** A Rust API Gateway performing ingestion multiplexing and serving the SPA.
3. **Database:** ClickHouse container for fast OLAP trace and log telemetry indexing.
4. **Node Agent:** A lightweight Rust daemon shipping payloads to the Master via gRPC/HTTP payloads.

## Project Phases
- Phase 1: Unified Dashboard Foundation
- Phase 2: Span Waterfall Visualization
- Phase 3: Zero-Config Deployment Engineering (Complete)
