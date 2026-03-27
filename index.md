# Directory Index

## Files

- **[Cargo.lock](./Cargo.lock)** - Rust workspace dependency lockfile
- **[Cargo.toml](./Cargo.toml)** - Rust workspace definition and shared dependencies
- **[Dockerfile](./Dockerfile)** - Instructions to build the master node container
- **[Makefile](./Makefile)** - Development tasks and service automation commands
- **[README.md](./README.md)** - Primary project overview and deployment guide
- **[docker-compose.yml](./docker-compose.yml)** - Multi-container infrastructure definition for fast deployment
- **[generate_certs.sh](./generate_certs.sh)** - Script to generate local TLS certificates
- **[.gitignore](./.gitignore)** - Rules for untracked files in source control

## Subdirectories

### agents/
- Polyglot tracing instrumentation libraries (Java, Go, Rust) for intercepting telemetry.

### certs/
- Generated local SSL certificates, private keys, and root authority chains.

### dashboard/
- React-based frontend SPA (Vite + Recharts) for unified observability analytics.

### docs/
- Dedicated project documentation and architectural design specifications.

### master-service/
- Rust API gateway for fast ingestion, multiplexing, and ClickHouse aggregation.

### mock-app/
- Polyglot microservices (order, cart, inventory, pricing) simulating an e-commerce platform.

### node-agent/
- Lightweight Rust daemon for shipping host-level metrics and payloads.

### shared-proto/
- Common Protocol Buffer definitions used across the microservices.

### _bmad/
- Configuration, manifests, and modules for the BMad Agile AI framework.

### .planning/
- AI Assistant agent persistence, phase tracking, and state markdown files.
