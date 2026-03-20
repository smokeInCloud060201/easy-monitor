# Stage 1: Build the Rust Node Agent
FROM rust:1.77-bookworm AS builder
WORKDIR /usr/src/app

# We need protobuf compiler for building `shared-proto`
RUN apt-get update && apt-get install -y protobuf-compiler

# Copy the entire workspace to resolve path dependencies
COPY Cargo.toml Cargo.lock ./
COPY shared-proto/ ./shared-proto/
COPY node-agent/ ./node-agent/
COPY master-service/ ./master-service/

# Build specifically the node-agent binary
WORKDIR /usr/src/app/node-agent
RUN cargo build --release

# Stage 2: Assemble the final runtime image
FROM debian:bookworm-slim
WORKDIR /app

# Install minimal runtime dependencies (like OpenSSL and CA certificates)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled Rust binary
COPY --from=builder /usr/src/app/target/release/node-agent /usr/local/bin/node-agent

ENV RUST_LOG=info

# Example default pointing to a hypothetical master service
# Can be overridden via docker run -e MASTER_NODE_URL=...
ENV MASTER_NODE_URL=http://localhost:3000

CMD ["node-agent"]
