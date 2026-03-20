# Stage 1: Build the React Dashboard
FROM node:20-alpine AS frontend-builder
WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json* ./
RUN npm install
COPY dashboard/ ./
RUN npm run build

# Stage 2: Build the Rust Master Service
FROM rust:1.77-bookworm AS backend-builder
WORKDIR /usr/src/app
# We need protobuf compiler for building `shared-proto`
RUN apt-get update && apt-get install -y protobuf-compiler

# Copy the entire workspace to resolve path dependencies
COPY Cargo.toml Cargo.lock ./
COPY shared-proto/ ./shared-proto/
COPY node-agent/ ./node-agent/
COPY master-service/ ./master-service/

# Build specifically the master-service binary
WORKDIR /usr/src/app/master-service
RUN cargo build --release

# Stage 3: Assemble the final runtime image
FROM debian:bookworm-slim
WORKDIR /app

# Install minimal runtime dependencies (like OpenSSL and CA certificates)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled Rust binary
COPY --from=backend-builder /usr/src/app/target/release/master-service /usr/local/bin/master-service

# Copy the compiled React static files to the 'dist' directory, where Axum ServeDir looks for it
COPY --from=frontend-builder /app/dashboard/dist /app/dist

# Expose the API and UI port
EXPOSE 3000

ENV RUST_LOG=info

CMD ["master-service"]
