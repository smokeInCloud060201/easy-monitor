#!/bin/bash
set -e

# ─── Polyglot Microservices Start Script ───
# Services:
#   - order-service (Spring Boot 3 / Java 21)  :8080
#   - product-service (Go)                        :8081
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
sleep 5 # give postgres & redis a moment to wake up

echo ""

# ─── 1. Build Services ───
echo "📦 Building order-service (Java/Spring Boot)..."
cd "$SCRIPT_DIR/order-service"
./gradlew bootJar -q 2>&1
echo "   ✅ order-service.jar ready"

echo "📦 Building product-service (Go)..."
cd "$SCRIPT_DIR/product-service"
go build -o product-service . 2>&1
echo "   ✅ product-service binary ready"

echo "📦 Installing payment-service deps (Bun)..."
cd "$SCRIPT_DIR/payment-service"
bun install --silent 2>&1
echo "   ✅ payment-service deps ready"

echo "📦 Building notification-service (Rust)..."
cd "$SCRIPT_DIR/notification-service"
cargo build -q 2>&1
echo "   ✅ notification-service binary ready"

echo ""
echo "─── Starting Services ───"

# ─── 2. Start Services ───
LOG_DIR="$SCRIPT_DIR/.logs"
mkdir -p "$LOG_DIR"

# order-service (Java + OTel Java Agent)
echo "☕ Starting order-service on :8080..."
cd "$SCRIPT_DIR/order-service"
OTEL_SERVICE_NAME=order-service \
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317 \
OTEL_EXPORTER_OTLP_PROTOCOL=grpc \
OTEL_LOGS_EXPORTER=otlp \
OTEL_METRICS_EXPORTER=otlp \
java -javaagent:../../agents/java/opentelemetry-javaagent.jar \
     -jar build/libs/order-service.jar \
     --server.port=8080 \
     > "$LOG_DIR/order.log" 2>&1 &
PIDS+=($!)

# product-service (Go)
echo "🐹 Starting product-service on :8081..."
cd "$SCRIPT_DIR/product-service"
./product-service > "$LOG_DIR/product.log" 2>&1 &
PIDS+=($!)

# payment-service (Bun)
echo "🥟 Starting payment-service on :8082..."
cd "$SCRIPT_DIR/payment-service"
OTEL_SERVICE_NAME=payment-service \
bun run --preload ../../agents/node/instrumentation.ts src/index.ts > "$LOG_DIR/payment.log" 2>&1 &
PIDS+=($!)

# notification-service (Rust)
echo "🦀 Starting notification-service on :8083..."
cd "$SCRIPT_DIR/notification-service"
./target/debug/notification-service > "$LOG_DIR/notification.log" 2>&1 &
PIDS+=($!)

echo ""
echo "⏳ Waiting for services to start..."
sleep 8

# ─── 3. Health Checks ───
echo ""
echo "─── Health Checks ───"
for svc in "order-service:8080" "product-service:8081" "payment-service:8082" "notification-service:8083"; do
    name="${svc%%:*}"
    port="${svc##*:}"
    if curl -sf "http://localhost:$port/api/health" > /dev/null 2>&1; then
        echo "   $name (:$port) — healthy"
    else
        echo "   $name (:$port) — not ready yet (may need more time)"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " All services running! Generating traffic..."
echo "  Press Ctrl+C to stop all services."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── 4. Tail Service Logs ───
echo "📝 Streaming service logs..."
echo ""
tail -f "$LOG_DIR"/*.log 2>/dev/null &
PIDS+=($!)
sleep 1

# ─── 5. Traffic Generator ───
ITEMS='[
  {"id":"electronics","qty":2,"price":49.99},
  {"id":"clothing","qty":1,"price":89.99}
]'

TICK=0
while true; do
    TICK=$((TICK + 1))

    # Full checkout flow
    curl -sf -X POST http://localhost:8080/api/checkout \
         -H "Content-Type: application/json" \
         -d "{\"items\":$ITEMS}" > /dev/null 2>&1 &

    sleep 1
    
    # Mock External Payment Webhook triggering SAGA PubSub
    curl -sf -X POST http://localhost:8082/api/v1/payments/webhook \
         -H "Content-Type: application/json" \
         -d "{\"paymentId\":\"pay_12345\",\"status\":\"SUCCESS\",\"orderId\":\"ord_$TICK\"}" > /dev/null 2>&1 &

    sleep 1

    # Direct product browse
    curl -sf http://localhost:8081/api/products/electronics > /dev/null 2>&1 &
    curl -sf http://localhost:8081/api/products/clothing > /dev/null 2>&1 &

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

    # Cproduct search
    curl -sf "http://localhost:8081/api/products/search?q=electronics" > /dev/null 2>&1 &

    # Order lookup
    curl -sf http://localhost:8080/api/orders/ord_12345 > /dev/null 2>&1 &

    sleep 1
done
