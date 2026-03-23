#!/bin/bash
set -e

# ─── Polyglot Microservices Start Script ───
# Services:
#   - checkout-service (Spring Boot 3 / Java 21)  :8080
#   - category-service (Go)                        :8081
#   - payment-service  (Bun / TypeScript)          :8082
#   - notification-service (Rust / Actix-Web)      :8083

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS=()

cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null
    echo "✅ All services stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Easy Monitor — Polyglot Microservices Mock App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── 1. Build Services ───
echo "📦 Building checkout-service (Java/Spring Boot)..."
cd "$SCRIPT_DIR/checkout-service"
if [ ! -f target/checkout-service.jar ]; then
    ./mvnw package -DskipTests -q 2>&1
fi
echo "   ✅ checkout-service.jar ready"

echo "📦 Building category-service (Go)..."
cd "$SCRIPT_DIR/category-service"
if [ ! -f category-service ]; then
    go build -o category-service . 2>&1
fi
echo "   ✅ category-service binary ready"

echo "📦 Installing payment-service deps (Bun)..."
cd "$SCRIPT_DIR/payment-service"
if [ ! -d node_modules ]; then
    bun install --silent 2>&1
fi
echo "   ✅ payment-service deps ready"

echo "📦 Building notification-service (Rust)..."
cd "$SCRIPT_DIR/notification-service"
if [ ! -f target/debug/notification-service ]; then
    cargo build 2>&1
fi
echo "   ✅ notification-service binary ready"

echo ""
echo "─── Starting Services ───"

# ─── 2. Start Services ───

# checkout-service (Java + OTel Java Agent)
echo "☕ Starting checkout-service on :8080..."
cd "$SCRIPT_DIR/checkout-service"
OTEL_SERVICE_NAME=checkout-service \
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317 \
OTEL_EXPORTER_OTLP_PROTOCOL=grpc \
java -javaagent:opentelemetry-javaagent.jar \
     -jar target/checkout-service.jar \
     --server.port=8080 \
     > /dev/null 2>&1 &
PIDS+=($!)

# category-service (Go)
echo "🐹 Starting category-service on :8081..."
cd "$SCRIPT_DIR/category-service"
./category-service > /dev/null 2>&1 &
PIDS+=($!)

# payment-service (Bun)
echo "🥟 Starting payment-service on :8082..."
cd "$SCRIPT_DIR/payment-service"
bun run src/index.ts > /dev/null 2>&1 &
PIDS+=($!)

# notification-service (Rust)
echo "🦀 Starting notification-service on :8083..."
cd "$SCRIPT_DIR/notification-service"
./target/debug/notification-service > /dev/null 2>&1 &
PIDS+=($!)

echo ""
echo "⏳ Waiting for services to start..."
sleep 8

# ─── 3. Health Checks ───
echo ""
echo "─── Health Checks ───"
for svc in "checkout-service:8080" "category-service:8081" "payment-service:8082" "notification-service:8083"; do
    name="${svc%%:*}"
    port="${svc##*:}"
    if curl -sf "http://localhost:$port/api/health" > /dev/null 2>&1; then
        echo "   ✅ $name (:$port) — healthy"
    else
        echo "   ⚠️  $name (:$port) — not ready yet (may need more time)"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 All services running! Generating traffic..."
echo "  Press Ctrl+C to stop all services."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── 4. Traffic Generator ───
ITEMS='[
  {"id":"electronics","qty":2,"price":49.99},
  {"id":"clothing","qty":1,"price":89.99}
]'

while true; do
    # Full checkout flow: checkout → category → payment → notification
    curl -sf -X POST http://localhost:8080/api/checkout \
         -H "Content-Type: application/json" \
         -d "{\"items\":$ITEMS}" > /dev/null 2>&1 &

    sleep 1

    # Direct category browse
    curl -sf http://localhost:8081/api/category/electronics > /dev/null 2>&1 &
    curl -sf http://localhost:8081/api/category/clothing > /dev/null 2>&1 &

    sleep 1

    # Payment status check
    curl -sf http://localhost:8082/api/payment/status/txn_12345 > /dev/null 2>&1 &

    # Notification lookup
    curl -sf http://localhost:8083/api/notifications/ord_12345 > /dev/null 2>&1 &

    sleep 1

    # Another checkout with different items
    curl -sf -X POST http://localhost:8080/api/checkout \
         -H "Content-Type: application/json" \
         -d '{"items":[{"id":"books","qty":3,"price":12.99},{"id":"home","qty":1,"price":299.99}]}' > /dev/null 2>&1 &

    sleep 1

    # Category search
    curl -sf "http://localhost:8081/api/category/search?q=electronics" > /dev/null 2>&1 &

    # Order lookup
    curl -sf http://localhost:8080/api/orders/ord_12345 > /dev/null 2>&1 &

    sleep 1
done
